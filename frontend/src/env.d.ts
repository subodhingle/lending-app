/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COLLATERAL_TOKEN_ID: string
  readonly VITE_DEBT_TOKEN_ID: string
  readonly VITE_LENDING_POOL_ID: string
  readonly VITE_LENDING_POOL_V2_ID: string
  readonly VITE_FLASH_LOAN_POOL_ID: string
  readonly VITE_FLASH_LIQUIDATOR_ID: string
  readonly VITE_NETWORK: string
  readonly VITE_RPC_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
