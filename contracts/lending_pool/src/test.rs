#![cfg(test)]

use super::*;
use collateral_token::CollateralToken;
use debt_token::DebtToken;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

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

// XLM price: $0.12 = 1_200_000 (7 decimals)
const XLM_PRICE: i128 = 1_200_000;
// 5% APR = 500 bps
const INTEREST_RATE_BPS: u32 = 500;

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
    pool.initialize(
        &admin,
        &collateral_id,
        &debt_id,
        &150u32,
        &120u32,
        &5u32,
        &INTEREST_RATE_BPS,
        &XLM_PRICE,
    );

    debt.set_minter(&pool_id);

    TestEnv { env, admin, collateral_id, debt_id, pool_id, pool, collateral, debt }
}

fn fund_user(t: &TestEnv, user: &Address, amount: i128) {
    t.collateral.mint(user, &amount);
}

// ── Core tests ────────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let t = setup();
    let config = t.pool.get_config();
    assert_eq!(config.collateral_ratio, 150u32);
    assert_eq!(config.liquidation_threshold, 120u32);
    assert_eq!(config.liquidation_bonus, 5u32);
    assert_eq!(config.interest_rate_bps, INTEREST_RATE_BPS);
    assert_eq!(config.xlm_price_usd, XLM_PRICE);
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
    // 150,000 XLM = 1_500_000_000_000 raw (7 decimals)
    // collateral_usd = 1_500_000_000_000 * 1_200_000 / 10_000_000 = 180_000_000_000 ($18,000)
    // max_borrow = 180_000_000_000 * 100 / 150 = 12_000_000_000 ($1,200)
    fund_user(&t, &user, 1_500_000_000_000);

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    t.pool.borrow(&user, &12_000_000_000_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.debt_borrowed, 12_000_000_000);
    assert_eq!(t.debt.balance(&user), 12_000_000_000);
}

#[test]
#[should_panic(expected = "INSUFFICIENT_COLLATERAL")]
fn test_borrow_exceeds_limit() {
    let t = setup();
    let user = Address::generate(&t.env);
    // 100 XLM = 1_000_000_000 raw
    // collateral_usd = 1_000_000_000 * 1_200_000 / 10_000_000 = 120_000_000 ($12)
    // max_borrow = 120_000_000 * 100 / 150 = 80_000_000 ($8)
    fund_user(&t, &user, 1_000_000_000);

    t.pool.deposit_collateral(&user, &1_000_000_000_i128);
    // Try to borrow $100 — should fail (max is $8)
    t.pool.borrow(&user, &1_000_000_000_i128);
}

#[test]
fn test_repay() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_500_000_000_000);

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    t.pool.borrow(&user, &5_000_000_000_i128);
    t.pool.repay(&user, &2_000_000_000_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.debt_borrowed, 3_000_000_000);
}

#[test]
#[should_panic(expected = "REPAY_EXCEEDS_DEBT")]
fn test_repay_exceeds_debt() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_500_000_000_000);

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    t.pool.borrow(&user, &5_000_000_000_i128);
    t.pool.repay(&user, &6_000_000_000_i128);
}

#[test]
fn test_withdraw_collateral() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_000_000_000);

    t.pool.deposit_collateral(&user, &1_000_000_000_i128);
    t.pool.withdraw_collateral(&user, &500_000_000_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.collateral_deposited, 500_000_000);
    assert_eq!(t.collateral.balance(&user), 500_000_000);
}

#[test]
#[should_panic(expected = "WOULD_BE_UNDERCOLLATERALIZED")]
fn test_withdraw_would_undercollateralize() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_500_000_000_000);

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    // max_borrow at 150% = $1200 = 12_000_000_000
    t.pool.borrow(&user, &12_000_000_000_i128);
    // To maintain 150% ratio with $1200 debt, need at least:
    // min_collateral = debt * ratio / 100 / price * 10^7
    // = 12_000_000_000 * 150 / 100 * 10_000_000 / 1_200_000 = 150_000_000_000
    // Current collateral = 1_500_000_000_000, so can withdraw up to 1_350_000_000_000
    // Trying to withdraw 1_400_000_000_000 should fail
    t.pool.withdraw_collateral(&user, &1_400_000_000_000_i128);
}

#[test]
fn test_liquidation_healthy_position_panics() {
    // health = 180_000_000_000 * 100 / 5_000_000_000 = 3600 >= 120 → healthy
}

#[test]
#[should_panic(expected = "POSITION_HEALTHY")]
fn test_liquidation_healthy_position() {
    let t = setup();
    let user = Address::generate(&t.env);
    let liquidator = Address::generate(&t.env);
    fund_user(&t, &user, 1_500_000_000_000);

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    t.pool.borrow(&user, &5_000_000_000_i128);

    t.debt.mint(&liquidator, &1_000_000_000_i128);
    t.pool.liquidate(&liquidator, &user, &1_000_000_000_i128);
}

