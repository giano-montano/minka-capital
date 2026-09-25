extern crate std;

use soroban_sdk::{Address, Env, testutils::Address as _, token};

use crate::{MinkaMarket, MinkaMarketClient, Treasury};

struct Setup<'a> {
    client: MinkaMarketClient<'a>,
    admin: Address,
    alice: Address,
    bob: Address,
    contract_id: Address,
    token: token::TokenClient<'a>,
    issuer: token::StellarAssetClient<'a>,
}

fn setup(env: &Env) -> Setup<'_> {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let alice = Address::generate(env);
    let bob = Address::generate(env);
    let asset = env.register_stellar_asset_contract_v2(admin.clone());
    let contract_id = env.register(
        MinkaMarket,
        (admin.clone(), asset.address(), 100_i128, 100_i128),
    );
    let client = MinkaMarketClient::new(env, &contract_id);
    client.set_investor_status(&admin, &alice, &true);
    client.set_investor_status(&admin, &bob, &true);
    let token = token::TokenClient::new(env, &asset.address());
    let issuer = token::StellarAssetClient::new(env, &asset.address());
    issuer.mint(&alice, &10_000);
    issuer.mint(&bob, &10_000);
    Setup {
        client,
        admin,
        alice,
        bob,
        contract_id,
        token,
        issuer,
    }
}

fn treasury(raised: i128, available: i128, allocated: i128) -> Treasury {
    Treasury {
        raised,
        available,
        allocated,
    }
}

#[test]
fn constructor_configures_offering_and_asset() {
    let env = Env::default();
    let s = setup(&env);
    assert_eq!(s.client.get_usdc(), s.token.address);
    assert_eq!(s.client.get_unit_price(), 100);
    assert_eq!(s.client.get_admin(), s.admin);
    assert_eq!(s.client.get_offering().target_units, 100);
    assert!(!s.client.get_offering().paused);
    assert_eq!(s.client.get_treasury(), treasury(0, 0, 0));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn constructor_rejects_zero_unit_price() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(admin.clone());
    env.register(MinkaMarket, (admin, asset.address(), 0_i128, 100_i128));
}

#[test]
fn escrows_investment_usdc() {
    let env = Env::default();
    let s = setup(&env);

    s.client.invest(&s.alice, &60);

    assert_eq!(s.token.balance(&s.alice), 4_000);
    assert_eq!(s.token.balance(&s.contract_id), 6_000);
    assert_eq!(s.client.get_position(&s.alice).units, 60);
    assert_eq!(s.client.get_offering().sold_units, 60);
    assert_eq!(s.client.get_treasury(), treasury(6_000, 0, 0));
}

#[test]
fn transfers_claimable_usdc_pro_rata_and_resets_claim() {
    let env = Env::default();
    let s = setup(&env);
    s.issuer.mint(&s.admin, &1_000);

    s.client.invest(&s.alice, &60);
    s.client.invest(&s.bob, &40);
    s.client.fund_distributions(&s.admin, &1_000);
    assert_eq!(s.client.get_treasury(), treasury(10_000, 1_000, 0));
    s.client.record_revenue(&s.admin, &1, &1_000);
    assert_eq!(s.client.get_treasury(), treasury(10_000, 0, 1_000));

    assert_eq!(s.client.get_position(&s.alice).claimable, 600);
    assert_eq!(s.client.get_position(&s.bob).claimable, 400);
    assert_eq!(s.client.claim(&s.alice), 600);
    assert_eq!(s.client.get_position(&s.alice).claimable, 0);
    assert_eq!(s.token.balance(&s.alice), 4_600);
    assert_eq!(s.token.balance(&s.contract_id), 10_400);
    assert_eq!(s.client.get_treasury(), treasury(10_000, 0, 400));
    assert!(s.client.is_revenue_event_processed(&1));
}

