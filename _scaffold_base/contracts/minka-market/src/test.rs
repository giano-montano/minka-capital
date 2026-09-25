extern crate std;

use soroban_sdk::{Address, Env, String, testutils::Address as _, token};

use crate::{MinkaMarket, MinkaMarketClient};

struct Setup<'a> {
    env: &'a Env,
    client: MinkaMarketClient<'a>,
    admin: Address,
    issuer: Address,
    alice: Address,
    bob: Address,
    contract_id: Address,
    token: token::TokenClient<'a>,
    issuer_mint: token::StellarAssetClient<'a>,
    /// First offering: LUMI-RSN, 100 atomic units per unit, 100 units.
    lumi: u32,
}

impl<'a> Setup<'a> {
    fn create(&self, issuer: &Address, symbol: &str, price: i128, units: i128) -> u32 {
        self.client.create_offering(
            issuer,
            &String::from_str(self.env, "Startup demo"),
            &String::from_str(self.env, symbol),
            &price,
            &units,
        )
    }
}

fn setup(env: &Env) -> Setup<'_> {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let issuer = Address::generate(env);
    let alice = Address::generate(env);
    let bob = Address::generate(env);
    let asset = env.register_stellar_asset_contract_v2(admin.clone());
    let contract_id = env.register(MinkaMarket, (admin.clone(), asset.address()));
    let client = MinkaMarketClient::new(env, &contract_id);
    client.set_issuer_status(&admin, &issuer, &true);
    client.set_investor_status(&admin, &alice, &true);
    client.set_investor_status(&admin, &bob, &true);

    let token = token::TokenClient::new(env, &asset.address());
    let issuer_mint = token::StellarAssetClient::new(env, &asset.address());
    issuer_mint.mint(&alice, &10_000);
    issuer_mint.mint(&bob, &10_000);
    issuer_mint.mint(&issuer, &5_000);

    let mut s = Setup {
        env,
        client,
        admin,
        issuer,
        alice,
        bob,
        contract_id,
        token,
        issuer_mint,
        lumi: 0,
    };
    s.lumi = s.create(&s.issuer.clone(), "LUMI-RSN", 100, 100);
    s
}

#[test]
fn constructor_and_issuer_create_offering() {
    let env = Env::default();
    let s = setup(&env);
    assert_eq!(s.client.get_admin(), s.admin);
    assert_eq!(s.client.get_usdc(), s.token.address);
    assert_eq!(s.client.get_offering_count(), 1);
    assert!(s.client.is_issuer(&s.issuer));
    assert!(s.client.is_investor_approved(&s.alice));

    let offering = s.client.get_offering(&s.lumi);
    assert_eq!(offering.issuer, s.issuer);
    assert_eq!(offering.symbol, String::from_str(&env, "LUMI-RSN"));
    assert_eq!(offering.unit_price, 100);
    assert_eq!(offering.target_units, 100);
    assert_eq!(
        (offering.raised, offering.available, offering.allocated),
        (0, 0, 0)
    );
}

