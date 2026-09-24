extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{MinkaMarket, MinkaMarketClient};

fn setup<'a>(env: &Env) -> (MinkaMarketClient<'a>, Address, Address, Address) {
    let admin = Address::generate(env);
    let alice = Address::generate(env);
    let bob = Address::generate(env);
    let contract_id = env.register(MinkaMarket, ());
    let client = MinkaMarketClient::new(env, &contract_id);
    env.mock_all_auths();
    client.initialize(&admin, &100);
    client.set_investor_status(&admin, &alice, &true);
    client.set_investor_status(&admin, &bob, &true);
    (client, admin, alice, bob)
}

#[test]
fn distributes_revenue_pro_rata_and_resets_claim() {
    let env = Env::default();
    let (client, admin, alice, bob) = setup(&env);
    client.invest(&alice, &60);
    client.invest(&bob, &40);
    client.record_revenue(&admin, &1, &1_000);

    assert_eq!(client.get_position(&alice).claimable, 600);
    assert_eq!(client.get_position(&bob).claimable, 400);
    assert_eq!(client.claim(&alice), 600);
    assert_eq!(client.get_position(&alice).claimable, 0);
}

#[test]
#[should_panic(expected = "investor is not approved")]
fn rejects_an_unapproved_investor() {
    let env = Env::default();
    let (client, _admin, _alice, _bob) = setup(&env);
    let unapproved = Address::generate(&env);
    client.invest(&unapproved, &1);
}

#[test]
#[should_panic(expected = "revenue event already processed")]
fn rejects_duplicate_revenue_events() {
    let env = Env::default();
    let (client, admin, alice, _bob) = setup(&env);
    client.invest(&alice, &100);
    client.record_revenue(&admin, &7, &1_000);
    client.record_revenue(&admin, &7, &1_000);
}
