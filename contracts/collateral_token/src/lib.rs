#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
}

#[contract]
pub struct CollateralToken;

#[contractimpl]
impl CollateralToken {
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String, decimals: u32) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }
        let balance = Self::balance(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(balance + amount));
        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply + amount));
        env.events().publish((symbol_short!("mint"), to), amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }
        let balance = Self::balance(env.clone(), from.clone());
        if balance < amount { panic!("insufficient balance"); }
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(balance - amount));
        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply - amount));
        env.events().publish((symbol_short!("burn"), from), amount);
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }
        let from_balance = Self::balance(env.clone(), from.clone());
        if from_balance < amount { panic!("insufficient balance"); }
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        let to_balance = Self::balance(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(to_balance + amount));
        env.events().publish((symbol_short!("transfer"), from, to), amount);
    }

    /// transfer_from: requires spender auth only (Soroban auth-tree model).
    /// The spender is the calling contract (e.g. lending_pool). Since the pool
    /// IS the caller, spender.require_auth() is satisfied automatically.
    /// No allowance check — the transaction auth tree is the authorization.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 { panic!("amount must be positive"); }
        let from_balance = Self::balance(env.clone(), from.clone());
        if from_balance < amount { panic!("INSUFFICIENT_BALANCE"); }
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &(from_balance - amount));
        let to_balance = Self::balance(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(to.clone()), &(to_balance + amount));
        env.events().publish((symbol_short!("xfer_from"), spender, from, to), amount);
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        env.storage().persistent().set(&DataKey::Allowance(from.clone(), spender.clone()), &amount);
        env.events().publish((symbol_short!("approve"), from, spender), amount);
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Allowance(from, spender)).unwrap_or(0)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(id)).unwrap_or(0)
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
