#![no_std]

use soroban_sdk::{
    Address, Env, MuxedAddress, String, Vec, contract, contracterror, contractevent, contractimpl,
    contracttype, panic_with_error, token,
};

const SCALE: i128 = 10_000_000;
const MAX_NAME_LEN: u32 = 64;
const MAX_SYMBOL_LEN: u32 = 12;

// ~5s ledgers: keep state alive for 30 days, bumping once less than 7 days remain.
const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

/// Stable error codes surfaced to clients as `Error(Contract, #n)`.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidConfig = 1,
    InvalidAmount = 2,
    OfferingPaused = 3,
    InvestorNotApproved = 4,
    OfferingOversubscribed = 5,
    NotAdmin = 6,
    InsufficientRaisedCapital = 7,
    InsufficientDistributionFunds = 8,
    DuplicateRevenueEvent = 9,
    NoInvestors = 10,
    NothingToClaim = 11,
    ArithmeticOverflow = 12,
    IssuerNotApproved = 13,
    OfferingNotFound = 14,
    NotIssuer = 15,
    OfferingLocked = 16,
    RevenueReportingDisabled = 17,
    ReportNotFound = 18,
    ReportAlreadyReviewed = 19,
}

fn ensure(env: &Env, condition: bool, error: Error) {
    if !condition {
        panic_with_error!(env, error);
    }
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Usdc,
    OfferingCount,
    Issuer(Address),
    Investor(Address),
    Offering(u32),
    Position(u32, Address),
    /// A sale reference already used in a report (anti-replay).
    RevenueEvent(u32, u64),
    /// Whether Minka allows the issuer to report revenue for an offering.
    RevenueReporting(u32),
    ReportCount(u32),
    Report(u32, u32),
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ReportStatus {
    /// Deposited by the issuer, waiting for Minka's review.
    Pending = 0,
    /// Approved by Minka and distributed pro-rata; investors can claim.
    Approved = 1,
    /// Rejected by Minka; the deposit went back to the issuer.
    Rejected = 2,
}

/// Revenue the issuer reports for an offering, backed by the USDC it deposits.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RevenueReport {
    pub id: u32,
    pub offering_id: u32,
    /// Issuer's own sale or period reference; unique per offering.
    pub reference: u64,
    pub amount: i128,
    pub status: ReportStatus,
    pub submitted_at: u64,
}

/// A primary offering published by an approved issuer (the startup).
///
/// Every token the contract holds for an offering sits in exactly one of its
/// three treasury buckets, so offering capital never backs a distribution and
/// one offering's funds never pay another's investors.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Offering {
    pub id: u32,
    pub issuer: Address,
    pub name: String,
    pub symbol: String,
    pub unit_price: i128,
    pub target_units: i128,
    pub sold_units: i128,
    pub revenue_per_unit_scaled: i128,
    pub paused: bool,
    /// Investment capital not yet withdrawn by the issuer.
    pub raised: i128,
    /// Revenue deposited in pending reports, waiting for Minka's review.
    pub available: i128,
    /// Approved revenue owed to investors (claimable).
    /// Rounding dust from pro-rata division stays here.
    pub allocated: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub units: i128,
    pub revenue_checkpoint_scaled: i128,
    pub claimable: i128,
}

#[contractevent]
pub struct IssuerStatusChanged {
    #[topic]
    pub issuer: Address,
    pub approved: bool,
}

#[contractevent]
pub struct InvestorStatusChanged {
    #[topic]
    pub investor: Address,
    pub approved: bool,
}

#[contractevent]
pub struct OfferingCreated {
    #[topic]
    pub offering_id: u32,
    #[topic]
    pub issuer: Address,
    pub name: String,
    pub symbol: String,
    pub unit_price: i128,
    pub target_units: i128,
}

#[contractevent]
pub struct OfferingUpdated {
    #[topic]
    pub offering_id: u32,
    pub unit_price: i128,
    pub target_units: i128,
}

#[contractevent]
pub struct OfferingPauseChanged {
    #[topic]
    pub offering_id: u32,
    pub paused: bool,
}

#[contractevent]
pub struct InvestmentRecorded {
    #[topic]
    pub offering_id: u32,
    #[topic]
    pub investor: Address,
    pub units: i128,
    pub amount: i128,
}

