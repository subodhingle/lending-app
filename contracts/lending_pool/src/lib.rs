#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, IntoVal,
};

// ── Custom client for debt token mint/burn ────────────────────────────────────
mod debt_client {
    use soroban_sdk::{contractclient, Address, Env};
    #[contractclient(name = "DebtTokenClient")]
    pub trait DebtTokenTrait {
        fn mint(env: Env, to: Address, amount: i128);
        fn burn(env: Env, from: Address, amount: i128);
    }
}
use debt_client::DebtTokenClient;

// ── Storage keys ──────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    CollateralToken,
    DebtToken,
    CollateralRatio,       // e.g. 150 = 150%
    LiquidationThreshold,  // e.g. 120 = 120%
    LiquidationBonus,      // e.g. 5 = 5%
    InterestRateBps,       // annual interest in basis points, e.g. 500 = 5% APR
    XlmPriceUsd,           // XLM price in USD with 7 decimals, e.g. 1200000 = $0.12
    Position(Address),
    DebtPrincipal(Address),   // original principal (no interest)
    LastAccrualLedger(Address), // ledger when interest was last accrued
}

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub struct Position {
    pub collateral_deposited: i128,  // raw XLM units (7 decimals)
    pub debt_borrowed: i128,         // dTOKEN including accrued interest (7 decimals)
}

#[derive(Clone)]
#[contracttype]
pub struct LendingConfig {
    pub admin: Address,
    pub collateral_token: Address,
    pub debt_token: Address,
    pub collateral_ratio: u32,
    pub liquidation_threshold: u32,
    pub liquidation_bonus: u32,
    pub interest_rate_bps: u32,  // annual rate in basis points
    pub xlm_price_usd: i128,     // XLM/USD price with 7 decimals
}

#[derive(Clone)]
#[contracttype]
pub struct PositionDetails {
    pub collateral_deposited: i128,   // raw XLM
    pub collateral_usd: i128,         // collateral value in USD (7 decimals)
    pub debt_borrowed: i128,          // dTOKEN principal + interest
    pub accrued_interest: i128,       // interest accrued so far
    pub health_factor: u32,           // collateral_usd * 100 / debt_usd
    pub xlm_price_usd: i128,          // current XLM price
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn get_position(env: &Env, user: &Address) -> Position {
    env.storage()
        .persistent()
        .get(&DataKey::Position(user.clone()))
        .unwrap_or(Position { collateral_deposited: 0, debt_borrowed: 0 })
}

fn save_position(env: &Env, user: &Address, pos: &Position) {
    env.storage().persistent().set(&DataKey::Position(user.clone()), pos);
}

fn get_collateral_ratio(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::CollateralRatio).unwrap()
}

fn get_liquidation_threshold(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::LiquidationThreshold).unwrap()
}

fn get_liquidation_bonus(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::LiquidationBonus).unwrap()
}

fn get_interest_rate_bps(env: &Env) -> u32 {
    env.storage().instance().get(&DataKey::InterestRateBps).unwrap_or(500) // default 5% APR
}

fn get_xlm_price_usd(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::XlmPriceUsd).unwrap_or(1_200_000) // default $0.12
}

fn get_collateral_addr(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::CollateralToken).unwrap()
}

fn get_debt_addr(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::DebtToken).unwrap()
}

/// Accrue interest on a user's debt since last accrual ledger.
/// Interest = principal * rate_bps * ledgers_elapsed / (10000 * LEDGERS_PER_YEAR)
/// Stellar produces ~1 ledger per 5 seconds → ~6,307,200 ledgers/year
fn accrue_interest(env: &Env, user: &Address) -> i128 {
    let pos = get_position(env, user);
    if pos.debt_borrowed == 0 {
        return 0;
    }

    let current_ledger = env.ledger().sequence();
    let last_ledger: u32 = env.storage()
        .persistent()
        .get(&DataKey::LastAccrualLedger(user.clone()))
        .unwrap_or(current_ledger);

    let ledgers_elapsed = current_ledger.saturating_sub(last_ledger) as i128;
    if ledgers_elapsed == 0 {
        return 0;
    }

    // ~6,307,200 ledgers per year (5s per ledger)
    const LEDGERS_PER_YEAR: i128 = 6_307_200;
    let rate_bps = get_interest_rate_bps(env) as i128;

    // interest = debt * rate_bps * elapsed / (10000 * LEDGERS_PER_YEAR)
    let interest = pos.debt_borrowed
        .checked_mul(rate_bps).expect("overflow")
        .checked_mul(ledgers_elapsed).expect("overflow")
        .checked_div(10_000 * LEDGERS_PER_YEAR).expect("div zero");

    interest
}

