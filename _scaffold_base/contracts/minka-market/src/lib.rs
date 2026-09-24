#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env};

const SCALE: i128 = 10_000_000;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
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
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub approved: bool,
    pub units: i128,
    pub revenue_checkpoint_scaled: i128,
    pub claimable: i128,
}

#[contractevent]
pub struct OfferingCreated {
    pub target_units: i128,
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
    /// Creates a simulated primary offering. Monetary settlement is added in the
    /// next milestone through a USDC Stellar Asset Contract.
    pub fn initialize(env: Env, admin: Address, target_units: i128) {
        assert!(target_units > 0, "target units must be positive");
        assert!(!env.storage().instance().has(&DataKey::Admin), "already initialized");

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(
            &DataKey::Offering,
            &Offering {
                target_units,
                sold_units: 0,
                revenue_per_unit_scaled: 0,
            },
        );
        OfferingCreated { target_units }.publish(&env);
    }

    pub fn set_investor_status(env: Env, admin: Address, investor: Address, approved: bool) {
        Self::admin(&env, &admin);
        let mut position = Self::position(&env, &investor);
        position.approved = approved;
        Self::save_position(&env, &investor, &position);
        InvestorStatusChanged { investor, approved }.publish(&env);
    }

    /// Records a simulated primary-market investment in units of LUMI-RSN.
    pub fn invest(env: Env, investor: Address, units: i128) {
        investor.require_auth();
        assert!(units > 0, "units must be positive");

        let mut offering = Self::offering(&env);
        let mut position = Self::position(&env, &investor);
        assert!(position.approved, "investor is not approved");
        assert!(offering.sold_units + units <= offering.target_units, "offering oversubscribed");

        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);
        position.units += units;
        position.revenue_checkpoint_scaled = offering.revenue_per_unit_scaled;
        offering.sold_units += units;

        Self::save_position(&env, &investor, &position);
        Self::save_offering(&env, &offering);
        InvestmentRecorded { investor, units }.publish(&env);
    }

    /// Accepts one idempotent revenue event and makes its return claimable pro-rata.
    pub fn record_revenue(env: Env, admin: Address, event_id: u64, amount: i128) {
        Self::admin(&env, &admin);
        assert!(amount > 0, "revenue must be positive");
        assert!(
            !env.storage().persistent().has(&DataKey::RevenueEvent(event_id)),
            "revenue event already processed"
        );

        let mut offering = Self::offering(&env);
        assert!(offering.sold_units > 0, "no investors to distribute to");
        offering.revenue_per_unit_scaled += amount * SCALE / offering.sold_units;

        env.storage().persistent().set(&DataKey::RevenueEvent(event_id), &true);
        Self::save_offering(&env, &offering);
        RevenueRecorded { event_id, amount }.publish(&env);
    }

    /// Returns the amount currently owed to the wallet. The USDC transfer is
    /// deliberately separated until the SAC is wired into the Testnet deployment.
    pub fn claim(env: Env, investor: Address) -> i128 {
        investor.require_auth();
        let offering = Self::offering(&env);
        let mut position = Self::position(&env, &investor);
        Self::settle_position(&mut position, offering.revenue_per_unit_scaled);

        let amount = position.claimable;
        position.claimable = 0;
        Self::save_position(&env, &investor, &position);
        ClaimRecorded { investor, amount }.publish(&env);
        amount
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

    fn admin(env: &Env, supplied_admin: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(admin == *supplied_admin, "administrator mismatch");
        supplied_admin.require_auth();
    }

    fn offering(env: &Env) -> Offering {
        env.storage().instance().get(&DataKey::Offering).unwrap()
    }

    fn save_offering(env: &Env, offering: &Offering) {
        env.storage().instance().set(&DataKey::Offering, offering);
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
        env.storage()
            .persistent()
            .set(&DataKey::Position(investor.clone()), position);
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