#[contractevent]
pub struct RaiseWithdrawn {
    #[topic]
    pub offering_id: u32,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct RevenueReportingChanged {
    #[topic]
    pub offering_id: u32,
    pub enabled: bool,
}

#[contractevent]
pub struct RevenueReportSubmitted {
    #[topic]
    pub offering_id: u32,
    #[topic]
    pub report_id: u32,
    pub reference: u64,
    pub amount: i128,
}

#[contractevent]
pub struct RevenueReportReviewed {
    #[topic]
    pub offering_id: u32,
    #[topic]
    pub report_id: u32,
    pub approved: bool,
    pub amount: i128,
}

/// Emitted when an approved report is distributed pro-rata.
#[contractevent]
pub struct RevenueRecorded {
    #[topic]
    pub offering_id: u32,
    #[topic]
    pub event_id: u64,
    pub amount: i128,
}

#[contractevent]
pub struct ClaimRecorded {
    #[topic]
    pub offering_id: u32,
    #[topic]
    pub investor: Address,
    pub amount: i128,
}

#[contract]
pub struct MinkaMarket;

#[contractimpl]
impl MinkaMarket {
    /// Configures the Testnet-only platform and its settlement asset. Runs
    /// atomically with deployment, so no one can initialize it first.
    pub fn __constructor(env: Env, admin: Address, usdc: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Usdc, &usdc);
        env.storage()
            .instance()
            .set(&DataKey::OfferingCount, &0_u32);
        Self::extend_instance(&env);
    }

    // ---------------------------------------------------------------------
    // Platform administration (Minka)
    // ---------------------------------------------------------------------

    /// Approves or revokes a company that may publish offerings.
    pub fn set_issuer_status(env: Env, admin: Address, issuer: Address, approved: bool) {
        Self::require_admin(&env, &admin);
        Self::save_flag(&env, DataKey::Issuer(issuer.clone()), approved);
        IssuerStatusChanged { issuer, approved }.publish(&env);
    }

    /// Approves or revokes an investor wallet for every offering (demo KYC).
    pub fn set_investor_status(env: Env, admin: Address, investor: Address, approved: bool) {
        Self::require_admin(&env, &admin);
        Self::save_flag(&env, DataKey::Investor(investor.clone()), approved);
        InvestorStatusChanged { investor, approved }.publish(&env);
    }

    // ---------------------------------------------------------------------
    // Issuer operations (the startup)
    // ---------------------------------------------------------------------

