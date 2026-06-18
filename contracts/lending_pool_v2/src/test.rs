#![cfg(test)]

use super::*;
use collateral_token::CollateralToken;
use debt_token::DebtToken;
use flash_loan_pool::FlashLoanPool;
use flash_liquidator::FlashLiquidator;
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec, Val};

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
    fund_user(&t, &user, 1_000_000_000);

    t.pool.deposit_collateral(&user, &1_000_000_000_i128);
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
    t.pool.borrow(&user, &12_000_000_000_i128);
    t.pool.withdraw_collateral(&user, &1_400_000_000_000_i128);
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

    fund_user(&t, &borrower, 1_500_000_000_000);
    t.pool.deposit_collateral(&borrower, &1_500_000_000_000_i128);
    t.pool.borrow(&borrower, &12_000_000_000_i128); // $1200 debt

    t.env.as_contract(&t.pool_id, || {
        t.env.storage().instance().set(&DataKey::XlmPriceUsd, &5_000_i128); // $0.0005
    });

    // We can liquidate 50% max = $600. But at $0.0005, $600 requires 12 trillion collateral.
    // Borrower only has 1.5 trillion collateral.
    // So let's liquidate $60 (600_000_000), which requires 1.2 trillion collateral (within limits).
    t.debt.mint(&liquidator, &600_000_000_i128);
    t.pool.liquidate(&liquidator, &borrower, &600_000_000_i128);

    let pos = t.pool.get_position(&borrower);
    assert_eq!(pos.debt_borrowed, 11_400_000_000);
    assert!(t.collateral.balance(&liquidator) > 0);
}

#[test]
#[should_panic(expected = "REPAY_EXCEEDS_CLOSE_FACTOR")]
fn test_liquidation_exceeds_close_factor() {
    let t = setup();
    let borrower = Address::generate(&t.env);
    let liquidator = Address::generate(&t.env);

    fund_user(&t, &borrower, 1_500_000_000_000);
    t.pool.deposit_collateral(&borrower, &1_500_000_000_000_i128);
    t.pool.borrow(&borrower, &12_000_000_000_i128); // $1200 debt

    t.env.as_contract(&t.pool_id, || {
        t.env.storage().instance().set(&DataKey::XlmPriceUsd, &5_000_i128);
    });

    t.debt.mint(&liquidator, &8_000_000_000_i128);
    // Repaying $800 exceeds 50% Close Factor ($600)
    t.pool.liquidate(&liquidator, &borrower, &8_000_000_000_i128);
}

#[test]
fn test_flash_liquidation() {
    let t = setup();
    let borrower = Address::generate(&t.env);
    let initiator = Address::generate(&t.env);
    let lp_provider = Address::generate(&t.env);

    // 1. Borrower deposits 150,000 XLM and borrows max limit $1200
    fund_user(&t, &borrower, 1_500_000_000_000);
    t.pool.deposit_collateral(&borrower, &1_500_000_000_000_i128);
    t.pool.borrow(&borrower, &12_000_000_000_i128);

    // 2. Setup separate FlashLoanPool
    let flash_loan_pool_id = t.env.register(FlashLoanPool, ());
    let flash_loan_pool_client = flash_loan_pool::FlashLoanPoolClient::new(&t.env, &flash_loan_pool_id);
    flash_loan_pool_client.initialize(&t.debt_id);

    // 3. Fund FlashLoanPool with dTOKEN liquidity (borrowed by lp_provider)
    fund_user(&t, &lp_provider, 1_500_000_000_000);
    t.pool.deposit_collateral(&lp_provider, &1_500_000_000_000_i128);
    t.pool.borrow(&lp_provider, &12_000_000_000_i128);
    // Transfer borrowed dTOKEN to FlashLoanPool
    t.debt.transfer(&lp_provider, &flash_loan_pool_id, &12_000_000_000_i128);

    // 4. Unhealthy position setup (price drops to $0.0005)
    t.env.as_contract(&t.pool_id, || {
        t.env.storage().instance().set(&DataKey::XlmPriceUsd, &5_000_i128);
    });

    // 5. Deploy Flash Liquidator
    let liquidator_id = t.env.register(FlashLiquidator, ());

    // Flash liquidate: call flash_loan directly to avoid re-entrancy on the liquidator contract
    let args: Vec<Val> = (borrower.clone(), initiator.clone(), t.pool_id.clone()).into_val(&t.env);
    flash_loan_pool_client.flash_loan(&liquidator_id, &600_000_000_i128, &10u32, &args);

    // Verify initiator receives the profit in XLM
    let initiator_profit = t.collateral.balance(&initiator);
    assert!(initiator_profit > 0);
    
    // Borrower position is updated
    let pos = t.pool.get_position(&borrower);
    assert_eq!(pos.debt_borrowed, 11_400_000_000);
}

#[test]
fn test_full_lifecycle() {
    let t = setup();
    let user = Address::generate(&t.env);
    fund_user(&t, &user, 1_500_000_000_000);

    t.pool.deposit_collateral(&user, &1_500_000_000_000_i128);
    t.pool.borrow(&user, &12_000_000_000_i128);
    t.pool.repay(&user, &12_000_000_000_i128);
    t.pool.withdraw_collateral(&user, &1_500_000_000_000_i128);

    let pos = t.pool.get_position(&user);
    assert_eq!(pos.collateral_deposited, 0);
    assert_eq!(pos.debt_borrowed, 0);
}
