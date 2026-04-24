import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import {
  borrow,
  getPosition,
  formatAmount,
  parseAmount,
  COLLATERAL_SYMBOL,
  DEBT_SYMBOL,
  type Position,
} from '../lib/ContractInteraction'

export function Borrow() {
  const { address, connected } = useWallet()
  const [amount, setAmount] = useState('')
  const [position, setPosition] = useState<Position>({ collateral_deposited: 0n, debt_borrowed: 0n })
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txMessage, setTxMessage] = useState('')

  const COLLATERAL_RATIO = 150n
  const maxBorrowable = position.collateral_deposited * 100n / COLLATERAL_RATIO
  const availableToBorrow = maxBorrowable > position.debt_borrowed
    ? maxBorrowable - position.debt_borrowed : 0n
  const utilizationPct = maxBorrowable > 0n
    ? Number((position.debt_borrowed * 100n) / maxBorrowable) : 0

  useEffect(() => {
    if (!address) return
    getPosition(address).then(setPosition).catch(console.error)
  }, [address])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address || !amount) return
    const parsed = parseAmount(amount)
    if (parsed <= 0n) return
    setTxStatus('loading')
    setTxMessage(`Borrowing ${DEBT_SYMBOL}...`)
    try {
      await borrow(address, parsed)
      setTxStatus('success')
      setTxMessage(`Successfully borrowed ${amount} ${DEBT_SYMBOL}.`)
      setAmount('')
      const pos = await getPosition(address)
      setPosition(pos)
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Transaction failed')
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Borrow</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Borrow dTOKEN</h1>
        <p className="text-sm text-[#6b6b6b] mt-2 max-w-sm">
          Draw liquidity against your XLM collateral. Keep your health factor above 120%
          to avoid liquidation. Repay any time — no fixed schedule, no interest rate.
        </p>
      </div>
      <NotDeployedBanner />

      {!connected ? (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 text-center">
          <p className="text-[#6b6b6b]">Connect your wallet to borrow</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 space-y-5">
          <div className="bg-[#f5f5f0] rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Collateral Deposited</span>
              <span className="font-semibold text-[#1a1a1a]">{formatAmount(position.collateral_deposited)} {COLLATERAL_SYMBOL}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Max Borrowable (150%)</span>
              <span className="font-semibold text-[#1a1a1a]">{formatAmount(maxBorrowable)} {DEBT_SYMBOL}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Current Debt</span>
              <span className="font-semibold text-[#1a1a1a]">{formatAmount(position.debt_borrowed)} {DEBT_SYMBOL}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Available to Borrow</span>
              <span className="font-bold text-green-700">{formatAmount(availableToBorrow)} {DEBT_SYMBOL}</span>
            </div>
            {maxBorrowable > 0n && (
              <div>
                <div className="flex justify-between text-xs text-[#6b6b6b] mb-1">
                  <span>Utilization</span><span>{utilizationPct}%</span>
                </div>
                <div className="h-2 bg-[#e8e8e0] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    utilizationPct >= 90 ? 'bg-red-500' : utilizationPct >= 70 ? 'bg-amber-500' : 'bg-green-500'
                  }`} style={{ width: `${Math.min(utilizationPct, 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          {position.collateral_deposited === 0n && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-700">Deposit {COLLATERAL_SYMBOL} first before borrowing.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Amount to Borrow</label>
              <div className="relative">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0000000" min="0" step="0.0000001"
                  className="w-full border border-[#e0e0d8] rounded-xl px-4 py-3 pr-24 text-[#1a1a1a] bg-white focus:outline-none focus:border-[#1a1a1a] transition-colors"
                  required />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button type="button" onClick={() => setAmount(formatAmount(availableToBorrow))}
                    className="text-xs text-[#6b6b6b] hover:text-[#1a1a1a] font-medium">MAX</button>
                  <span className="text-sm font-medium text-[#6b6b6b]">{DEBT_SYMBOL}</span>
                </div>
              </div>
            </div>
            <button type="submit"
              disabled={!amount || parseFloat(amount) <= 0 || position.collateral_deposited === 0n}
              className="w-full bg-[#1a1a1a] text-white py-3 rounded-xl font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Borrow {DEBT_SYMBOL}
            </button>
          </form>
        </div>
      )}
      {/* Understanding your borrow limit */}
      <div className="mt-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">Understanding your borrow limit</p>
        <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5 space-y-4">
          <div className="space-y-2">
            <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 font-mono text-sm text-[#141414]">
              Max borrowable = Collateral × 100 ÷ 150
            </div>
            <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 font-mono text-sm text-[#141414]">
              Example: 300 XLM deposited → max 200 dTOKEN borrowable
            </div>
            <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 font-mono text-sm text-[#141414]">
              Your health factor = Collateral × 100 ÷ Debt. Keep it above 120% at all times.
            </div>
          </div>
        </div>
      </div>

      {/* Warning box */}
      <div className="mt-4">
        <div className="bg-[#fdf8f0] border border-[#f0e8d0] rounded-xl p-4 flex gap-3">
          <span className="text-amber-500 shrink-0 mt-0.5">△</span>
          <p className="text-sm text-[#6b6b6b] leading-relaxed">Borrow conservatively. XLM price volatility can erode your health factor quickly. Leaving a buffer above 150% gives you room to react before liquidation risk kicks in.</p>
        </div>
      </div>

      <TransactionModal status={txStatus} message={txMessage} onClose={() => setTxStatus('idle')} />
    </div>
  )
}
