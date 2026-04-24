#![cfg(test)]

use super::*;
use collateral_token::CollateralToken;
use debt_token::DebtToken;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

struct TestEnv {
    env: Env,
    admin: Address,
    collateral_id: Address,
    debt_id: Address,
    pool_id: Address,
    pool: LendingPoolClient<'static>,
    collateral: collateral_token::CollateralTokenClient<'static>,
    debt: debt_token::DebtTokenClient<'static>,
}

fn setup() -> TestEnv {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let collateral_id = env.register(CollateralToken, ());
    let collateral = collateral_token::CollateralTokenClient::new(&env, &collateral_id);
    collateral.initialize(
        &admin,
        &String::from_str(&env, "Collateral Token"),
        &String::from_str(&env, "cTOKEN"),
        &7u32,
    );

    let debt_id = env.register(DebtToken, ());
    let debt = debt_token::DebtTokenClient::new(&env, &debt_id);
    debt.initialize(
        &admin,
        &String::from_str(&env, "Debt Token"),
        &String::from_str(&env, "dTOKEN"),
        &7u32,
    );

    let pool_id = env.register(LendingPool, ());
    let pool = LendingPoolClient::new(&env, &pool_id);
    pool.initialize(&admin, &collateral_id, &debt_id, &150u32, &120u32, &5u32);

    debt.set_minter(&pool_id);

    TestEnv { env, admin, collateral_id, debt_id, pool_id, pool, collateral, debt }
}

fn fund_user(t: &TestEnv, user: &Address, amount: i128) {
    t.collateral.mint(user, &amount);
}

#[test]
fn test_initialize() {
    let t = setup();
    let config = t.pool.get_config();
    assert_eq!(config.collateral_ratio, 150u32);
    assert_eq!(config.liquidation_threshold, 120u32);
    assert_eq!(config.liquidation_bonus, 5u32);
    assert_eq!(config.collateral_token, t.collateral_id);
    assert_eq!(config.debt_token, t.debt_id);
    assert_eq!(config.admin, t.admin);
}

#[test]
fn test_deposit_collateral() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1000);

    t.pool.deposit_collateral(&user, &1000_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.collateral_deposited, 1000);
    assert_eq!(pos.debt_borrowed, 0);
    assert_eq!(t.collateral.balance(&t.pool_id), 1000);
    assert_eq!(t.collateral.balance(&user), 0);
}

#[test]
fn test_borrow_within_limit() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1500);

    t.pool.deposit_collateral(&user, &1500_i128);
    t.pool.borrow(&user, &1000_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.debt_borrowed, 1000);
    assert_eq!(t.debt.balance(&user), 1000);
}

#[test]
#[should_panic(expected = "INSUFFICIENT_COLLATERAL")]
fn test_borrow_exceeds_limit() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1000);

    t.pool.deposit_collateral(&user, &1000_i128);
    t.pool.borrow(&user, &1000_i128);
}

#[test]
fn test_repay() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1500);

    t.pool.deposit_collateral(&user, &1500_i128);
    t.pool.borrow(&user, &1000_i128);
    t.pool.repay(&user, &500_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.debt_borrowed, 500);
    assert_eq!(t.debt.balance(&user), 500);
}

#[test]
#[should_panic(expected = "REPAY_EXCEEDS_DEBT")]
fn test_repay_exceeds_debt() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1500);

    t.pool.deposit_collateral(&user, &1500_i128);
    t.pool.borrow(&user, &500_i128);
    t.pool.repay(&user, &600_i128);
}

#[test]
fn test_withdraw_collateral() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1000);

    t.pool.deposit_collateral(&user, &1000_i128);
    t.pool.withdraw_collateral(&user, &500_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.collateral_deposited, 500);
    assert_eq!(t.collateral.balance(&user), 500);
}

#[test]
#[should_panic(expected = "WOULD_BE_UNDERCOLLATERALIZED")]
fn test_withdraw_would_undercollateralize() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1500);

    t.pool.deposit_collateral(&user, &1500_i128);
    t.pool.borrow(&user, &1000_i128);
    t.pool.withdraw_collateral(&user, &1_i128);
}

#[test]
#[should_panic(expected = "POSITION_HEALTHY")]
fn test_liquidation_healthy_position() {
    let t = setup();
    let user = Address::generate(&t.env);
    let liquidator = Address::generate(&t.env);
    fund_user(&t, &user, 1500);

    t.pool.deposit_collateral(&user, &1500_i128);
    t.pool.borrow(&user, &500_i128);

    t.debt.mint(&liquidator, &100_i128);
    t.pool.liquidate(&liquidator, &user, &100_i128);
}

#[test]
fn test_liquidation_unhealthy_position() {
    let t = setup();
    let borrower = Address::generate(&t.env);
    let liquidator = Address::generate(&t.env);

    fund_user(&t, &borrower, 1500);
    t.pool.deposit_collateral(&borrower, &1500_i128);
    t.pool.borrow(&borrower, &1000_i128);

    // Simulate collateral price drop: health = 1100*100/1000 = 110 < 120
    t.env.as_contract(&t.pool_id, || {
        let pos = Position { collateral_deposited: 1100, debt_borrowed: 1000 };
        t.env.storage().persistent().set(&DataKey::Position(borrower.clone()), &pos);
    });
    t.env.as_contract(&t.collateral_id, || {
        t.env.storage().persistent().set(
            &collateral_token::DataKey::Balance(t.pool_id.clone()),
            &1100_i128,
        );
    });

    t.debt.mint(&liquidator, &500_i128);
    t.pool.liquidate(&liquidator, &borrower, &500_i128);

    let pos = t.pool.get_position(&borrower);
    assert_eq!(pos.debt_borrowed, 500);
    assert_eq!(pos.collateral_deposited, 575); // 1100 - 525

    assert_eq!(t.collateral.balance(&liquidator), 525);
    assert_eq!(t.debt.balance(&liquidator), 0);
}

#[test]
fn test_full_lifecycle() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 3000);

    t.pool.deposit_collateral(&user, &3000_i128);
    assert_eq!(t.pool.get_position(&user).collateral_deposited, 3000);

    t.pool.borrow(&user, &2000_i128);
    assert_eq!(t.pool.get_position(&user).debt_borrowed, 2000);
    assert_eq!(t.debt.balance(&user), 2000);
    assert_eq!(t.pool.get_health_factor(&user), 150u32);

    t.pool.repay(&user, &2000_i128);
    assert_eq!(t.pool.get_position(&user).debt_borrowed, 0);

    t.pool.withdraw_collateral(&user, &3000_i128);
    assert_eq!(t.pool.get_position(&user).collateral_deposited, 0);
    assert_eq!(t.collateral.balance(&user), 3000);
}

#[test]
fn test_health_factor_no_debt() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1000);
    t.pool.deposit_collateral(&user, &1000_i128);
    assert_eq!(t.pool.get_health_factor(&user), 0u32);
}