/// Apply accrued interest to a user's position and update last accrual ledger.
fn apply_interest(env: &Env, user: &Address) -> i128 {
    let interest = accrue_interest(env, user);
    if interest > 0 {
        let mut pos = get_position(env, user);
        pos.debt_borrowed = pos.debt_borrowed.checked_add(interest).expect("overflow");
        save_position(env, user, &pos);

        // Mint interest as new dTOKEN debt (protocol captures it)
        let debt = DebtTokenClient::new(env, &get_debt_addr(env));
        debt.mint(&env.current_contract_address(), &interest);
    }
    env.storage().persistent().set(
        &DataKey::LastAccrualLedger(user.clone()),
        &env.ledger().sequence(),
    );
    interest
}

/// Calculate collateral value in USD (7 decimals)
fn collateral_usd(env: &Env, collateral_amount: i128) -> i128 {
    let price = get_xlm_price_usd(env);
    // collateral_amount: 7 decimals (e.g. 1_0000000 = 1 XLM)
    // price: 7 decimals (e.g. 1_200_000 = $0.12)
    // result: 7 decimals USD
    // formula: (amount / 10^7) * (price / 10^7) * 10^7 = amount * price / 10^7
    collateral_amount
        .checked_mul(price).expect("overflow")
        .checked_div(10_000_000).expect("div zero")
}

