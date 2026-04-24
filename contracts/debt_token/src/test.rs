#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup() -> (Env, Address, Address, DebtTokenClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(DebtToken, ());
    let client = DebtTokenClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let minter = Address::generate(&env);

    client.initialize(
        &admin,
        &String::from_str(&env, "Debt Token"),
        &String::from_str(&env, "dTOKEN"),
        &7u32,
    );
    client.set_minter(&minter);
    (env, admin, minter, client)
}

#[test]
fn test_token_mint_burn() {
    let (env, _admin, _minter, client) = setup();
    let user = Address::generate(&env);

    client.mint(&user, &500_i128);
    assert_eq!(client.balance(&user), 500);
    assert_eq!(client.total_supply(), 500);

    client.burn(&user, &200_i128);
    assert_eq!(client.balance(&user), 300);
    assert_eq!(client.total_supply(), 300);
}

#[test]
fn test_token_transfer() {
    let (env, _admin, _minter, client) = setup();
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.mint(&user1, &1000_i128);
    client.transfer(&user1, &user2, &400_i128);

    assert_eq!(client.balance(&user1), 600);
    assert_eq!(client.balance(&user2), 400);
}

#[test]
fn test_metadata() {
    let (env, _admin, _minter, client) = setup();
    assert_eq!(client.name(), String::from_str(&env, "Debt Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "dTOKEN"));
    assert_eq!(client.decimals(), 7u32);
}

#[test]
fn test_set_minter_and_mint() {
    let (env, _admin, _minter, client) = setup();
    let user = Address::generate(&env);
    client.mint(&user, &1000_i128);
    assert_eq!(client.balance(&user), 1000);
}
