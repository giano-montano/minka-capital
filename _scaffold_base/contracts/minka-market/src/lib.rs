#![no_std]

use soroban_sdk::{
    Address, Env, MuxedAddress, contract, contractevent, contractimpl, contracttype, token,
};

const SCALE: i128 = 10_000_000;

// ~5s ledgers: keep state alive for 30 days, bumping once less than 7 days remain.
const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Usdc,
    UnitPrice,
    Treasury,
    Offering,
    Position(Address),
    RevenueEvent(u64),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Offering {
    pub target_units: i128,
    pub sold_units: i128,
    pub revenue_per_unit_scaled: i128,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub approved: bool,
    pub units: i128,
    pub revenue_checkpoint_scaled: i128,
    pub claimable: i128,
}

/// Segregated contract balances: every token held by the contract belongs to
/// exactly one bucket, so offering capital can never back a distribution.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Treasury {
    /// Investment capital not yet withdrawn to the startup.
    pub raised: i128,
    /// Funded distributions not yet assigned to a revenue event.
    pub available: i128,
    /// Distributions assigned to revenue events and owed to investors.
    /// Rounding dust from pro-rata division stays here.
    pub allocated: i128,
}

#[contractevent]
pub struct OfferingCreated {
    pub target_units: i128,
    pub unit_price: i128,
}

#[contractevent]
pub struct OfferingPauseChanged {
    pub paused: bool,
}

#[contractevent]
pub struct InvestorStatusChanged {
    #[topic]
    pub investor: Address,
    pub approved: bool,
}

#[contractevent]
pub struct InvestmentRecorded {
    #[topic]
    pub investor: Address,
    pub units: i128,
    pub amount: i128,
}

#[contractevent]
pub struct RaiseWithdrawn {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct DistributionFunded {
    pub amount: i128,
}

#[contractevent]
pub struct RevenueRecorded {
    #[topic]
    pub event_id: u64,
    pub amount: i128,
}

#[contractevent]
pub struct ClaimRecorded {
    #[topic]
    pub investor: Address,
    pub amount: i128,
}

#[contract]
pub struct MinkaMarket;

#[contractimpl]
impl MinkaMarket {
    /// Creates a Testnet-only primary offering backed by a configured SAC asset.
    /// Runs atomically with deployment, so no one can initialize it first.
    pub fn __constructor(
        env: Env,
        admin: Address,
        usdc: Address,
        unit_price: i128,
        target_units: i128,
    ) {
        assert!(target_units > 0, "target units must be positive");
        assert!(unit_price > 0, "unit price must be positive");

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Usdc, &usdc);
        env.storage()
            .instance()
            .set(&DataKey::UnitPrice, &unit_price);
        Self::save_treasury(
            &env,
            &Treasury {
                raised: 0,
                available: 0,
                allocated: 0,
            },
        );
        Self::save_offering(
            &env,
            &Offering {
                target_units,
                sold_units: 0,
                revenue_per_unit_scaled: 0,
                paused: false,
            },
        );
        Self::extend_instance(&env);
        OfferingCreated {
            target_units,
            unit_price,
        }
        .publish(&env);
    }

    pub fn set_investor_status(env: Env, admin: Address, investor: Address, approved: bool) {
        Self::admin(&env, &admin);
        let mut position = Self::position(&env, &investor);
        position.approved = approved;
        Self::save_position(&env, &investor, &position);
        InvestorStatusChanged { investor, approved }.publish(&env);
    }

    /// Stops or resumes new investments. Claims keep working while paused.
    pub fn set_paused(env: Env, admin: Address, paused: bool) {
        Self::admin(&env, &admin);
        let mut offering = Self::offering(&env);
        offering.paused = paused;
        Self::save_offering(&env, &offering);
        OfferingPauseChanged { paused }.publish(&env);
    }

    /// Escrows the configured Testnet SAC asset for a primary-market investment.
    pub fn invest(env: Env, investor: Address, units: i128) {
        investor.require_auth();
        assert!(units > 0, "units must be positive");

        let mut offering = Self::offering(&env);
        assert!(!offering.paused, "offering is paused");
        let mut position = Self::position(&env, &investor);
        assert!(position.approved, "investor is not approved");
        let sold_units = offering
            .sold_units
            .checked_add(units)
            .expect("units overflow");
        assert!(
            sold_units <= offering.target_units,
            "offering oversubscribed"
        );

        let payment = units
            .checked_mul(Self::unit_price(&env))
            .expect("investment payment overflow");
        Self::token(&env).transfer(
            &investor,
            &MuxedAddress::from(env.current_contract_address()),
            &payment,
        );

        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);
        position.units += units;
        offering.sold_units = sold_units;

        let mut treasury = Self::treasury(&env);
        treasury.raised = treasury
            .raised
            .checked_add(payment)
            .expect("raised capital overflow");

