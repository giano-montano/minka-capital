extern crate std;

use soroban_sdk::{Address, Env, testutils::Address as _, token};

use crate::{MinkaMarket, MinkaMarketClient};

fn setup<'a>(
    env: &Env,
) -> (
    MinkaMarketClient<'a>,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let admin = Address::generate(env);
    let alice = Address::generate(env);
    let bob = Address::generate(env);
    let asset = env.register_stellar_asset_contract_v2(admin.clone());
    let contract_id = env.register(MinkaMarket, ());
    let client = MinkaMarketClient::new(env, &contract_id);
    env.mock_all_auths();
    client.initialize(&admin, &asset.address(), &100, &100);
    client.set_investor_status(&admin, &alice, &true);
    client.set_investor_status(&admin, &bob, &true);
    (client, admin, alice, bob, asset.address(), contract_id)
}

#[test]
fn initializes_asset_configuration() {
    let env = Env::default();
    let (client, _admin, _alice, _bob, usdc, _contract_id) = setup(&env);
    assert_eq!(client.get_usdc(), usdc);
    assert_eq!(client.get_unit_price(), 100);
    assert_eq!(client.get_distribution_pool(), 0);
}

#[test]
fn escrows_investment_usdc() {
    let env = Env::default();
    let (client, _admin, alice, _bob, usdc, contract_id) = setup(&env);
    let token = token::TokenClient::new(&env, &usdc);
    let issuer = token::StellarAssetClient::new(&env, &usdc);
    issuer.mint(&alice, &10_000);

    client.invest(&alice, &60);

    assert_eq!(token.balance(&alice), 4_000);
    assert_eq!(token.balance(&contract_id), 6_000);
}

#[test]
fn transfers_claimable_usdc_pro_rata_and_resets_claim() {
    let env = Env::default();
    let (client, admin, alice, bob, usdc, contract_id) = setup(&env);
    let token = token::TokenClient::new(&env, &usdc);
    let issuer = token::StellarAssetClient::new(&env, &usdc);
    issuer.mint(&alice, &10_000);
    issuer.mint(&bob, &10_000);
    issuer.mint(&admin, &1_000);

    client.invest(&alice, &60);
    client.invest(&bob, &40);
    client.fund_distributions(&admin, &1_000);
    client.record_revenue(&admin, &1, &1_000);

    assert_eq!(client.get_position(&alice).claimable, 600);
    assert_eq!(client.get_position(&bob).claimable, 400);
    assert_eq!(client.claim(&alice), 600);
    assert_eq!(client.get_position(&alice).claimable, 0);
    assert_eq!(token.balance(&alice), 4_600);
    assert_eq!(token.balance(&contract_id), 10_400);
    assert_eq!(client.get_distribution_pool(), 400);
}

#[test]
#[should_panic(expected = "investor is not approved")]
fn rejects_an_unapproved_investor() {
    let env = Env::default();
    let (client, _admin, _alice, _bob, _usdc, _contract_id) = setup(&env);
    let unapproved = Address::generate(&env);
    client.invest(&unapproved, &1);
}

#[test]
#[should_panic(expected = "revenue event already processed")]
fn rejects_duplicate_revenue_events() {
    let env = Env::default();
    let (client, admin, alice, _bob, usdc, _contract_id) = setup(&env);
    let issuer = token::StellarAssetClient::new(&env, &usdc);
    issuer.mint(&alice, &10_000);
    issuer.mint(&admin, &1_000);
    client.invest(&alice, &100);
    client.fund_distributions(&admin, &1_000);
    client.record_revenue(&admin, &7, &1_000);
    client.record_revenue(&admin, &7, &1_000);
}

#[test]
#[should_panic(expected = "distribution treasury insufficient")]
fn rejects_revenue_when_treasury_is_not_funded() {
    let env = Env::default();
    let (client, _admin, alice, _bob, usdc, _contract_id) = setup(&env);
    let issuer = token::StellarAssetClient::new(&env, &usdc);
    issuer.mint(&alice, &10_000);
    client.invest(&alice, &100);
    client.record_revenue(&_admin, &1, &1_000);
}
