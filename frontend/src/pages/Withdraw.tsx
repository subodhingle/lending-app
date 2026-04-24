import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import {
  withdrawCollateral,
  getPosition,
  formatAmount,
  parseAmount,
  COLLATERAL_SYMBOL,
  DEBT_SYMBOL,
  type Position,
} from '../lib/ContractInteraction'

export function Withdraw() {
  const { address, connected } = useWallet()
  const [amount, setAmount] = useState('')
  const [position, setPosition] = useState<Position>({ collateral_deposited: 0n, debt_borrowed: 0n })
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txMessage, setTxMessage] = useState('')

  const COLLATERAL_RATIO = 150n
  const minCollateralRequired = position.debt_borrowed > 0n
    ? (position.debt_borrowed * COLLATERAL_RATIO) / 100n : 0n
  const maxWithdrawable = position.collateral_deposited > minCollateralRequired
    ? position.collateral_deposited - minCollateralRequired : 0n

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
    setTxMessage(`Withdrawing ${COLLATERAL_SYMBOL}...`)
    try {
      await withdrawCollateral(address, parsed)
      setTxStatus('success')
      setTxMessage(`Successfully withdrew ${amount} ${COLLATERAL_SYMBOL}.`)
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
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Collateral</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Withdraw XLM</h1>
        <p className="text-sm text-[#6b6b6b] mt-2 max-w-sm">
          Reclaim your XLM collateral. The protocol enforces a 150% collateral ratio —
          you can only withdraw what keeps your remaining position healthy.
        </p>
      </div>
      <NotDeployedBanner />

      {!connected ? (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 text-center">
          <p className="text-[#6b6b6b]">Connect your wallet to withdraw</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 space-y-5">
          <div className="bg-[#f5f5f0] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Deposited</span>
              <span className="font-semibold text-[#1a1a1a]">{formatAmount(position.collateral_deposited)} {COLLATERAL_SYMBOL}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Outstanding Debt</span>
              <span className="font-semibold text-[#1a1a1a]">{formatAmount(position.debt_borrowed)} {DEBT_SYMBOL}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Min Collateral Required</span>
              <span className="font-semibold text-[#1a1a1a]">{formatAmount(minCollateralRequired)} {COLLATERAL_SYMBOL}</span>
            </div>
            <div className="border-t border-[#e0e0d8] pt-2 flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Max Withdrawable</span>
              <span className="font-bold text-green-700">{formatAmount(maxWithdrawable)} {COLLATERAL_SYMBOL}</span>
            </div>
          </div>

          {position.collateral_deposited === 0n && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-700">No collateral deposited.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Amount to Withdraw</label>
              <div className="relative">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0000000" min="0" step="0.0000001"
                  className="w-full border border-[#e0e0d8] rounded-xl px-4 py-3 pr-20 text-[#1a1a1a] bg-white focus:outline-none focus:border-[#1a1a1a] transition-colors"
                  required />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button type="button" onClick={() => setAmount(formatAmount(maxWithdrawable))}
                    className="text-xs text-[#6b6b6b] hover:text-[#1a1a1a] font-medium">MAX</button>
                  <span className="text-sm font-medium text-[#6b6b6b]">{COLLATERAL_SYMBOL}</span>
                </div>
              </div>
            </div>
            <button type="submit"
              disabled={!amount || parseFloat(amount) <= 0 || position.collateral_deposited === 0n}
              className="w-full bg-[#1a1a1a] text-white py-3 rounded-xl font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Withdraw {COLLATERAL_SYMBOL}
            </button>
          </form>
        </div>
      )}
      {/* Withdrawal rules */}
      <div className="mt-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">Withdrawal rules</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Collateral ratio enforced</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">After withdrawal, your remaining collateral must still cover your debt at 150%. The protocol calculates your maximum safe withdrawal automatically.</p>
          </div>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">No debt = full withdrawal</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">If you have no outstanding debt, you can withdraw your entire deposited balance in one transaction.</p>
          </div>
        </div>
      </div>

      {/* Formula */}
      <div className="mt-4">
        <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 font-mono text-sm text-[#141414]">
          Max withdrawable = Deposited − (Debt × 150 ÷ 100)
        </div>
      </div>

      <TransactionModal status={txStatus} message={txMessage} onClose={() => setTxStatus('idle')} />
    </div>
  )
}