        Self::save_position(&env, &investor, &position);
        Self::save_offering(&env, &offering);
        Self::save_treasury(&env, &treasury);
        InvestmentRecorded {
            investor,
            units,
            amount: payment,
        }
        .publish(&env);
    }

    /// Releases raised offering capital to the startup's wallet. Distribution
    /// funds are never touched.
    pub fn withdraw_raise(env: Env, admin: Address, to: Address, amount: i128) {
        Self::admin(&env, &admin);
        assert!(amount > 0, "withdrawal amount must be positive");

        let mut treasury = Self::treasury(&env);
        assert!(treasury.raised >= amount, "insufficient raised capital");
        treasury.raised -= amount;
        Self::save_treasury(&env, &treasury);

        Self::token(&env).transfer(
            &env.current_contract_address(),
            &MuxedAddress::from(to.clone()),
            &amount,
        );
        RaiseWithdrawn { to, amount }.publish(&env);
    }

    /// Deposits Testnet USDC that backs future pro-rata claims without touching
    /// primary-offering capital.
    pub fn fund_distributions(env: Env, admin: Address, amount: i128) {
        Self::admin(&env, &admin);
        assert!(amount > 0, "distribution amount must be positive");

        Self::token(&env).transfer(
            &admin,
            &MuxedAddress::from(env.current_contract_address()),
            &amount,
        );

        let mut treasury = Self::treasury(&env);
        treasury.available = treasury
            .available
            .checked_add(amount)
            .expect("distribution pool overflow");
        Self::save_treasury(&env, &treasury);
        DistributionFunded { amount }.publish(&env);
    }

    /// Accepts one funded, idempotent revenue event and makes its return claimable
    /// pro-rata. The amount moves from `available` to `allocated`, so a single
    /// deposit can never back two revenue events.
    pub fn record_revenue(env: Env, admin: Address, event_id: u64, amount: i128) {
        Self::admin(&env, &admin);
        assert!(amount > 0, "revenue must be positive");
        let event_key = DataKey::RevenueEvent(event_id);
        assert!(
            !env.storage().persistent().has(&event_key),
            "revenue event already processed"
        );

        let mut offering = Self::offering(&env);
        assert!(offering.sold_units > 0, "no investors to distribute to");
        let mut treasury = Self::treasury(&env);
        assert!(
            treasury.available >= amount,
            "distribution treasury insufficient"
        );
        treasury.available -= amount;
        treasury.allocated += amount;

        let increment =
            amount.checked_mul(SCALE).expect("revenue amount overflow") / offering.sold_units;
        offering.revenue_per_unit_scaled += increment;

        env.storage().persistent().set(&event_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&event_key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Self::save_offering(&env, &offering);
        Self::save_treasury(&env, &treasury);
        RevenueRecorded { event_id, amount }.publish(&env);
    }

    /// Settles accounting and transfers the backed Testnet SAC amount to the wallet.
    pub fn claim(env: Env, investor: Address) -> i128 {
        investor.require_auth();
        let offering = Self::offering(&env);
        let mut position = Self::position(&env, &investor);
        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);

        let amount = position.claimable;
        assert!(amount > 0, "nothing to claim");
        let mut treasury = Self::treasury(&env);
        assert!(
            treasury.allocated >= amount,
            "distribution treasury insufficient"
        );
        treasury.allocated -= amount;
        position.claimable = 0;
        Self::save_position(&env, &investor, &position);
        Self::save_treasury(&env, &treasury);

        Self::token(&env).transfer(
            &env.current_contract_address(),
            &MuxedAddress::from(investor.clone()),
            &amount,
        );
        ClaimRecorded { investor, amount }.publish(&env);
        amount
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn get_offering(env: Env) -> Offering {
        Self::offering(&env)
    }

    pub fn get_position(env: Env, investor: Address) -> Position {
        let offering = Self::offering(&env);
        let mut position = Self::position(&env, &investor);
        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);
        position
    }

    pub fn get_treasury(env: Env) -> Treasury {
        Self::treasury(&env)
    }

    pub fn get_usdc(env: Env) -> Address {
        Self::usdc(&env)
    }

    pub fn get_unit_price(env: Env) -> i128 {
        Self::unit_price(&env)
    }

    pub fn is_revenue_event_processed(env: Env, event_id: u64) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::RevenueEvent(event_id))
    }

    fn admin(env: &Env, supplied_admin: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(admin == *supplied_admin, "administrator mismatch");
        supplied_admin.require_auth();
    }

    fn token(env: &Env) -> token::TokenClient<'_> {
        token::TokenClient::new(env, &Self::usdc(env))
    }

    fn offering(env: &Env) -> Offering {
        env.storage().instance().get(&DataKey::Offering).unwrap()
    }

    fn usdc(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Usdc).unwrap()
    }

    fn unit_price(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::UnitPrice).unwrap()
    }

    fn treasury(env: &Env) -> Treasury {
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    fn save_treasury(env: &Env, treasury: &Treasury) {
        env.storage().instance().set(&DataKey::Treasury, treasury);
        Self::extend_instance(env);
    }

    fn save_offering(env: &Env, offering: &Offering) {
        env.storage().instance().set(&DataKey::Offering, offering);
        Self::extend_instance(env);
    }

    fn extend_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    fn position(env: &Env, investor: &Address) -> Position {
        env.storage()
            .persistent()
            .get(&DataKey::Position(investor.clone()))
            .unwrap_or(Position {
                approved: false,
                units: 0,
                revenue_checkpoint_scaled: 0,
                claimable: 0,
            })
    }

    fn save_position(env: &Env, investor: &Address, position: &Position) {
        let key = DataKey::Position(investor.clone());
        env.storage().persistent().set(&key, position);
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
        Self::extend_instance(env);
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
