import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import { repay, getPositionDetails, getTokenBalance, formatAmount, parseAmount, CONTRACT_IDS, DEBT_SYMBOL, type PositionDetails } from '../lib/ContractInteraction'

export function Repay() {
  const { address, connected } = useWallet()
  const [amount, setAmount] = useState('')
  const [details, setDetails] = useState<PositionDetails | null>(null)
  const [dBalance, setDBalance] = useState(0n)
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txMessage, setTxMessage] = useState('')

  useEffect(() => {
    if (!address) return
    Promise.all([getPositionDetails(address), getTokenBalance(CONTRACT_IDS.debtToken, address)])
      .then(([det, bal]) => { setDetails(det); setDBalance(bal) })
      .catch(console.error)
  }, [address])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address || !amount) return
    const parsed = parseAmount(amount)
    if (parsed <= 0n) return
    setTxStatus('loading')
    setTxMessage('Repaying debt...')
    try {
      await repay(address, parsed)
      setTxStatus('success')
      setTxMessage(`Successfully repaid ${amount} ${DEBT_SYMBOL}.`)
      setAmount('')
      const [det, bal] = await Promise.all([getPositionDetails(address), getTokenBalance(CONTRACT_IDS.debtToken, address)])
      setDetails(det); setDBalance(bal)
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Transaction failed')
    }
  }

  const currentDebt = details?.debt_borrowed ?? 0n
  const currentCollateral = details?.collateral_deposited ?? 0n
  const maxRepay = currentDebt < dBalance ? currentDebt : dBalance

  const repayAmountRaw = parseAmount(amount)
  const newDebt = currentDebt > repayAmountRaw ? currentDebt - repayAmountRaw : 0n

  let currentHealth = details?.health_factor ?? 0
  let newHealthFactor = 0
  if (newDebt > 0n) {
    const collateralUsd = details?.collateral_usd ?? 0n
    newHealthFactor = Number((collateralUsd * 100n) / newDebt)
  }

  const currentLiqPrice = currentCollateral > 0n ? (currentDebt * 120n * 100_000n) / currentCollateral : 0n
  const newLiqPrice = currentCollateral > 0n ? (newDebt * 120n * 100_000n) / currentCollateral : 0n

  return (
    <div className="py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Repay</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Repay Debt</h1>
        <p className="text-sm text-[#6b6b6b] mt-2">
          Return dTOKEN to reduce your debt and improve your health factor. Partial repayments supported.
        </p>
      </div>
      <NotDeployedBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — form */}
        <div>
          {!connected ? (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-8 text-center">
              <p className="text-[#6b6b6b]">Connect your wallet to repay</p>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-6 space-y-5">
              <div className="bg-[#f7f6f2] rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b6b6b]">Outstanding Debt</span>
                  <span className="font-semibold text-red-600">{formatAmount(currentDebt)} {DEBT_SYMBOL}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6b6b6b]">Wallet {DEBT_SYMBOL}</span>
                  <span className="font-semibold text-[#141414]">{formatAmount(dBalance)} {DEBT_SYMBOL}</span>
                </div>
              </div>
              {currentDebt === 0n && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm text-green-700">✓ No outstanding debt.</p>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#141414] mb-2">Amount to Repay</label>
                  <div className="relative">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0000000" min="0" step="0.0000001"
                      className="w-full border border-[#e2e1d9] rounded-xl px-4 py-3 pr-24 text-[#141414] bg-white focus:outline-none focus:border-[#141414] transition-colors"
                      required />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button type="button" onClick={() => setAmount(formatAmount(maxRepay))}
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
                        <span className="text-[#6b6b6b] block text-xs">Health Factor</span>
                        <span className={`font-bold ${newHealthFactor >= 150 ? 'text-green-700' : newHealthFactor >= 120 ? 'text-amber-600' : 'text-red-600'}`}>
                          {currentHealth === 0 ? 'N/A' : (currentHealth > 999 ? '999%+' : `${currentHealth}%`)} → {newDebt === 0n ? 'No Debt' : `${newHealthFactor}%`}
                        </span>
                      </div>
                      {newDebt > 0n && (
                        <div className="col-span-2 border-t border-[#e2e1d9] pt-2">
                          <span className="text-[#6b6b6b] block text-xs">Liquidation Price (XLM)</span>
                          <span className="font-semibold text-[#141414]">
                            {currentLiqPrice === 0n ? 'N/A' : `$${(Number(currentLiqPrice) / 10_000_000).toFixed(4)}`} → ${(Number(newLiqPrice) / 10_000_000).toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <button type="submit" disabled={!amount || parseFloat(amount) <= 0 || currentDebt === 0n || txStatus === 'loading'}
                  className="w-full bg-[#141414] text-white py-3 rounded-xl font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {txStatus === 'loading' ? 'Processing...' : `Repay ${DEBT_SYMBOL}`}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right — explainer */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest">Why repay?</p>
          <div className="space-y-3">
            {[
              { title: 'Improve health factor', body: 'Every dTOKEN you repay increases your health factor, moving you further from the liquidation threshold.' },
              { title: 'Unlock collateral', body: 'Once your debt is fully repaid, you can withdraw your entire XLM collateral with no restrictions.' },
            ].map((item) => (
              <div key={item.title} className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
                <p className="font-bold text-[#141414] text-sm mb-1">{item.title}</p>
                <p className="text-sm text-[#6b6b6b] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="bg-[#fdf8f0] border border-[#f0e8d0] rounded-xl p-4 flex gap-3">
            <span className="text-amber-500 shrink-0 mt-0.5">△</span>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">
              dTOKEN is minted when you borrow and burned when you repay. There is no secondary market — it only exists as a debt instrument within this protocol.
            </p>
          </div>
        </div>
      </div>

      <TransactionModal status={txStatus} message={txMessage} onClose={() => setTxStatus('idle')} />
    </div>
  )
}