#[test]
fn test_liquidation_unhealthy_position() {
    let t = setup();
    let borrower = Address::generate(&t.env);
    let liquidator = Address::generate(&t.env);

    // 150,000 XLM deposited, borrow max $1200
    fund_user(&t, &borrower, 1_500_000_000_000);
    t.pool.deposit_collateral(&borrower, &1_500_000_000_000_i128);
    t.pool.borrow(&borrower, &12_000_000_000_i128);

    // Drop XLM price to $0.0005 → health = 6 < 120 → liquidatable
    // At $0.0005: 1 dTOKEN repaid = 1/0.0005 = 2000 XLM = 20_000_000_000 raw
    // + 5% bonus = 21_000_000_000 raw XLM
    // Pool has 1_500_000_000_000 XLM, so repaying 1_000_000 dTOKEN seizes
    // 1_000_000 / 0.0005 * 1.05 = 2_100_000_000 raw XLM — fits
    t.env.as_contract(&t.pool_id, || {
        t.env.storage().instance().set(&DataKey::XlmPriceUsd, &5_000_i128); // $0.0005
    });

    // Repay 1_000_000 dTOKEN (tiny amount)
    t.debt.mint(&liquidator, &1_000_000_i128);
    t.pool.liquidate(&liquidator, &borrower, &1_000_000_i128);

    let pos = t.pool.get_position(&borrower);
    assert_eq!(pos.debt_borrowed, 11_999_000_000);
    assert!(t.collateral.balance(&liquidator) > 0);
    assert_eq!(t.debt.balance(&liquidator), 0);
}

#[test]
fn test_full_lifecycle() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_500_000_000_000); // 150,000 XLM

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    assert_eq!(t.pool.get_position(&user).collateral_deposited, 1_500_000_000_000);

    // max_borrow = $1200 = 12_000_000_000
    t.pool.borrow(&user, &12_000_000_000_i128);
    assert_eq!(t.pool.get_position(&user).debt_borrowed, 12_000_000_000);

    t.pool.repay(&user, &12_000_000_000_i128);
    assert_eq!(t.pool.get_position(&user).debt_borrowed, 0);

    t.pool.withdraw_collateral(&user, &1_500_000_000_000_i128);
    assert_eq!(t.pool.get_position(&user).collateral_deposited, 0);
    assert_eq!(t.collateral.balance(&user), 1_500_000_000_000);
}

#[test]
fn test_health_factor_no_debt() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_000_000_000);
    t.pool.deposit_collateral(&user, &1_000_000_000_i128);
    assert_eq!(t.pool.get_health_factor(&user), 0u32);
}

// ── Oracle tests ──────────────────────────────────────────────────────────────

#[test]
fn test_set_price() {
    let t = setup();
    // Admin sets new price
    t.pool.set_price(&2_000_000_i128); // $0.20
    let config = t.pool.get_config();
    assert_eq!(config.xlm_price_usd, 2_000_000);
}

#[test]
fn test_price_affects_borrow_limit() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_000_000_000); // 100 XLM

    t.pool.deposit_collateral(&user, &1_000_000_000_i128);

    // At $0.12: collateral_usd = 1_000_000_000 * 1_200_000 / 10_000_000 = 120_000_000 ($12)
    // max_borrow = 120_000_000 * 100 / 150 = 80_000_000 ($8)
    // Raise price to $0.30: collateral_usd = 300_000_000 ($30), max_borrow = 200_000_000 ($20)
    t.pool.set_price(&3_000_000_i128); // $0.30
    t.pool.borrow(&user, &200_000_000_i128); // $20 — should succeed

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.debt_borrowed, 200_000_000);
}

// ── Interest rate tests ───────────────────────────────────────────────────────

#[test]
fn test_set_interest_rate() {
    let t = setup();
    t.pool.set_interest_rate(&1000u32); // 10% APR
    let config = t.pool.get_config();
    assert_eq!(config.interest_rate_bps, 1000u32);
}

#[test]
fn test_get_position_details() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_500_000_000_000); // 150,000 XLM

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    t.pool.borrow(&user, &5_000_000_000_i128);

    let details = t.pool.get_position_details(&user);
    assert_eq!(details.collateral_deposited, 1_500_000_000_000);
    assert_eq!(details.debt_borrowed, 5_000_000_000);
    assert_eq!(details.xlm_price_usd, XLM_PRICE);
    // collateral_usd = 1_500_000_000_000 * 1_200_000 / 10_000_000 = 180_000_000_000 ($18,000)
    assert_eq!(details.collateral_usd, 180_000_000_000);
    // health = 180_000_000_000 * 100 / 5_000_000_000 = 3600
    assert_eq!(details.health_factor, 3600u32);
}
