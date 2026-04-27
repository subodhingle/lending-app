import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import {
  liquidate,
  getPosition,
  getHealthFactor,
  formatAmount,
  parseAmount,
  getHealthColor,
  getHealthLabel,
  type Position,
} from '../lib/ContractInteraction'

interface BorrowerInfo {
  address: string
  position: Position
  healthFactor: number
}

export function Liquidate() {
  const { address, connected } = useWallet()
  const [borrowerAddress, setBorrowerAddress] = useState('')
  const [repayAmount, setRepayAmount] = useState('')
  const [borrowerInfo, setBorrowerInfo] = useState<BorrowerInfo | null>(null)
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
      const [pos, hf] = await Promise.all([
        getPosition(borrowerAddress),
        getHealthFactor(borrowerAddress),
      ])
      setBorrowerInfo({ address: borrowerAddress, position: pos, healthFactor: hf })
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
    setTxMessage('Liquidating position...')

    try {
      await liquidate(address, borrowerInfo.address, parsed)
      setTxStatus('success')
      setTxMessage(`Successfully liquidated ${repayAmount} dTOKEN of debt from ${borrowerInfo.address.slice(0, 8)}...`)
      setRepayAmount('')
      setBorrowerInfo(null)
      setBorrowerAddress('')
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Liquidation failed')
    }
  }

  const isLiquidatable = borrowerInfo && borrowerInfo.healthFactor > 0 && borrowerInfo.healthFactor < LIQUIDATION_THRESHOLD

  // Collateral to seize = repayAmount + 5% bonus
  const collateralToSeize = repayAmount
    ? parseAmount(repayAmount) + parseAmount(repayAmount) * 5n / 100n
    : 0n

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
                  {getHealthLabel(borrowerInfo.healthFactor)}
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
                    {formatAmount(borrowerInfo.position.collateral_deposited)} XLM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6b6b]">Debt</span>
                  <span className="font-semibold text-[#1a1a1a]">
                    {formatAmount(borrowerInfo.position.debt_borrowed)} dTOKEN
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6b6b6b]">Health Factor</span>
                  <span className={`font-bold ${getHealthColor(borrowerInfo.healthFactor)}`}>
                    {borrowerInfo.healthFactor}%
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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  You will repay dTOKEN debt and receive XLM collateral + 5% bonus.
                  You must hold enough dTOKEN in your wallet.
                </p>
              </div>

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
                )}

                <button
                  type="submit"
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  Liquidate Position
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
            <p className="text-sm text-[#6b6b6b] leading-relaxed">Enter any wallet address to check their health factor. Positions below 120% are eligible.</p>
          </div>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Repay their debt</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">You pay dTOKEN on behalf of the borrower. You must hold enough dTOKEN in your wallet.</p>
          </div>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Receive collateral + bonus</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">You receive XLM collateral equal to the debt repaid plus a 5% bonus. Net positive for you, net protective for the protocol.</p>
          </div>
        </div>
      </div>

      {/* Formula */}
      <div className="mt-4">
        <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 font-mono text-sm text-[#141414]">
          Collateral seized = Repay amount × 1.05
        </div>
      </div>

      {/* Permissionless note */}
      <div className="mt-4">
        <div className="bg-[#fdf8f0] border border-[#f0e8d0] rounded-xl p-4 flex gap-3">
          <span className="text-amber-500 shrink-0 mt-0.5">△</span>
          <p className="text-sm text-[#6b6b6b] leading-relaxed">Liquidations are permissionless. Any wallet can liquidate any eligible position. The 5% bonus is the liquidator's incentive — no special role or whitelist required.</p>
        </div>
      </div>
    </div>
  )
}
