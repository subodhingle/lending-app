import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import { borrow, getPositionDetails, formatAmount, parseAmount, COLLATERAL_SYMBOL, DEBT_SYMBOL, type PositionDetails } from '../lib/ContractInteraction'

export function Borrow() {
  const { address, connected } = useWallet()
  const [amount, setAmount] = useState('')
  const [details, setDetails] = useState<PositionDetails | null>(null)
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txMessage, setTxMessage] = useState('')

  useEffect(() => {
    if (!address) return
    getPositionDetails(address).then(setDetails).catch(console.error)
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
      const det = await getPositionDetails(address)
      setDetails(det)
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Transaction failed')
    }
  }

  const currentCollateral = details?.collateral_deposited ?? 0n
  const collateralUsd = details?.collateral_usd ?? 0n
  const currentDebt = details?.debt_borrowed ?? 0n

  const maxBorrowable = (collateralUsd * 100n) / 150n
  const availableToBorrow = maxBorrowable > currentDebt ? maxBorrowable - currentDebt : 0n
  const utilizationPct = maxBorrowable > 0n ? Number((currentDebt * 100n) / maxBorrowable) : 0

  const borrowAmountRaw = parseAmount(amount)
  const newDebt = currentDebt + borrowAmountRaw
  const newUtilizationPct = maxBorrowable > 0n ? Number((newDebt * 100n) / maxBorrowable) : 0

  let currentHealth = details?.health_factor ?? 0
  let newHealthFactor = 0
  if (newDebt > 0n) {
    newHealthFactor = Number((collateralUsd * 100n) / newDebt)
  }

  const currentLiqPrice = currentCollateral > 0n ? (currentDebt * 120n * 100_000n) / currentCollateral : 0n
  const newLiqPrice = currentCollateral > 0n ? (newDebt * 120n * 100_000n) / currentCollateral : 0n

  return (
    <div className="py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Borrow</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Borrow dTOKEN</h1>
        <p className="text-sm text-[#6b6b6b] mt-2">
          Draw liquidity against your XLM. Keep health factor above 120% to avoid liquidation.
        </p>
      </div>
      <NotDeployedBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — form */}
        <div>
          {!connected ? (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-8 text-center">
              <p className="text-[#6b6b6b]">Connect your wallet to borrow</p>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-6 space-y-5">
              <div className="bg-[#f7f6f2] rounded-xl p-4 space-y-3">
                {[
                  { label: 'Collateral Deposited', value: `${formatAmount(currentCollateral)} ${COLLATERAL_SYMBOL}` },
                  { label: 'Max Borrowable (150%)', value: `${formatAmount(maxBorrowable)} ${DEBT_SYMBOL}` },
                  { label: 'Current Debt', value: `${formatAmount(currentDebt)} ${DEBT_SYMBOL}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#6b6b6b]">{label}</span>
                    <span className="font-semibold text-[#141414]">{value}</span>
                  </div>
                ))}
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
                      <div className={`h-full rounded-full transition-all ${utilizationPct >= 90 ? 'bg-red-500' : utilizationPct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(utilizationPct, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
              {currentCollateral === 0n && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm text-amber-700">Deposit {COLLATERAL_SYMBOL} first before borrowing.</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#141414] mb-2">Amount to Borrow</label>
                  <div className="relative">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0000000" min="0" step="0.0000001"
                      className="w-full border border-[#e2e1d9] rounded-xl px-4 py-3 pr-24 text-[#141414] bg-white focus:outline-none focus:border-[#141414] transition-colors"
                      required />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button type="button" onClick={() => setAmount(formatAmount(availableToBorrow))}
                        className="text-xs text-[#6b6b6b] hover:text-[#141414] font-medium">MAX</button>
                      <span className="text-sm font-medium text-[#6b6b6b]">{DEBT_SYMBOL}</span>
                    </div>
                  </div>
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-[#6b6b6b] uppercase tracking-wider">Simulated Position Preview</p>
                    <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                      <div>
                        <span className="text-[#6b6b6b] block text-xs">Total Debt</span>
                        <span className="font-semibold text-red-600">${formatAmount(currentDebt)} → ${formatAmount(newDebt)}</span>
                      </div>
                      <div>
                        <span className="text-[#6b6b6b] block text-xs">Utilization</span>
                        <span className="font-semibold text-[#141414]">{utilizationPct}% → {newUtilizationPct}%</span>
                      </div>
                      <div>
                        <span className="text-[#6b6b6b] block text-xs">Health Factor</span>
                        <span className={`font-bold ${newHealthFactor >= 150 ? 'text-green-700' : newHealthFactor >= 120 ? 'text-amber-600' : 'text-red-600'}`}>
                          {currentHealth === 0 ? 'N/A' : (currentHealth > 999 ? '999%+' : `${currentHealth}%`)} → {newHealthFactor > 999 ? '999%+' : `${newHealthFactor}%`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#6b6b6b] block text-xs">Liquidation Price (XLM)</span>
                        <span className="font-semibold text-[#141414]">
                          {currentLiqPrice === 0n ? 'N/A' : `$${(Number(currentLiqPrice) / 10_000_000).toFixed(4)}`} → ${(Number(newLiqPrice) / 10_000_000).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={!amount || parseFloat(amount) <= 0 || currentCollateral === 0n}
                  className="w-full bg-[#141414] text-white py-3 rounded-xl font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Borrow {DEBT_SYMBOL}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right — explainer */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest">Borrow limit formula</p>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5 space-y-3">
            {[
              'Max borrowable = Collateral × 100 ÷ 150',
              'Example: 300 XLM → max 200 dTOKEN',
              'Health factor = Collateral × 100 ÷ Debt',
            ].map((f) => (
              <div key={f} className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-3 font-mono text-sm text-[#141414]">{f}</div>
            ))}
          </div>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-2">Health factor zones</p>
            <div className="space-y-2">
              {[
                { dot: 'bg-green-500', label: '≥ 150%', desc: 'Safe — well over-collateralised' },
                { dot: 'bg-amber-400', label: '120–149%', desc: 'Warning — consider repaying' },
                { dot: 'bg-red-500', label: '< 120%', desc: 'Danger — liquidation eligible' },
              ].map(({ dot, label, desc }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                  <span className="font-semibold text-[#141414] w-20">{label}</span>
                  <span className="text-[#6b6b6b]">{desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#fdf8f0] border border-[#f0e8d0] rounded-xl p-4 flex gap-3">
            <span className="text-amber-500 shrink-0 mt-0.5">△</span>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">Borrow conservatively. XLM price volatility can erode your health factor quickly. Leave a buffer above 150%.</p>
          </div>
        </div>
      </div>

      <TransactionModal status={txStatus} message={txMessage} onClose={() => setTxStatus('idle')} />
    </div>
  )
}
