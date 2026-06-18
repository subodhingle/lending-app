#![no_std]

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, Env, Symbol, Val, Vec, IntoVal,
};

#[contract]
pub struct FlashLoanPool;

#[contractimpl]
impl FlashLoanPool {
    pub fn initialize(env: Env, token: Address) {
        if env.storage().instance().has(&symbol_short!("token")) {
            panic!("already initialized");
        }
        env.storage().instance().set(&symbol_short!("token"), &token);
    }

    pub fn get_token(env: Env) -> Address {
        env.storage().instance().get(&symbol_short!("token")).unwrap()
    }

    pub fn flash_loan(
        env: Env,
        receiver: Address,
        amount: i128,
        fee_bps: u32,
        args: Vec<Val>,
    ) {
        if amount <= 0 { panic!("amount must be positive"); }
        let token_addr: Address = env.storage().instance().get(&symbol_short!("token")).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        // 1. Calculate pool balance before loan
        let balance_before = token_client.balance(&env.current_contract_address());

        // 2. Transfer amount to receiver
        token_client.transfer(&env.current_contract_address(), &receiver, &amount);

        // 3. Execute callback on receiver
        let fee = amount
            .checked_mul(fee_bps as i128).unwrap()
            .checked_div(10_000).unwrap();

        let callback_fn = Symbol::new(&env, "flash_loan_callback");
        let callback_args: Vec<Val> = (
            env.current_contract_address(),
            amount,
            fee,
            args,
        ).into_val(&env);

        env.invoke_contract::<Val>(&receiver, &callback_fn, callback_args);

        // 4. Verify that the balance is restored to balance_before + fee
        let balance_after = token_client.balance(&env.current_contract_address());
        let required_balance = balance_before.checked_add(fee).unwrap();

        if balance_after < required_balance {
            panic!("FLASH_LOAN_NOT_REPAID");
        }
    }
}
