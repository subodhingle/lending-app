import {
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  Account,
  nativeToScVal,
  scValToNative,
  rpc as SorobanRpc,
  xdr,
} from '@stellar/stellar-sdk'
import {
  isConnected,
  getAddress,
  signTransaction,
  isAllowed,
} from '@stellar/freighter-api'

const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE = Networks.TESTNET

export const server = new SorobanRpc.Server(RPC_URL)

// A Stellar contract ID is a 56-char string starting with 'C'
function isValidContractId(id: string | undefined): boolean {
  return typeof id === 'string' && /^C[A-Z2-7]{55}$/.test(id)
}

export const CONTRACT_IDS = {
  collateralToken: import.meta.env.VITE_COLLATERAL_TOKEN_ID as string,
  debtToken: import.meta.env.VITE_DEBT_TOKEN_ID as string,
  lendingPool: import.meta.env.VITE_LENDING_POOL_ID as string,
}

// The collateral token is native XLM (Stellar Asset Contract)
export const COLLATERAL_SYMBOL = 'XLM'
export const DEBT_SYMBOL = 'dTOKEN'

export function contractsDeployed(): boolean {
  return (
    isValidContractId(CONTRACT_IDS.collateralToken) &&
    isValidContractId(CONTRACT_IDS.debtToken) &&
    isValidContractId(CONTRACT_IDS.lendingPool)
  )
}

// ── Wallet helpers ────────────────────────────────────────────────────────────

export async function checkWalletConnected(): Promise<boolean> {
  try {
    const connected = await isConnected()
    return connected.isConnected
  } catch {
    return false
  }
}

export async function checkWalletAllowed(): Promise<boolean> {
  try {
    const allowed = await isAllowed()
    return allowed.isAllowed
  } catch {
    return false
  }
}

export async function getWalletAddress(): Promise<string> {
  const result = await getAddress()
  if (result.error) throw new Error(result.error)
  return result.address
}

// ── Core invoke helper ────────────────────────────────────────────────────────