/// Health factor = (collateral_usd * 100) / debt_usd
/// Returns 0 if no debt. Debt is in dTOKEN which is pegged 1:1 to USD (7 decimals).
fn compute_health_factor(env: &Env, collateral: i128, debt: i128) -> u32 {
    if debt == 0 { return 0; }
    let col_usd = collateral_usd(env, collateral);
    // dTOKEN is 1:1 USD, so debt_usd = debt (same 7-decimal units)
    let health = col_usd
        .checked_mul(100).expect("overflow")
        .checked_div(debt).expect("div zero");
    health as u32
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct LendingPool;

#[contractimpl]
impl LendingPool {
    /// Initialize the lending pool.
    pub fn initialize(
        env: Env,
        admin: Address,
        collateral_token: Address,
        debt_token: Address,
        collateral_ratio: u32,
        liquidation_threshold: u32,
        liquidation_bonus: u32,
        interest_rate_bps: u32,   // annual rate, e.g. 500 = 5%
        xlm_price_usd: i128,      // XLM/USD with 7 decimals, e.g. 1200000 = $0.12
    ) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        if collateral_ratio <= liquidation_threshold {
            panic!("ratio must exceed threshold");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CollateralToken, &collateral_token);
        env.storage().instance().set(&DataKey::DebtToken, &debt_token);
        env.storage().instance().set(&DataKey::CollateralRatio, &collateral_ratio);
        env.storage().instance().set(&DataKey::LiquidationThreshold, &liquidation_threshold);
        env.storage().instance().set(&DataKey::LiquidationBonus, &liquidation_bonus);
        env.storage().instance().set(&DataKey::InterestRateBps, &interest_rate_bps);
        env.storage().instance().set(&DataKey::XlmPriceUsd, &xlm_price_usd);
    }

    /// Admin: update XLM/USD price (oracle feed).
    pub fn set_price(env: Env, price_usd: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if price_usd <= 0 { panic!("price must be positive"); }
        env.storage().instance().set(&DataKey::XlmPriceUsd, &price_usd);
        env.events().publish((symbol_short!("price"), price_usd), env.ledger().sequence());
    }

    /// Admin: update annual interest rate in basis points.
    pub fn set_interest_rate(env: Env, rate_bps: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::InterestRateBps, &rate_bps);
    }

    /// Deposit collateral (XLM) into the pool.
    pub fn deposit_collateral(env: Env, user: Address, amount: i128) {
        if amount <= 0 { panic!("amount must be positive"); }

        let collateral_addr = get_collateral_addr(&env);
        let pool = env.current_contract_address();

        user.require_auth_for_args(
            (collateral_addr.clone(), pool.clone(), amount).into_val(&env),
        );

        let collateral = token::Client::new(&env, &collateral_addr);
        collateral.transfer(&user, &pool, &amount);

        // Accrue interest before updating position
        apply_interest(&env, &user);

        let mut pos = get_position(&env, &user);
        pos.collateral_deposited = pos.collateral_deposited
            .checked_add(amount).expect("overflow");
        save_position(&env, &user, &pos);

        env.events().publish((symbol_short!("deposit"), user), amount);
    }

    /// Borrow dTOKEN against deposited XLM collateral.
    /// Uses USD-denominated health factor via price oracle.
    pub fn borrow(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }

        // Accrue interest first
        apply_interest(&env, &user);

        let pos = get_position(&env, &user);
        let ratio = get_collateral_ratio(&env) as i128;

        // max_borrowable in USD = collateral_usd * 100 / ratio
        let col_usd = collateral_usd(&env, pos.collateral_deposited);
        let max_borrowable = col_usd
            .checked_mul(100).expect("overflow")
            .checked_div(ratio).expect("div zero");

        let new_debt = pos.debt_borrowed.checked_add(amount).expect("overflow");

        if new_debt > max_borrowable {
            panic!("INSUFFICIENT_COLLATERAL");
        }

        let debt = DebtTokenClient::new(&env, &get_debt_addr(&env));
        debt.mint(&user, &amount);

        let mut pos = pos;
        pos.debt_borrowed = new_debt;
        save_position(&env, &user, &pos);

        env.events().publish((symbol_short!("borrow"), user), amount);
    }

    /// Repay dTOKEN debt (principal + interest).
    pub fn repay(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }

        // Accrue interest first
        apply_interest(&env, &user);

        let pos = get_position(&env, &user);
        if amount > pos.debt_borrowed {
            panic!("REPAY_EXCEEDS_DEBT");
        }

        let debt = DebtTokenClient::new(&env, &get_debt_addr(&env));
        debt.burn(&user, &amount);

        let mut pos = pos;
        pos.debt_borrowed = pos.debt_borrowed.checked_sub(amount).expect("underflow");
        save_position(&env, &user, &pos);

        env.events().publish((symbol_short!("repay"), user), amount);
    }

    /// Withdraw XLM collateral, enforcing USD-denominated health factor.
    pub fn withdraw_collateral(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }

        // Accrue interest first
        apply_interest(&env, &user);

        let pos = get_position(&env, &user);
        if pos.collateral_deposited < amount { panic!("insufficient collateral"); }

        let new_collateral = pos.collateral_deposited.checked_sub(amount).expect("underflow");

        if pos.debt_borrowed > 0 {
            let ratio = get_collateral_ratio(&env) as i128;
            let new_col_usd = collateral_usd(&env, new_collateral);
            let max_borrowable = new_col_usd
                .checked_mul(100).expect("overflow")
                .checked_div(ratio).expect("div zero");
            if pos.debt_borrowed > max_borrowable {
                panic!("WOULD_BE_UNDERCOLLATERALIZED");
            }
        }

        let pool = env.current_contract_address();
        let collateral = token::Client::new(&env, &get_collateral_addr(&env));
        collateral.transfer(&pool, &user, &amount);

        let mut pos = pos;
        pos.collateral_deposited = new_collateral;
        save_position(&env, &user, &pos);

        env.events().publish((symbol_short!("withdraw"), user), amount);
    }

    /// Liquidate an under-collateralized position.
    /// Health factor is USD-denominated via price oracle.
    pub fn liquidate(env: Env, liquidator: Address, borrower: Address, repay_amount: i128) {
        liquidator.require_auth();
        if repay_amount <= 0 { panic!("repay_amount must be positive"); }

        // Accrue interest on borrower first
        apply_interest(&env, &borrower);

        let pos = get_position(&env, &borrower);
        if pos.debt_borrowed == 0 { panic!("no debt to liquidate"); }

        let threshold = get_liquidation_threshold(&env) as i128;
        let health = compute_health_factor(&env, pos.collateral_deposited, pos.debt_borrowed) as i128;

        if health >= threshold {
            panic!("POSITION_HEALTHY");
        }

        if repay_amount > pos.debt_borrowed { panic!("repay exceeds debt"); }

        let bonus = get_liquidation_bonus(&env) as i128;
        // Collateral to seize is calculated in XLM units
        // repay_amount is in dTOKEN (USD), convert to XLM via price
        let price = get_xlm_price_usd(&env);
        // xlm_equivalent = repay_amount * 10^7 / price
        let xlm_equivalent = repay_amount
            .checked_mul(10_000_000).expect("overflow")
            .checked_div(price).expect("div zero");
        let collateral_to_seize = xlm_equivalent
            .checked_add(
                xlm_equivalent.checked_mul(bonus).expect("overflow")
                    .checked_div(100).expect("div zero")
            ).expect("overflow");

        if collateral_to_seize > pos.collateral_deposited {
            panic!("insufficient collateral to seize");
        }

        let debt = DebtTokenClient::new(&env, &get_debt_addr(&env));
        debt.burn(&liquidator, &repay_amount);

        let pool = env.current_contract_address();
        let collateral = token::Client::new(&env, &get_collateral_addr(&env));
        collateral.transfer(&pool, &liquidator, &collateral_to_seize);

        let mut pos = pos;
        pos.debt_borrowed = pos.debt_borrowed.checked_sub(repay_amount).expect("underflow");
        pos.collateral_deposited = pos.collateral_deposited
            .checked_sub(collateral_to_seize).expect("underflow");
        save_position(&env, &borrower, &pos);

        env.events().publish(
            (symbol_short!("liquidate"), liquidator.clone(), borrower),
            repay_amount,
        );
    }

    /// Get raw position (collateral + debt including accrued interest).
    pub fn get_position(env: Env, user: Address) -> Position {
        get_position(&env, &user)
    }

    /// Get full position details including USD values and accrued interest.
    pub fn get_position_details(env: Env, user: Address) -> PositionDetails {
        let pos = get_position(&env, &user);
        let pending_interest = accrue_interest(&env, &user);
        let total_debt = pos.debt_borrowed.checked_add(pending_interest).unwrap_or(pos.debt_borrowed);
        let col_usd = collateral_usd(&env, pos.collateral_deposited);
        let health = compute_health_factor(&env, pos.collateral_deposited, total_debt);
        PositionDetails {
            collateral_deposited: pos.collateral_deposited,
            collateral_usd: col_usd,
            debt_borrowed: total_debt,
            accrued_interest: pending_interest,
            health_factor: health,
            xlm_price_usd: get_xlm_price_usd(&env),
        }
    }

    /// Health factor using USD-denominated oracle price. Returns 0 if no debt.
    pub fn get_health_factor(env: Env, user: Address) -> u32 {
        let pos = get_position(&env, &user);
        if pos.debt_borrowed == 0 { return 0; }
        compute_health_factor(&env, pos.collateral_deposited, pos.debt_borrowed)
    }

    /// Get pending (unaccrued) interest for a user.
    pub fn get_pending_interest(env: Env, user: Address) -> i128 {
        accrue_interest(&env, &user)
    }

    pub fn get_config(env: Env) -> LendingConfig {
        LendingConfig {
            admin: env.storage().instance().get(&DataKey::Admin).unwrap(),
            collateral_token: get_collateral_addr(&env),
            debt_token: get_debt_addr(&env),
            collateral_ratio: get_collateral_ratio(&env),
            liquidation_threshold: get_liquidation_threshold(&env),
            liquidation_bonus: get_liquidation_bonus(&env),
            interest_rate_bps: get_interest_rate_bps(&env),
            xlm_price_usd: get_xlm_price_usd(&env),
        }
    }
}

#[cfg(test)]
mod test;
