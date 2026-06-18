import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import {
  liquidate,
  flashLiquidate,
  getPositionDetails,
  formatAmount,
  parseAmount,
  getHealthColor,
  getHealthLabel,
  type PositionDetails,
} from '../lib/ContractInteraction'

interface BorrowerInfo {
  address: string
  details: PositionDetails
}

export function Liquidate() {
  const { address, connected } = useWallet()
  const [borrowerAddress, setBorrowerAddress] = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [borrowerInfo, setBorrowerInfo] = useState<BorrowerInfo | null>(null)
  const [mode, setMode] = useState<'standard' | 'flash'>('standard')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txMessage, setTxMessage] = useState('')

  const LIQUIDATION_THRESHOLD = 120

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!borrowerAddress) return
    setLookupLoading(true)
    setLookupError('')
    setBorrowerInfo(null)

    try {
      const details = await getPositionDetails(borrowerAddress)
      if (!details) {
        setLookupError('Position not found')
        return
      }
      setBorrowerInfo({ address: borrowerAddress, details })
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : 'Failed to fetch position')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleLiquidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address || !borrowerInfo || !repayAmount) return

    const parsed = parseAmount(repayAmount)
    if (parsed <= 0n) return

    setTxStatus('loading')
    setTxMessage(mode === 'flash' ? 'Initiating flash liquidation...' : 'Liquidating position...')

    try {
      if (mode === 'flash') {
        await flashLiquidate(address, borrowerInfo.address, parsed)
      } else {
        await liquidate(address, borrowerInfo.address, parsed)
      }
      setTxStatus('success')
      setTxMessage(
        mode === 'flash'
          ? `Flash liquidation successful! You earned +${formatAmount(netProfit)} XLM profit.`
          : `Successfully liquidated ${repayAmount} dTOKEN of debt from ${borrowerInfo.address.slice(0, 8)}...`
      )
      setRepayAmount('')
      setBorrowerInfo(null)
      setBorrowerAddress('')
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Liquidation failed')
    }
  }

  const isLiquidatable = borrowerInfo && borrowerInfo.details.health_factor > 0 && borrowerInfo.details.health_factor < LIQUIDATION_THRESHOLD

  // Calculations
  const parsedRepay = repayAmount ? parseAmount(repayAmount) : 0n
  const xlmPrice = borrowerInfo ? borrowerInfo.details.xlm_price_usd : 1200000n

  // Standard collateral to seize = repayAmount + 5% bonus
  const collateralToSeize = repayAmount
    ? parsedRepay + (parsedRepay * 5n) / 100n
    : 0n

  // Flash liquidation calculations:
  // xlm_equivalent = repay_amount * 10^7 / price
  const xlmEquivalent = xlmPrice > 0n ? (parsedRepay * 10_000_000n) / xlmPrice : 0n
  // seized = xlm_equivalent * 1.05
  const flashCollateralSeized = (xlmEquivalent * 105n) / 100n
  // fee = 10 bps = 0.1%
  const totalRepay = (parsedRepay * 10010n) / 10000n
  // xlm_needed = total_repay * 10^7 / price
  const xlmNeeded = xlmPrice > 0n ? (totalRepay * 10_000_000n) / xlmPrice : 0n
  // net_profit = seized - xlm_needed
  const netProfit = flashCollateralSeized > xlmNeeded ? flashCollateralSeized - xlmNeeded : 0n

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Liquidations</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Liquidate</h1>
        <p className="text-sm text-[#6b6b6b] mt-2 max-w-sm">
          Positions with a health factor below {LIQUIDATION_THRESHOLD}% are eligible for liquidation.
          Repay a borrower's debt and receive their XLM collateral plus a 5% bonus.
        </p>
      </div>
      <NotDeployedBanner />

      {!connected ? (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 text-center">
          <p className="text-[#6b6b6b]">Connect your wallet to liquidate</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lookup form */}
          <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6">
            <h2 className="font-semibold text-[#1a1a1a] mb-4">Look Up Position</h2>
            <form onSubmit={handleLookup} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Borrower Address
                </label>
                <input
                  type="text"
                  value={borrowerAddress}
                  onChange={(e) => setBorrowerAddress(e.target.value)}
                  placeholder="G..."
                  className="w-full border border-[#e0e0d8] rounded-xl px-4 py-3 text-[#1a1a1a] bg-white focus:outline-none focus:border-[#1a1a1a] transition-colors font-mono text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full border border-[#1a1a1a] text-[#1a1a1a] py-2.5 rounded-xl text-sm font-medium hover:bg-[#1a1a1a] hover:text-white transition-colors disabled:opacity-40"
              >
                {lookupLoading ? 'Looking up...' : 'Look Up Position'}
              </button>
            </form>
            {lookupError && (
              <p className="text-sm text-red-600 mt-2">{lookupError}</p>
            )}
          </div>

          {/* Position info */}
          {borrowerInfo && (
            <div className={`border rounded-2xl p-5 ${
              isLiquidatable
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#1a1a1a] text-sm">Position Details</h3>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isLiquidatable
                    ? 'bg-red-100 text-red-600 border border-red-200'
                    : 'bg-green-100 text-green-700 border border-green-200'
                }`}>
                  {getHealthLabel(borrowerInfo.details.health_factor)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#6b6b6b]">Address</span>
                  <span className="font-mono text-xs text-[#1a1a1a]">
                    {borrowerInfo.address.slice(0, 8)}...{borrowerInfo.address.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6b6b]">Collateral</span>
                  <span className="font-semibold text-[#1a1a1a]">
                    {formatAmount(borrowerInfo.details.collateral_deposited)} XLM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6b6b]">Debt</span>
                  <span className="font-semibold text-[#1a1a1a]">
                    {formatAmount(borrowerInfo.details.debt_borrowed)} dTOKEN
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6b6b]">Health Factor</span>
                  <span className={`font-bold ${getHealthColor(borrowerInfo.details.health_factor)}`}>
                    {borrowerInfo.details.health_factor}%
                  </span>
                </div>
              </div>

              {!isLiquidatable && (
                <p className="text-sm text-green-700 mt-3 bg-green-100 rounded-lg p-2">
                  This position is healthy and cannot be liquidated.
                </p>
              )}
            </div>
          )}

          {/* Liquidation form */}
          {borrowerInfo && isLiquidatable && (
            <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-[#1a1a1a]">Execute Liquidation</h2>

              {/* Pill selector for standard vs flash liquidations */}
              <div className="flex bg-[#f5f5f0] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMode('standard')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === 'standard'
                      ? 'bg-white text-[#1a1a1a] shadow-sm font-semibold'
                      : 'text-[#6b6b6b] hover:text-[#1a1a1a]'
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setMode('flash')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    mode === 'flash'
                      ? 'bg-white text-[#1a1a1a] shadow-sm font-bold'
                      : 'text-[#6b6b6b] hover:text-[#1a1a1a]'
                  }`}
                >
                  <span>⚡</span> Flash Liquidate
                </button>
              </div>

              {mode === 'standard' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    You will repay dTOKEN debt directly from your wallet and receive the seized XLM collateral + 5% bonus.
                    You must hold enough dTOKEN in your wallet.
                  </p>
                </div>
              ) : (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    ⚡ <strong>Zero Capital Required:</strong> You borrow the dTOKEN via a flash loan, perform the liquidation, swap collateral back to repay the loan + fee, and receive the remaining XLM as pure profit.
                  </p>
                </div>
              )}

              <form onSubmit={handleLiquidate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Repay Amount (dTOKEN)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      placeholder="0.0000000"
                      min="0"
                      step="0.0000001"
                      className="w-full border border-[#e0e0d8] rounded-xl px-4 py-3 pr-20 text-[#1a1a1a] bg-white focus:outline-none focus:border-[#1a1a1a] transition-colors"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6b6b6b]">
                      dTOKEN
                    </span>
                  </div>
                </div>

                {repayAmount && parseFloat(repayAmount) > 0 && (
                  mode === 'standard' ? (
                    <div className="bg-[#f5f5f0] rounded-xl p-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#6b6b6b]">Debt repaid</span>
                        <span className="font-medium">{repayAmount} dTOKEN</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b6b6b]">Collateral seized (+5%)</span>
                        <span className="font-medium text-green-700">
                          {formatAmount(collateralToSeize)} XLM
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#f5f5f0] rounded-xl p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#6b6b6b]">Debt liquidated</span>
                        <span className="font-medium">{repayAmount} dTOKEN</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6b6b6b]">Flash Loan Fee (0.1%)</span>
                        <span className="font-medium text-amber-700">
                          {formatAmount(totalRepay - parsedRepay)} dTOKEN
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-[#e2e1d9] pt-2">
                        <span className="text-[#6b6b6b] font-medium">Estimated Net XLM Profit</span>
                        <span className="font-bold text-green-700">
                          +{formatAmount(netProfit)} XLM
                        </span>
                      </div>
                    </div>
                  )
                )}

                <button
                  type="submit"
                  className={`w-full text-white py-3 rounded-xl font-medium transition-colors ${
                    mode === 'flash'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {mode === 'flash' ? '⚡ Flash Liquidate' : 'Liquidate Position'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      <TransactionModal
        status={txStatus}
        message={txMessage}
        onClose={() => setTxStatus('idle')}
      />

      {/* How liquidations work */}
      <div className="mt-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">How liquidations work</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Find an unhealthy position</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed font-normal">Enter any wallet address to check their health factor. Positions below 120% are eligible.</p>
          </div>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Standard vs Flash</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed font-normal">Choose Standard if you have dTOKEN to repay, or use Flash Liquidate to execute with zero capital.</p>
          </div>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Receive collateral + bonus</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed font-normal">Receive borrower's collateral equal to debt repaid plus a 5% bonus. Flash mode swaps back debt automatically, keeping the remainder.</p>
          </div>
        </div>
      </div>

      {/* Formula */}
      <div className="mt-4">
        <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 font-mono text-sm text-[#141414]">
          {mode === 'standard'
            ? 'Collateral seized = Repay amount × 1.05'
            : 'XLM Profit = (Repay amount × 1.05 / Price) - (Repay amount × 1.001 / Price)'}
        </div>
      </div>

      {/* Permissionless note */}
      <div className="mt-4">
        <div className="bg-[#fdf8f0] border border-[#f0e8d0] rounded-xl p-4 flex gap-3">
          <span className="text-amber-500 shrink-0 mt-0.5">△</span>
          <p className="text-sm text-[#6b6b6b] leading-relaxed font-normal">Liquidations are permissionless. Any wallet can liquidate any eligible position. The 5% bonus is the liquidator's incentive — no special role or whitelist required.</p>
        </div>
      </div>
    </div>
  )
}
