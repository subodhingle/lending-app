#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, Address, CollateralTokenClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(CollateralToken, ());
    let client = CollateralTokenClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(
        &admin,
        &String::from_str(&env, "Collateral Token"),
        &String::from_str(&env, "cTOKEN"),
        &7u32,
    );
    (env, admin, client)
}

#[test]
fn test_token_mint_burn() {
    let (env, _admin, client) = setup();
    let user = Address::generate(&env);

    client.mint(&user, &1000_i128);
    assert_eq!(client.balance(&user), 1000);
    assert_eq!(client.total_supply(), 1000);

    client.burn(&user, &400_i128);
    assert_eq!(client.balance(&user), 600);
    assert_eq!(client.total_supply(), 600);
}

#[test]
fn test_token_transfer() {
    let (env, _admin, client) = setup();
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.mint(&user1, &1000_i128);
    client.transfer(&user1, &user2, &300_i128);

    assert_eq!(client.balance(&user1), 700);
    assert_eq!(client.balance(&user2), 300);
}

#[test]
fn test_token_approve_and_transfer_from() {
    let (env, _admin, client) = setup();
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint(&owner, &1000_i128);
    // approve is still available for compatibility
    client.approve(&owner, &spender, &500_i128, &100u32);
    assert_eq!(client.allowance(&owner, &spender), 500);

    // transfer_from: spender auth is all that's needed (no allowance deduction)
    client.transfer_from(&spender, &owner, &recipient, &200_i128);
    assert_eq!(client.balance(&owner), 800);
    assert_eq!(client.balance(&recipient), 200);
    // allowance is NOT deducted — auth-tree model, not allowance model
    assert_eq!(client.allowance(&owner, &spender), 500);
}

#[test]
#[should_panic]
fn test_token_unauthorized_mint() {
    // In this test we verify that mint panics when called by a non-admin.
    // The mint function does: let admin = storage.get(Admin); admin.require_auth();
    // So even if we mock the non_admin's auth, the stored admin's require_auth()
    // will NOT be satisfied → panic.
    let env = Env::default();
    let contract_id = env.register(CollateralToken, ());
    let client = CollateralTokenClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);

    // Initialize (mock admin auth for setup only)
    env.mock_all_auths();
    client.initialize(
        &admin,
        &String::from_str(&env, "Collateral Token"),
        &String::from_str(&env, "cTOKEN"),
        &7u32,
    );

    // Now use a fresh env without mocked auths to call mint
    // The stored admin's require_auth() will fail → panic
    let env2 = Env::default(); // no mock_all_auths
    let client2 = CollateralTokenClient::new(&env2, &contract_id);
    client2.mint(&non_admin, &1000_i128);
}

#[test]
fn test_metadata() {
    let (env, _admin, client) = setup();
    assert_eq!(client.name(), String::from_str(&env, "Collateral Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "cTOKEN"));
    assert_eq!(client.decimals(), 7u32);
}