    /// Publishes a new revenue-share offering and returns its id.
    pub fn create_offering(
        env: Env,
        issuer: Address,
        name: String,
        symbol: String,
        unit_price: i128,
        target_units: i128,
    ) -> u32 {
        issuer.require_auth();
        ensure(
            &env,
            Self::flag(&env, &DataKey::Issuer(issuer.clone())),
            Error::IssuerNotApproved,
        );
        ensure(
            &env,
            name.len() > 0 && name.len() <= MAX_NAME_LEN,
            Error::InvalidConfig,
        );
        ensure(
            &env,
            symbol.len() > 0 && symbol.len() <= MAX_SYMBOL_LEN,
            Error::InvalidConfig,
        );
        ensure(
            &env,
            unit_price > 0 && target_units > 0,
            Error::InvalidConfig,
        );

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::OfferingCount)
            .unwrap_or(0);
        let offering = Offering {
            id,
            issuer: issuer.clone(),
            name: name.clone(),
            symbol: symbol.clone(),
            unit_price,
            target_units,
            sold_units: 0,
            revenue_per_unit_scaled: 0,
            paused: false,
            raised: 0,
            available: 0,
            allocated: 0,
        };
        Self::save_offering(&env, &offering);
        env.storage()
            .instance()
            .set(&DataKey::OfferingCount, &(id + 1));
        OfferingCreated {
            offering_id: id,
            issuer,
            name,
            symbol,
            unit_price,
            target_units,
        }
        .publish(&env);
        id
    }

    /// Adjusts price and size. Before the first sale both are free to change;
    /// afterwards the price is locked (every investor pays the same) and the
    /// offering can only grow.
    pub fn update_offering(
        env: Env,
        issuer: Address,
        offering_id: u32,
        unit_price: i128,
        target_units: i128,
    ) {
        let mut offering = Self::offering_for_issuer(&env, &issuer, offering_id);
        ensure(
            &env,
            unit_price > 0 && target_units > 0,
            Error::InvalidConfig,
        );
        if offering.sold_units > 0 {
            ensure(
                &env,
                unit_price == offering.unit_price && target_units >= offering.target_units,
                Error::OfferingLocked,
            );
        }
        offering.unit_price = unit_price;
        offering.target_units = target_units;
        Self::save_offering(&env, &offering);
        OfferingUpdated {
            offering_id,
            unit_price,
            target_units,
        }
        .publish(&env);
    }

    /// Stops or resumes new investments. Claims keep working while paused.
    /// Callable by the issuer or by the platform admin.
    pub fn set_paused(env: Env, caller: Address, offering_id: u32, paused: bool) {
        caller.require_auth();
        let mut offering = Self::offering(&env, offering_id);
        ensure(
            &env,
            caller == offering.issuer || caller == Self::admin(&env),
            Error::NotIssuer,
        );
        offering.paused = paused;
        Self::save_offering(&env, &offering);
        OfferingPauseChanged {
            offering_id,
            paused,
        }
        .publish(&env);
    }

    /// Releases raised capital to the issuer's chosen wallet. Distribution
    /// funds are never touched.
    pub fn withdraw_raise(env: Env, issuer: Address, offering_id: u32, to: Address, amount: i128) {
        let mut offering = Self::offering_for_issuer(&env, &issuer, offering_id);
        ensure(&env, amount > 0, Error::InvalidAmount);
        ensure(
            &env,
            offering.raised >= amount,
            Error::InsufficientRaisedCapital,
        );
        offering.raised -= amount;
        Self::save_offering(&env, &offering);

        Self::token(&env).transfer(
            &env.current_contract_address(),
            &MuxedAddress::from(to.clone()),
            &amount,
        );
        RaiseWithdrawn {
            offering_id,
            to,
            amount,
        }
        .publish(&env);
    }

    // ---------------------------------------------------------------------
    // Revenue reporting: Minka allows it, the issuer deposits, Minka approves
    // ---------------------------------------------------------------------

    /// Allows or stops an offering's issuer from submitting revenue reports.
    /// Reports already pending can still be reviewed.
    pub fn set_revenue_reporting(env: Env, admin: Address, offering_id: u32, enabled: bool) {
        Self::require_admin(&env, &admin);
        Self::offering(&env, offering_id);
        Self::save_flag(&env, DataKey::RevenueReporting(offering_id), enabled);
        RevenueReportingChanged {
            offering_id,
            enabled,
        }
        .publish(&env);
    }

    /// The issuer reports revenue for a sale or period and deposits the USDC
    /// that backs it. Funds stay escrowed as `available` until Minka reviews
    /// the report. `reference` is the issuer's own unique id (anti-replay).
    pub fn submit_revenue_report(
        env: Env,
        issuer: Address,
        offering_id: u32,
        reference: u64,
        amount: i128,
    ) -> u32 {
        let mut offering = Self::offering_for_issuer(&env, &issuer, offering_id);
        ensure(
            &env,
            Self::flag(&env, &DataKey::RevenueReporting(offering_id)),
            Error::RevenueReportingDisabled,
        );
        ensure(&env, amount > 0, Error::InvalidAmount);
        let reference_key = DataKey::RevenueEvent(offering_id, reference);
        ensure(
            &env,
            !env.storage().persistent().has(&reference_key),
            Error::DuplicateRevenueEvent,
        );

        Self::token(&env).transfer(
            &issuer,
            &MuxedAddress::from(env.current_contract_address()),
            &amount,
        );
        offering.available = offering
            .available
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));

        let count_key = DataKey::ReportCount(offering_id);
        let report_id: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        let report = RevenueReport {
            id: report_id,
            offering_id,
            reference,
            amount,
            status: ReportStatus::Pending,
            submitted_at: env.ledger().timestamp(),
        };
        Self::save_persistent(&env, &DataKey::Report(offering_id, report_id), &report);
        Self::save_persistent(&env, &count_key, &(report_id + 1));
        Self::save_persistent(&env, &reference_key, &true);
        Self::save_offering(&env, &offering);
        RevenueReportSubmitted {
            offering_id,
            report_id,
            reference,
            amount,
        }
        .publish(&env);
        report_id
    }

    /// Minka approves a pending report: its deposit moves from `available` to
    /// `allocated` and is distributed pro-rata, so investors can claim it.
    pub fn approve_revenue_report(env: Env, admin: Address, offering_id: u32, report_id: u32) {
        Self::require_admin(&env, &admin);
        let mut offering = Self::offering(&env, offering_id);
        let mut report = Self::pending_report(&env, offering_id, report_id);
        ensure(&env, offering.sold_units > 0, Error::NoInvestors);
        ensure(
            &env,
            offering.available >= report.amount,
            Error::InsufficientDistributionFunds,
        );

        offering.available -= report.amount;
        offering.allocated += report.amount;
        let increment = report
            .amount
            .checked_mul(SCALE)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow))
            / offering.sold_units;
        offering.revenue_per_unit_scaled += increment;
        report.status = ReportStatus::Approved;

        Self::save_persistent(&env, &DataKey::Report(offering_id, report_id), &report);
        Self::save_offering(&env, &offering);
        RevenueReportReviewed {
            offering_id,
            report_id,
            approved: true,
            amount: report.amount,
        }
        .publish(&env);
        RevenueRecorded {
            offering_id,
            event_id: report.reference,
            amount: report.amount,
        }
        .publish(&env);
    }

    /// Minka rejects a pending report and returns its deposit to the issuer.
    pub fn reject_revenue_report(env: Env, admin: Address, offering_id: u32, report_id: u32) {
        Self::require_admin(&env, &admin);
        let mut offering = Self::offering(&env, offering_id);
        let mut report = Self::pending_report(&env, offering_id, report_id);
        ensure(
            &env,
            offering.available >= report.amount,
            Error::InsufficientDistributionFunds,
        );

        offering.available -= report.amount;
        report.status = ReportStatus::Rejected;
        Self::save_persistent(&env, &DataKey::Report(offering_id, report_id), &report);
        Self::save_offering(&env, &offering);

        Self::token(&env).transfer(
            &env.current_contract_address(),
            &MuxedAddress::from(offering.issuer.clone()),
            &report.amount,
        );
        RevenueReportReviewed {
            offering_id,
            report_id,
            approved: false,
            amount: report.amount,
        }
        .publish(&env);
    }

    // ---------------------------------------------------------------------
    // Investor operations
    // ---------------------------------------------------------------------

    /// Escrows the configured Testnet SAC asset for a primary-market investment.
    pub fn invest(env: Env, investor: Address, offering_id: u32, units: i128) {
        investor.require_auth();
        ensure(&env, units > 0, Error::InvalidAmount);
        ensure(
            &env,
            Self::flag(&env, &DataKey::Investor(investor.clone())),
            Error::InvestorNotApproved,
        );

        let mut offering = Self::offering(&env, offering_id);
        ensure(&env, !offering.paused, Error::OfferingPaused);
        let sold_units = offering
            .sold_units
            .checked_add(units)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));
        ensure(
            &env,
            sold_units <= offering.target_units,
            Error::OfferingOversubscribed,
        );
        let payment = units
            .checked_mul(offering.unit_price)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));

        Self::token(&env).transfer(
            &investor,
            &MuxedAddress::from(env.current_contract_address()),
            &payment,
        );

        let mut position = Self::position(&env, offering_id, &investor);
        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);
        position.units += units;
        offering.sold_units = sold_units;
        offering.raised = offering
            .raised
            .checked_add(payment)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ArithmeticOverflow));

        Self::save_position(&env, offering_id, &investor, &position);
        Self::save_offering(&env, &offering);
        InvestmentRecorded {
            offering_id,
            investor,
            units,
            amount: payment,
        }
        .publish(&env);
    }

    /// Settles accounting and transfers the backed USDC amount to the wallet.
    pub fn claim(env: Env, investor: Address, offering_id: u32) -> i128 {
        investor.require_auth();
        let mut offering = Self::offering(&env, offering_id);
        let mut position = Self::position(&env, offering_id, &investor);
        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);

        let amount = position.claimable;
        ensure(&env, amount > 0, Error::NothingToClaim);
        ensure(
            &env,
            offering.allocated >= amount,
            Error::InsufficientDistributionFunds,
        );
        offering.allocated -= amount;
        position.claimable = 0;
        Self::save_position(&env, offering_id, &investor, &position);
        Self::save_offering(&env, &offering);

        Self::token(&env).transfer(
            &env.current_contract_address(),
            &MuxedAddress::from(investor.clone()),
            &amount,
        );
        ClaimRecorded {
            offering_id,
            investor,
            amount,
        }
        .publish(&env);
        amount
    }

    // ---------------------------------------------------------------------
    // Reads
    // ---------------------------------------------------------------------

    pub fn get_admin(env: Env) -> Address {
        Self::admin(&env)
    }

    pub fn get_usdc(env: Env) -> Address {
        Self::usdc(&env)
    }

    pub fn get_offering_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::OfferingCount)
            .unwrap_or(0)
    }

    pub fn get_offering(env: Env, offering_id: u32) -> Offering {
        Self::offering(&env, offering_id)
    }

    /// Every offering, oldest first. Sized for a demo catalogue.
    pub fn get_offerings(env: Env) -> Vec<Offering> {
        let mut offerings = Vec::new(&env);
        for id in 0..Self::get_offering_count(env.clone()) {
            offerings.push_back(Self::offering(&env, id));
        }
        offerings
    }

    pub fn get_position(env: Env, offering_id: u32, investor: Address) -> Position {
        let offering = Self::offering(&env, offering_id);
        let mut position = Self::position(&env, offering_id, &investor);
        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);
        position
    }

    pub fn is_issuer(env: Env, account: Address) -> bool {
        Self::flag(&env, &DataKey::Issuer(account))
    }

    pub fn is_investor_approved(env: Env, account: Address) -> bool {
        Self::flag(&env, &DataKey::Investor(account))
    }

    pub fn is_revenue_reporting_enabled(env: Env, offering_id: u32) -> bool {
        Self::flag(&env, &DataKey::RevenueReporting(offering_id))
    }

    pub fn get_revenue_report(env: Env, offering_id: u32, report_id: u32) -> RevenueReport {
        Self::report(&env, offering_id, report_id)
    }

    /// Every report of an offering, oldest first. Sized for a demo.
    pub fn get_revenue_reports(env: Env, offering_id: u32) -> Vec<RevenueReport> {
        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::ReportCount(offering_id))
            .unwrap_or(0);
        let mut reports = Vec::new(&env);
        for id in 0..count {
            reports.push_back(Self::report(&env, offering_id, id));
        }
        reports
    }

    pub fn is_revenue_event_processed(env: Env, offering_id: u32, event_id: u64) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::RevenueEvent(offering_id, event_id))
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn require_admin(env: &Env, supplied_admin: &Address) {
        ensure(env, Self::admin(env) == *supplied_admin, Error::NotAdmin);
        supplied_admin.require_auth();
    }

    /// Loads an offering and checks that `issuer` owns it and signed the call.
    fn offering_for_issuer(env: &Env, issuer: &Address, offering_id: u32) -> Offering {
        issuer.require_auth();
        let offering = Self::offering(env, offering_id);
        ensure(env, offering.issuer == *issuer, Error::NotIssuer);
        offering
    }

    fn report(env: &Env, offering_id: u32, report_id: u32) -> RevenueReport {
        env.storage()
            .persistent()
            .get(&DataKey::Report(offering_id, report_id))
            .unwrap_or_else(|| panic_with_error!(env, Error::ReportNotFound))
    }

    fn pending_report(env: &Env, offering_id: u32, report_id: u32) -> RevenueReport {
        let report = Self::report(env, offering_id, report_id);
        ensure(
            env,
            report.status == ReportStatus::Pending,
            Error::ReportAlreadyReviewed,
        );
        report
    }

    fn usdc(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Usdc).unwrap()
    }

    fn token(env: &Env) -> token::TokenClient<'_> {
        token::TokenClient::new(env, &Self::usdc(env))
    }

    fn offering(env: &Env, offering_id: u32) -> Offering {
        env.storage()
            .persistent()
            .get(&DataKey::Offering(offering_id))
            .unwrap_or_else(|| panic_with_error!(env, Error::OfferingNotFound))
    }

    fn save_offering(env: &Env, offering: &Offering) {
        Self::save_persistent(env, &DataKey::Offering(offering.id), offering);
    }

    fn flag(env: &Env, key: &DataKey) -> bool {
        env.storage().persistent().get(key).unwrap_or(false)
    }

    fn save_flag(env: &Env, key: DataKey, value: bool) {
        Self::save_persistent(env, &key, &value);
    }

    fn position(env: &Env, offering_id: u32, investor: &Address) -> Position {
        env.storage()
            .persistent()
            .get(&DataKey::Position(offering_id, investor.clone()))
            .unwrap_or(Position {
                units: 0,
                revenue_checkpoint_scaled: 0,
                claimable: 0,
            })
    }

    fn save_position(env: &Env, offering_id: u32, investor: &Address, position: &Position) {
        Self::save_persistent(
            env,
            &DataKey::Position(offering_id, investor.clone()),
            position,
        );
    }

    fn save_persistent<V>(env: &Env, key: &DataKey, value: &V)
    where
        V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Self::extend_instance(env);
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    fn settle_position(position: &mut Position, revenue_per_unit_scaled: i128) {
        let delta = revenue_per_unit_scaled - position.revenue_checkpoint_scaled;
        if position.units > 0 && delta > 0 {
            position.claimable += position.units * delta / SCALE;
        }
        position.revenue_checkpoint_scaled = revenue_per_unit_scaled;
    }
}

#[cfg(test)]
mod test;