export async function invokeContract(
  contractId: string,
  method: string,
  params: xdr.ScVal[]
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  if (!isValidContractId(contractId)) {
    throw new Error(`Contract not deployed yet. Run scripts/deploy.sh to deploy to testnet.`)
  }
  const publicKey = await getWalletAddress()
  const account = await server.getAccount(publicKey)
  const contract = new Contract(contractId)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build()

  const preparedTx = await server.prepareTransaction(tx)
  const signResult = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  })

  if (signResult.error) throw new Error(signResult.error)

  const signedTx = TransactionBuilder.fromXDR(
    signResult.signedTxXdr,
    NETWORK_PASSPHRASE
  )
  const result = await server.sendTransaction(signedTx)

  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`)
  }

  // Poll for confirmation
  let response = await server.getTransaction(result.hash)
  let attempts = 0
  while (response.status === 'NOT_FOUND' && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000))
    response = await server.getTransaction(result.hash)
    attempts++
  }

  if (response.status === 'FAILED') {
    throw new Error('Transaction failed on-chain')
  }

  return response
}

// ── Read-only simulation ──────────────────────────────────────────────────────

// A funded testnet account used as simulation source for read-only calls.
// This avoids "account not found" errors when simulating with random keypairs.
const SIMULATION_SOURCE = 'GC5HL2KXTCEXGZU4N6QIDQLIXW6HSFYEZV7ELAEEHDL4EHUMVSTZCPX6'

export async function simulateContract(
  contractId: string,
  method: string,
  params: xdr.ScVal[],
  sourceAccount?: string
): Promise<xdr.ScVal | null> {
  if (!isValidContractId(contractId)) {
    return null
  }

  // Use provided source, or the known funded deployer address.
  // A random keypair won't work — the account must exist on-chain.
  const source = sourceAccount || SIMULATION_SOURCE

  let seq: string
  try {
    const acct = await server.getAccount(source)
    // Account.sequenceNumber() returns the sequence as a string
    seq = acct.sequenceNumber()
  } catch {
    seq = '0'
  }

  const account = new Account(source, seq)
  const contract = new Contract(contractId)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
    return null
  }
  return sim.result?.retval ?? null
}

// ── ScVal helpers ─────────────────────────────────────────────────────────────

// A Stellar address is either a 56-char G... (account) or C... (contract)
function isValidStellarAddress(addr: string): boolean {
  return typeof addr === 'string' && /^[GC][A-Z2-7]{55}$/.test(addr)
}

export function addressVal(address: string): xdr.ScVal {
  if (!isValidStellarAddress(address)) {
    throw new Error(`Invalid Stellar address: "${address}". Run scripts/deploy.sh first.`)
  }
  return nativeToScVal(new Address(address), { type: 'address' })
}

export function i128Val(amount: bigint): xdr.ScVal {
  return nativeToScVal(amount, { type: 'i128' })
}

export function u32Val(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: 'u32' })
}

export { scValToNative }

// ── Lending Pool calls ────────────────────────────────────────────────────────

export interface Position {
  collateral_deposited: bigint
  debt_borrowed: bigint
}

export interface LendingConfig {
  admin: string
  collateral_token: string
  debt_token: string
  collateral_ratio: number
  liquidation_threshold: number
  liquidation_bonus: number
}

export async function getPosition(userAddress: string): Promise<Position> {
  try {
    const result = await simulateContract(
      CONTRACT_IDS.lendingPool,
      'get_position',
      [addressVal(userAddress)],
      userAddress
    )
    if (!result) return { collateral_deposited: 0n, debt_borrowed: 0n }
    const native = scValToNative(result) as Record<string, bigint>
    return {
      collateral_deposited: BigInt(native.collateral_deposited ?? 0),
      debt_borrowed: BigInt(native.debt_borrowed ?? 0),
    }
  } catch {
    return { collateral_deposited: 0n, debt_borrowed: 0n }
  }
}

export async function getHealthFactor(userAddress: string): Promise<number> {
  try {
    const result = await simulateContract(
      CONTRACT_IDS.lendingPool,
      'get_health_factor',
      [addressVal(userAddress)],
      userAddress
    )
    if (!result) return 0
    return Number(scValToNative(result))
  } catch {
    return 0
  }
}

export async function getLendingConfig(): Promise<LendingConfig | null> {
  try {
    const result = await simulateContract(
      CONTRACT_IDS.lendingPool,
      'get_config',
      []
    )
    if (!result) return null
    const native = scValToNative(result) as Record<string, unknown>
    return {
      admin: String(native.admin),
      collateral_token: String(native.collateral_token),
      debt_token: String(native.debt_token),
      collateral_ratio: Number(native.collateral_ratio),
      liquidation_threshold: Number(native.liquidation_threshold),
      liquidation_bonus: Number(native.liquidation_bonus),
    }
  } catch {
    return null
  }
}

export async function getTokenBalance(
  tokenId: string,
  userAddress: string
): Promise<bigint> {
  try {
    const result = await simulateContract(
      tokenId,
      'balance',
      [addressVal(userAddress)],
      userAddress
    )
    if (!result) return 0n
    return BigInt(scValToNative(result) as number)
  } catch {
    return 0n
  }
}

export async function depositCollateral(
  userAddress: string,
  amount: bigint
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  return invokeContract(CONTRACT_IDS.lendingPool, 'deposit_collateral', [
    addressVal(userAddress),
    i128Val(amount),
  ])
}

export async function borrow(
  userAddress: string,
  amount: bigint
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  return invokeContract(CONTRACT_IDS.lendingPool, 'borrow', [
    addressVal(userAddress),
    i128Val(amount),
  ])
}

export async function repay(
  userAddress: string,
  amount: bigint
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  return invokeContract(CONTRACT_IDS.lendingPool, 'repay', [
    addressVal(userAddress),
    i128Val(amount),
  ])
}

export async function withdrawCollateral(
  userAddress: string,
  amount: bigint
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  return invokeContract(CONTRACT_IDS.lendingPool, 'withdraw_collateral', [
    addressVal(userAddress),
    i128Val(amount),
  ])
}

export async function approveCollateral(
  userAddress: string,
  amount: bigint
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  return invokeContract(CONTRACT_IDS.collateralToken, 'approve', [
    addressVal(userAddress),
    addressVal(CONTRACT_IDS.lendingPool),
    i128Val(amount),
    u32Val(999999),
  ])
}

export async function liquidate(
  liquidatorAddress: string,
  borrowerAddress: string,
  repayAmount: bigint
): Promise<SorobanRpc.Api.GetTransactionResponse> {
  return invokeContract(CONTRACT_IDS.lendingPool, 'liquidate', [
    addressVal(liquidatorAddress),
    addressVal(borrowerAddress),
    i128Val(repayAmount),
  ])
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatAmount(amount: bigint, decimals = 7): string {
  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const frac = amount % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fracStr ? `${whole}.${fracStr}` : `${whole}`
}

export function parseAmount(amount: string, decimals = 7): bigint {
  if (!amount || amount === '') return 0n
  const [whole, frac = ''] = amount.split('.')
  const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole || '0') * BigInt(10 ** decimals) + BigInt(fracPadded || '0')
}

export function getHealthColor(hf: number): string {
  if (hf === 0) return 'text-gray-500'
  if (hf >= 150) return 'text-green-700'
  if (hf >= 120) return 'text-amber-600'
  return 'text-red-600'
}

export function getHealthBg(hf: number): string {
  if (hf === 0) return 'bg-white border-[#e0e0d8]'
  if (hf >= 150) return 'bg-green-50 border-green-200'
  if (hf >= 120) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

export function getHealthLabel(hf: number): string {
  if (hf === 0) return 'No Debt'
  if (hf >= 150) return 'Safe'
  if (hf >= 120) return 'Warning'
  return 'Danger'
}