#[test]
fn late_investor_does_not_receive_earlier_revenue() {
    let env = Env::default();
    let s = setup(&env);
    s.issuer.mint(&s.admin, &2_000);
    s.client.fund_distributions(&s.admin, &2_000);

    s.client.invest(&s.alice, &50);
    s.client.record_revenue(&s.admin, &1, &1_000);
    s.client.invest(&s.bob, &50);
    s.client.record_revenue(&s.admin, &2, &1_000);

    assert_eq!(s.client.get_position(&s.alice).claimable, 1_500);
    assert_eq!(s.client.get_position(&s.bob).claimable, 500);
    assert_eq!(s.client.claim(&s.alice), 1_500);
    assert_eq!(s.client.claim(&s.bob), 500);
    assert_eq!(s.client.get_treasury(), treasury(10_000, 0, 0));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn one_deposit_cannot_back_two_revenue_events() {
    let env = Env::default();
    let s = setup(&env);
    s.issuer.mint(&s.admin, &1_000);
    s.client.invest(&s.alice, &100);
    s.client.fund_distributions(&s.admin, &1_000);
    s.client.record_revenue(&s.admin, &1, &1_000);
    s.client.record_revenue(&s.admin, &2, &1_000);
}

#[test]
fn claims_never_spend_offering_capital() {
    let env = Env::default();
    let s = setup(&env);
    s.issuer.mint(&s.admin, &1_000);
    s.client.invest(&s.alice, &100);
    s.client.fund_distributions(&s.admin, &1_000);
    s.client.record_revenue(&s.admin, &1, &1_000);
    s.client.claim(&s.alice);

    // Only the raised capital remains, and it is fully withdrawable.
    assert_eq!(s.token.balance(&s.contract_id), 10_000);
    assert_eq!(s.client.get_treasury(), treasury(10_000, 0, 0));
}

#[test]
fn withdraws_raised_capital_to_startup() {
    let env = Env::default();
    let s = setup(&env);
    let startup = Address::generate(&env);
    s.client.invest(&s.alice, &60);

    s.client.withdraw_raise(&s.admin, &startup, &5_000);

    assert_eq!(s.token.balance(&startup), 5_000);
    assert_eq!(s.token.balance(&s.contract_id), 1_000);
    assert_eq!(s.client.get_treasury(), treasury(1_000, 0, 0));
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn withdraw_raise_cannot_touch_distribution_funds() {
    let env = Env::default();
    let s = setup(&env);
    let startup = Address::generate(&env);
    s.issuer.mint(&s.admin, &1_000);
    s.client.invest(&s.alice, &10);
    s.client.fund_distributions(&s.admin, &1_000);
    s.client.withdraw_raise(&s.admin, &startup, &1_001);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_investment_while_paused() {
    let env = Env::default();
    let s = setup(&env);
    s.client.set_paused(&s.admin, &true);
    s.client.invest(&s.alice, &10);
}

#[test]
fn claims_still_work_while_paused() {
    let env = Env::default();
    let s = setup(&env);
    s.issuer.mint(&s.admin, &100);
    s.client.invest(&s.alice, &10);
    s.client.fund_distributions(&s.admin, &100);
    s.client.record_revenue(&s.admin, &1, &100);
    s.client.set_paused(&s.admin, &true);
    assert_eq!(s.client.claim(&s.alice), 100);
    s.client.set_paused(&s.admin, &false);
    s.client.invest(&s.alice, &10);
    assert_eq!(s.client.get_position(&s.alice).units, 20);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_an_unapproved_investor() {
    let env = Env::default();
    let s = setup(&env);
    let unapproved = Address::generate(&env);
    s.client.invest(&unapproved, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn rejects_oversubscription() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &60);
    s.client.invest(&s.bob, &41);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn rejects_non_admin_revenue() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &10);
    s.client.record_revenue(&s.alice, &1, &100);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn rejects_duplicate_revenue_events() {
    let env = Env::default();
    let s = setup(&env);
    s.issuer.mint(&s.admin, &2_000);
    s.client.invest(&s.alice, &100);
    s.client.fund_distributions(&s.admin, &2_000);
    s.client.record_revenue(&s.admin, &7, &1_000);
    s.client.record_revenue(&s.admin, &7, &1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn rejects_revenue_when_treasury_is_not_funded() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &100);
    s.client.record_revenue(&s.admin, &1, &1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn rejects_empty_claim() {
    let env = Env::default();
    let s = setup(&env);
    s.client.invest(&s.alice, &10);
    s.client.claim(&s.alice);
}
