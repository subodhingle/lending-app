import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import { withdrawCollateral, getPositionDetails, formatAmount, parseAmount, COLLATERAL_SYMBOL, DEBT_SYMBOL, type PositionDetails } from '../lib/ContractInteraction'

export function Withdraw() {
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
    setTxMessage(`Withdrawing ${COLLATERAL_SYMBOL}...`)
    try {
      await withdrawCollateral(address, parsed)
      setTxStatus('success')
      setTxMessage(`Successfully withdrew ${amount} ${COLLATERAL_SYMBOL}.`)
      setAmount('')
      const det = await getPositionDetails(address)
      setDetails(det)
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Transaction failed')
    }
  }

  const price = details?.xlm_price_usd ?? 0n
  const currentCollateral = details?.collateral_deposited ?? 0n
  const currentDebt = details?.debt_borrowed ?? 0n

  const minCollateralRequired = currentDebt > 0n && price > 0n
    ? (currentDebt * 150n * 10_000_000n) / (100n * price)
    : 0n

  const maxWithdrawable = currentCollateral > minCollateralRequired
    ? currentCollateral - minCollateralRequired
    : 0n

  const withdrawAmountRaw = parseAmount(amount)
  const newCollateral = currentCollateral > withdrawAmountRaw ? currentCollateral - withdrawAmountRaw : 0n
  const newCollateralUsd = (newCollateral * price) / 10_000_000n

  let currentHealth = details?.health_factor ?? 0
  let newHealthFactor = 0
  if (currentDebt > 0n) {
    newHealthFactor = Number((newCollateralUsd * 100n) / currentDebt)
  }

  const currentLiqPrice = currentCollateral > 0n ? (currentDebt * 120n * 100_000n) / currentCollateral : 0n
  const newLiqPrice = newCollateral > 0n ? (currentDebt * 120n * 100_000n) / newCollateral : 0n

  return (
    <div className="py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Collateral</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Withdraw XLM</h1>
        <p className="text-sm text-[#6b6b6b] mt-2">
          Reclaim your XLM. The protocol enforces 150% collateral ratio — you can only withdraw what keeps your position healthy.
        </p>
      </div>
      <NotDeployedBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — form */}
        <div>
          {!connected ? (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-8 text-center">
              <p className="text-[#6b6b6b]">Connect your wallet to withdraw</p>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-6 space-y-5">
              <div className="bg-[#f7f6f2] rounded-xl p-4 space-y-2">
                {[
                  { label: 'Deposited', value: `${formatAmount(currentCollateral)} ${COLLATERAL_SYMBOL}` },
                  { label: 'Outstanding Debt', value: `${formatAmount(currentDebt)} ${DEBT_SYMBOL}` },
                  { label: 'Min Collateral Required', value: `${formatAmount(minCollateralRequired)} ${COLLATERAL_SYMBOL}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#6b6b6b]">{label}</span>
                    <span className="font-semibold text-[#141414]">{value}</span>
                  </div>
                ))}
                <div className="border-t border-[#e2e1d9] pt-2 flex justify-between text-sm">
                  <span className="text-[#6b6b6b]">Max Withdrawable</span>
                  <span className="font-bold text-green-700">{formatAmount(maxWithdrawable)} {COLLATERAL_SYMBOL}</span>
                </div>
              </div>
              {currentCollateral === 0n && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm text-amber-700">No collateral deposited.</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#141414] mb-2">Amount to Withdraw</label>
                  <div className="relative">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0000000" min="0" step="0.0000001"
                      className="w-full border border-[#e2e1d9] rounded-xl px-4 py-3 pr-20 text-[#141414] bg-white focus:outline-none focus:border-[#141414] transition-colors"
                      required />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button type="button" onClick={() => setAmount(formatAmount(maxWithdrawable))}
                        className="text-xs text-[#6b6b6b] hover:text-[#141414] font-medium">MAX</button>
                      <span className="text-sm font-medium text-[#6b6b6b]">{COLLATERAL_SYMBOL}</span>
                    </div>
                  </div>
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-[#6b6b6b] uppercase tracking-wider">Simulated Position Preview</p>
                    <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                      <div>
                        <span className="text-[#6b6b6b] block text-xs">Collateral Deposited</span>
                        <span className="font-semibold text-[#141414]">{formatAmount(currentCollateral)} → {formatAmount(newCollateral)} {COLLATERAL_SYMBOL}</span>
                      </div>
                      <div>
                        <span className="text-[#6b6b6b] block text-xs font-semibold">Min Collateral Required</span>
                        <span className="font-semibold text-[#141414]">{formatAmount(minCollateralRequired)} {COLLATERAL_SYMBOL}</span>
                      </div>
                      <div>
                        <span className="text-[#6b6b6b] block text-xs">Health Factor</span>
                        <span className={`font-bold ${newHealthFactor >= 150 ? 'text-green-700' : newHealthFactor >= 120 ? 'text-amber-600' : 'text-red-600'}`}>
                          {currentHealth === 0 ? 'N/A' : (currentHealth > 999 ? '999%+' : `${currentHealth}%`)} → {currentDebt === 0n ? 'No Debt' : `${newHealthFactor}%`}
                        </span>
                      </div>
                      {currentDebt > 0n && (
                        <div>
                          <span className="text-[#6b6b6b] block text-xs">Liquidation Price (XLM)</span>
                          <span className="font-semibold text-[#141414]">
                            {currentLiqPrice === 0n ? 'N/A' : `$${(Number(currentLiqPrice) / 10_000_000).toFixed(4)}`} → ${(Number(newLiqPrice) / 10_000_000).toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <button type="submit" disabled={!amount || parseFloat(amount) <= 0 || currentCollateral === 0n}
                  className="w-full bg-[#141414] text-white py-3 rounded-xl font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Withdraw {COLLATERAL_SYMBOL}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right — explainer */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest">Withdrawal rules</p>
          <div className="space-y-3">
            {[
              { title: 'Collateral ratio enforced', body: 'After withdrawal, your remaining collateral must still cover your debt at 150%. The protocol calculates your maximum safe withdrawal automatically.' },
              { title: 'No debt = full withdrawal', body: 'If you have no outstanding debt, you can withdraw your entire deposited balance in one transaction.' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
                <p className="font-bold text-[#141414] text-sm mb-1">{item.title}</p>
                <p className="text-sm text-[#6b6b6b] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#f7f6f2] border border-[#e2e1d9] rounded-xl p-4 font-mono text-sm text-[#141414]">
            Max withdrawable = Deposited − (Debt × 150 ÷ 100)
          </div>
        </div>
      </div>

      <TransactionModal status={txStatus} message={txMessage} onClose={() => setTxStatus('idle')} />
    </div>
  )
}
