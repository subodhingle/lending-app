#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, Env, Val, Vec, IntoVal, token,
};

mod pool_client {
    use soroban_sdk::{contractclient, Address, Env};

    #[derive(Clone)]
    #[soroban_sdk::contracttype]
    pub struct LendingConfig {
        pub admin: Address,
        pub collateral_token: Address,
        pub debt_token: Address,
        pub collateral_ratio: u32,
        pub liquidation_threshold: u32,
        pub liquidation_bonus: u32,
        pub interest_rate_bps: u32,
        pub xlm_price_usd: i128,
    }

    #[contractclient(name = "LendingPoolClient")]
    #[allow(dead_code)]
    pub trait LendingPoolTrait {
        fn liquidate(env: Env, liquidator: Address, borrower: Address, repay_amount: i128);
        fn swap_collateral_for_debt(env: Env, receiver: Address, xlm_amount: i128);
        fn get_config(env: Env) -> LendingConfig;
    }
}
use pool_client::{LendingPoolClient, LendingConfig};

mod loan_client {
    use soroban_sdk::{contractclient, Address, Env, Val, Vec};
    #[contractclient(name = "FlashLoanPoolClient")]
    #[allow(dead_code)]
    pub trait FlashLoanPoolTrait {
        fn flash_loan(env: Env, receiver: Address, amount: i128, fee_bps: u32, args: Vec<Val>);
    }
}
use loan_client::FlashLoanPoolClient;

#[contract]
pub struct FlashLiquidator;

#[contractimpl]
impl FlashLiquidator {
    pub fn flash_loan_callback(
        env: Env,
        pool: Address, // This is the FlashLoanPool address
        amount: i128,
        fee: i128,
        args: Vec<Val>,
    ) {
        // Callback is called by pool, verify it is indeed the caller
        pool.require_auth();

        let borrower: Address = args.get(0).unwrap().into_val(&env);
        let initiator: Address = args.get(1).unwrap().into_val(&env);
        let lending_pool: Address = args.get(2).unwrap().into_val(&env);

        let pool_client = LendingPoolClient::new(&env, &lending_pool);
        let config: LendingConfig = pool_client.get_config();

        // 1. Liquidate the borrower. Seizes collateral to current contract.
        pool_client.liquidate(&env.current_contract_address(), &borrower, &amount);

        // 2. Repay loan: amount + fee in dTOKEN.
        let total_repay = amount.checked_add(fee).expect("overflow");

        // Swap cost = total_repay * 10^7 / price
        let xlm_needed = total_repay
            .checked_mul(10_000_000).expect("overflow")
            .checked_div(config.xlm_price_usd).expect("div zero");

        // 3. Swap XLM collateral for dTOKEN.
        pool_client.swap_collateral_for_debt(&env.current_contract_address(), &xlm_needed);

        // 4. Repay flash loan by transferring dTOKEN back to the FlashLoanPool
        let debt_token = token::Client::new(&env, &config.debt_token);
        debt_token.transfer(&env.current_contract_address(), &pool, &total_repay);

        // 5. Forward remaining XLM profit to initiator
        let collateral_token = token::Client::new(&env, &config.collateral_token);
        let current_balance = collateral_token.balance(&env.current_contract_address());
        if current_balance > 0 {
            collateral_token.transfer(&env.current_contract_address(), &initiator, &current_balance);
        }
    }

    pub fn flash_liquidate(
        env: Env,
        initiator: Address,
        borrower: Address,
        lending_pool: Address,
        flash_loan_pool: Address,
        repay_amount: i128,
    ) {
        initiator.require_auth();

        let loan_client = FlashLoanPoolClient::new(&env, &flash_loan_pool);
        let args: Vec<Val> = (borrower, initiator, lending_pool).into_val(&env);

        // Call flash_loan: 10 bps fee
        loan_client.flash_loan(&env.current_contract_address(), &repay_amount, &10u32, &args);
    }
}
