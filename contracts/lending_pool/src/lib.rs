#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, IntoVal,
};

// ── Custom client for debt token mint/burn ────────────────────────────────────
// soroban_sdk::token::Client only covers the standard SEP-41 interface.
// Our debt token has additional mint/burn functions controlled by the minter.
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
    CollateralRatio,
    LiquidationThreshold,
    LiquidationBonus,
    Position(Address),
}

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Clone)]
#[contracttype]
pub struct Position {
    pub collateral_deposited: i128,
    pub debt_borrowed: i128,
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

fn get_collateral_addr(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::CollateralToken).unwrap()
}

fn get_debt_addr(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::DebtToken).unwrap()
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct LendingPool;

#[contractimpl]
impl LendingPool {
    pub fn initialize(
        env: Env,
        admin: Address,
        collateral_token: Address,
        debt_token: Address,
        collateral_ratio: u32,
        liquidation_threshold: u32,
        liquidation_bonus: u32,
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
    }

    /// Deposit collateral into the pool.
    ///
    /// Pattern from the official Stellar atomic_swap example:
    /// - `user.require_auth_for_args(...)` declares that the user authorizes
    ///   the sub-invocation of token.transfer(user, pool, amount).
    /// - `token::Client::transfer(user, pool, amount)` then calls
    ///   `from.require_auth()` inside the token, which is satisfied because
    ///   we declared it above via require_auth_for_args.
    pub fn deposit_collateral(env: Env, user: Address, amount: i128) {
        if amount <= 0 { panic!("amount must be positive"); }

        let collateral_addr = get_collateral_addr(&env);
        let pool = env.current_contract_address();

        // Declare user's authorization for the sub-invocation.
        // Args must match exactly: (token_addr, to, amount) as used by transfer.
        user.require_auth_for_args(
            (collateral_addr.clone(), pool.clone(), amount).into_val(&env),
        );

        // Use the standard SDK token client — this calls transfer(from, to, amount)
        // on the collateral token. The user's auth declared above covers this.
        let collateral = token::Client::new(&env, &collateral_addr);
        collateral.transfer(&user, &pool, &amount);

        let mut pos = get_position(&env, &user);
        pos.collateral_deposited = pos.collateral_deposited
            .checked_add(amount).expect("overflow");
        save_position(&env, &user, &pos);

        env.events().publish((symbol_short!("deposit"), user), amount);
    }

    /// Borrow debt tokens against deposited collateral.
    pub fn borrow(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }

        let pos = get_position(&env, &user);
        let ratio = get_collateral_ratio(&env) as i128;
        let max_borrowable = pos.collateral_deposited
            .checked_mul(100).expect("overflow")
            .checked_div(ratio).expect("div zero");
        let new_debt = pos.debt_borrowed.checked_add(amount).expect("overflow");

        if new_debt > max_borrowable {
            panic!("INSUFFICIENT_COLLATERAL");
        }

        // Pool is the authorized minter — calling mint is implicitly authorized
        // because pool is the caller and the debt token checks minter.require_auth()
        // where minter == pool == current caller.
        let debt = DebtTokenClient::new(&env, &get_debt_addr(&env));
        debt.mint(&user, &amount);

        let mut pos = pos;
        pos.debt_borrowed = new_debt;
        save_position(&env, &user, &pos);

        env.events().publish((symbol_short!("borrow"), user), amount);
    }

    /// Repay debt. Pool burns the user's debt tokens.
    pub fn repay(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }

        let pos = get_position(&env, &user);
        if amount > pos.debt_borrowed {
            panic!("REPAY_EXCEEDS_DEBT");
        }

        // Pool is the authorized minter/burner — burn is implicitly authorized.
        let debt = DebtTokenClient::new(&env, &get_debt_addr(&env));
        debt.burn(&user, &amount);

        let mut pos = pos;
        pos.debt_borrowed = pos.debt_borrowed.checked_sub(amount).expect("underflow");
        save_position(&env, &user, &pos);

        env.events().publish((symbol_short!("repay"), user), amount);
    }

    /// Withdraw collateral back to user.
    /// Pool owns the collateral so transfer(pool→user) is authorized because
    /// pool is the caller of the token contract.
    pub fn withdraw_collateral(env: Env, user: Address, amount: i128) {
        user.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }

        let pos = get_position(&env, &user);
        if pos.collateral_deposited < amount { panic!("insufficient collateral"); }

        let new_collateral = pos.collateral_deposited.checked_sub(amount).expect("underflow");

        if pos.debt_borrowed > 0 {
            let ratio = get_collateral_ratio(&env) as i128;
            let max_borrowable = new_collateral
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
    pub fn liquidate(env: Env, liquidator: Address, borrower: Address, repay_amount: i128) {
        liquidator.require_auth();
        if repay_amount <= 0 { panic!("repay_amount must be positive"); }

        let pos = get_position(&env, &borrower);
        if pos.debt_borrowed == 0 { panic!("no debt to liquidate"); }

        let threshold = get_liquidation_threshold(&env) as i128;
        let health = pos.collateral_deposited
            .checked_mul(100).expect("overflow")
            .checked_div(pos.debt_borrowed).expect("div zero");

        if health >= threshold {
            panic!("POSITION_HEALTHY");
        }

        if repay_amount > pos.debt_borrowed { panic!("repay exceeds debt"); }

        let bonus = get_liquidation_bonus(&env) as i128;
        let collateral_to_seize = repay_amount
            .checked_add(
                repay_amount.checked_mul(bonus).expect("overflow")
                    .checked_div(100).expect("div zero")
            ).expect("overflow");

        if collateral_to_seize > pos.collateral_deposited {
            panic!("insufficient collateral to seize");
        }

        // Burn liquidator's debt tokens (pool is authorized burner)
        let debt = DebtTokenClient::new(&env, &get_debt_addr(&env));
        debt.burn(&liquidator, &repay_amount);

        // Transfer seized collateral from pool to liquidator (pool owns it)
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

    pub fn get_position(env: Env, user: Address) -> Position {
        get_position(&env, &user)
    }

    pub fn get_health_factor(env: Env, user: Address) -> u32 {
        let pos = get_position(&env, &user);
        if pos.debt_borrowed == 0 { return 0; }
        let health = pos.collateral_deposited
            .checked_mul(100).expect("overflow")
            .checked_div(pos.debt_borrowed).expect("div zero");
        health as u32
    }

    pub fn get_config(env: Env) -> LendingConfig {
        LendingConfig {
            admin: env.storage().instance().get(&DataKey::Admin).unwrap(),
            collateral_token: get_collateral_addr(&env),
            debt_token: get_debt_addr(&env),
            collateral_ratio: get_collateral_ratio(&env),
            liquidation_threshold: get_liquidation_threshold(&env),
            liquidation_bonus: get_liquidation_bonus(&env),
        }
    }
}

#[cfg(test)]
mod test;