#[test]
fn offerings_get_sequential_ids_and_are_listed() {
    let env = Env::default();
    let s = setup(&env);
    let second = s.create(&s.issuer, "SECOND", 50, 10);
    assert_eq!(second, 1);
    let all = s.client.get_offerings();
    assert_eq!(all.len(), 2);
    assert_eq!(all.get(1).unwrap().unit_price, 50);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn unapproved_company_cannot_publish() {
    let env = Env::default();
    let s = setup(&env);
    let stranger = Address::generate(&env);
    s.create(&stranger, "NOPE", 100, 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_zero_price() {
    let env = Env::default();
    let s = setup(&env);
    s.create(&s.issuer, "ZERO", 0, 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_symbol_longer_than_twelve_chars() {
    let env = Env::default();
    let s = setup(&env);
    s.create(&s.issuer, "THIRTEENCHARS", 100, 100);
}

#[test]
fn issuer_can_reprice_before_first_sale() {
    let env = Env::default();
    let s = setup(&env);
    s.client.update_offering(&s.issuer, &s.lumi, &250, &40);
    let offering = s.client.get_offering(&s.lumi);
    assert_eq!((offering.unit_price, offering.target_units), (250, 40));
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn price_is_locked_after_first_sale() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.update_offering(&s.issuer, &s.lumi, &200, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn offering_cannot_shrink_after_first_sale() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.update_offering(&s.issuer, &s.lumi, &100, &99);
}

#[test]
fn offering_can_grow_after_first_sale() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &100);
    s.client.update_offering(&s.issuer, &s.lumi, &100, &150);
    s.client.invest(&s.bob, &s.lumi, &50);
    assert_eq!(s.client.get_offering(&s.lumi).sold_units, 150);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn other_company_cannot_edit_offering() {
    let env = Env::default();
    let s = setup(&env);
    let rival = Address::generate(&env);
    s.client.set_issuer_status(&s.admin, &rival, &true);
    s.client.update_offering(&rival, &s.lumi, &1, &1);
}

#[test]
fn escrows_investment_at_offering_price() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &60);
    assert_eq!(s.token.balance(&s.alice), 4_000);
    assert_eq!(s.token.balance(&s.contract_id), 6_000);
    assert_eq!(s.client.get_position(&s.lumi, &s.alice).units, 60);
    assert_eq!(s.client.get_offering(&s.lumi).raised, 6_000);
}

#[test]
fn transfers_claimable_usdc_pro_rata_and_resets_claim() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &60);
    s.client.invest(&s.bob, &s.lumi, &40);
    s.client.fund_distributions(&s.issuer, &s.lumi, &1_000);
    s.client.record_revenue(&s.issuer, &s.lumi, &1, &1_000);

    let offering = s.client.get_offering(&s.lumi);
    assert_eq!((offering.available, offering.allocated), (0, 1_000));
    assert_eq!(s.client.get_position(&s.lumi, &s.alice).claimable, 600);
    assert_eq!(s.client.get_position(&s.lumi, &s.bob).claimable, 400);
    assert_eq!(s.client.claim(&s.alice, &s.lumi), 600);
    assert_eq!(s.client.get_position(&s.lumi, &s.alice).claimable, 0);
    assert_eq!(s.token.balance(&s.alice), 4_600);
    assert_eq!(s.client.get_offering(&s.lumi).allocated, 400);
    assert!(s.client.is_revenue_event_processed(&s.lumi, &1));
}

#[test]
fn offerings_have_isolated_treasuries_and_positions() {
    let env = Env::default();
    let s = setup(&env);
    let other = s.create(&s.issuer, "OTHER", 10, 1_000);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.invest(&s.bob, &other, &100);
    s.client.fund_distributions(&s.issuer, &s.lumi, &500);
    s.client.record_revenue(&s.issuer, &s.lumi, &1, &500);

    assert_eq!(s.client.get_position(&s.lumi, &s.alice).claimable, 500);
    assert_eq!(s.client.get_position(&other, &s.bob).claimable, 0);
    assert_eq!(s.client.get_offering(&other).raised, 1_000);
    assert_eq!(s.client.get_offering(&other).allocated, 0);
    // The same event id is independent per offering.
    s.client.fund_distributions(&s.issuer, &other, &100);
    s.client.record_revenue(&s.issuer, &other, &1, &100);
    assert_eq!(s.client.get_position(&other, &s.bob).claimable, 100);
}

#[test]
fn late_investor_does_not_receive_earlier_revenue() {
    let env = Env::default();
    let s = setup(&env);
    s.client.fund_distributions(&s.issuer, &s.lumi, &2_000);
    s.client.invest(&s.alice, &s.lumi, &50);
    s.client.record_revenue(&s.issuer, &s.lumi, &1, &1_000);
    s.client.invest(&s.bob, &s.lumi, &50);
    s.client.record_revenue(&s.issuer, &s.lumi, &2, &1_000);

    assert_eq!(s.client.claim(&s.alice, &s.lumi), 1_500);
    assert_eq!(s.client.claim(&s.bob, &s.lumi), 500);
    assert_eq!(s.client.get_offering(&s.lumi).allocated, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn one_deposit_cannot_back_two_revenue_events() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &100);
    s.client.fund_distributions(&s.issuer, &s.lumi, &1_000);
    s.client.record_revenue(&s.issuer, &s.lumi, &1, &1_000);
    s.client.record_revenue(&s.issuer, &s.lumi, &2, &1_000);
}

#[test]
fn issuer_withdraws_raise_and_claims_never_spend_it() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &100);
    s.client.fund_distributions(&s.issuer, &s.lumi, &1_000);
    s.client.record_revenue(&s.issuer, &s.lumi, &1, &1_000);
    s.client.claim(&s.alice, &s.lumi);
    assert_eq!(s.token.balance(&s.contract_id), 10_000);

    s.client
        .withdraw_raise(&s.issuer, &s.lumi, &s.issuer, &10_000);
    assert_eq!(s.token.balance(&s.issuer), 5_000 - 1_000 + 10_000);
    assert_eq!(s.token.balance(&s.contract_id), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn withdraw_raise_cannot_touch_distribution_funds() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.fund_distributions(&s.issuer, &s.lumi, &1_000);
    s.client
        .withdraw_raise(&s.issuer, &s.lumi, &s.issuer, &1_001);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn platform_admin_cannot_withdraw_company_raise() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.withdraw_raise(&s.admin, &s.lumi, &s.admin, &1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_investment_while_paused() {
    let env = Env::default();
    let s = setup(&env);
    s.client.set_paused(&s.issuer, &s.lumi, &true);
    s.client.invest(&s.alice, &s.lumi, &10);
}

#[test]
fn platform_admin_can_pause_and_claims_still_work() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.fund_distributions(&s.issuer, &s.lumi, &100);
    s.client.record_revenue(&s.issuer, &s.lumi, &1, &100);
    s.client.set_paused(&s.admin, &s.lumi, &true);
    assert_eq!(s.client.claim(&s.alice, &s.lumi), 100);
    s.client.set_paused(&s.issuer, &s.lumi, &false);
    s.client.invest(&s.alice, &s.lumi, &10);
    assert_eq!(s.client.get_position(&s.lumi, &s.alice).units, 20);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_an_unapproved_investor() {
    let env = Env::default();
    let s = setup(&env);
    let unapproved = Address::generate(&env);
    s.issuer_mint.mint(&unapproved, &1_000);
    s.client.invest(&unapproved, &s.lumi, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn rejects_oversubscription() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &60);
    s.client.invest(&s.bob, &s.lumi, &41);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn only_platform_admin_approves_investors() {
    let env = Env::default();
    let s = setup(&env);
    s.client
        .set_investor_status(&s.issuer, &Address::generate(&env), &true);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn only_issuer_records_revenue() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.record_revenue(&s.admin, &s.lumi, &1, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn rejects_duplicate_revenue_events() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &100);
    s.client.fund_distributions(&s.issuer, &s.lumi, &2_000);
    s.client.record_revenue(&s.issuer, &s.lumi, &7, &1_000);
    s.client.record_revenue(&s.issuer, &s.lumi, &7, &1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn rejects_unknown_offering() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &99, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn rejects_empty_claim() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &s.lumi, &10);
    s.client.claim(&s.alice, &s.lumi);
}
