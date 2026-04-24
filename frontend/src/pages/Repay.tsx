import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import {
  repay,
  getPosition,
  getTokenBalance,
  formatAmount,
  parseAmount,
  CONTRACT_IDS,
  DEBT_SYMBOL,
  type Position,
} from '../lib/ContractInteraction'

export function Repay() {
  const { address, connected } = useWallet()
  const [amount, setAmount] = useState('')
  const [position, setPosition] = useState<Position>({ collateral_deposited: 0n, debt_borrowed: 0n })
  const [dBalance, setDBalance] = useState(0n)
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txMessage, setTxMessage] = useState('')

  useEffect(() => {
    if (!address) return
    Promise.all([getPosition(address), getTokenBalance(CONTRACT_IDS.debtToken, address)])
      .then(([pos, bal]) => { setPosition(pos); setDBalance(bal) })
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
      const [pos, bal] = await Promise.all([getPosition(address), getTokenBalance(CONTRACT_IDS.debtToken, address)])
      setPosition(pos); setDBalance(bal)
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Transaction failed')
    }
  }

  const maxRepay = position.debt_borrowed < dBalance ? position.debt_borrowed : dBalance

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Repay</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Repay Debt</h1>
        <p className="text-sm text-[#6b6b6b] mt-2 max-w-sm">
          Return dTOKEN to reduce your outstanding debt and improve your health factor.
          Partial repayments are supported — repay as much or as little as you want.
        </p>
      </div>
      <NotDeployedBanner />

      {!connected ? (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 text-center">
          <p className="text-[#6b6b6b]">Connect your wallet to repay</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-6 space-y-5">
          <div className="bg-[#f5f5f0] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Outstanding Debt</span>
              <span className="font-semibold text-red-600">{formatAmount(position.debt_borrowed)} {DEBT_SYMBOL}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6b6b6b]">Wallet {DEBT_SYMBOL}</span>
              <span className="font-semibold text-[#1a1a1a]">{formatAmount(dBalance)} {DEBT_SYMBOL}</span>
            </div>
          </div>

          {position.debt_borrowed === 0n && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-sm text-green-700">✓ No outstanding debt.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Amount to Repay</label>
              <div className="relative">
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0000000" min="0" step="0.0000001"
                  className="w-full border border-[#e0e0d8] rounded-xl px-4 py-3 pr-24 text-[#1a1a1a] bg-white focus:outline-none focus:border-[#1a1a1a] transition-colors"
                  required />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button type="button" onClick={() => setAmount(formatAmount(maxRepay))}
                    className="text-xs text-[#6b6b6b] hover:text-[#1a1a1a] font-medium">MAX</button>
                  <span className="text-sm font-medium text-[#6b6b6b]">{DEBT_SYMBOL}</span>
                </div>
              </div>
            </div>
            <button type="submit"
              disabled={!amount || parseFloat(amount) <= 0 || position.debt_borrowed === 0n}
              className="w-full bg-[#1a1a1a] text-white py-3 rounded-xl font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Repay {DEBT_SYMBOL}
            </button>
          </form>
        </div>
      )}
      {/* Why repay? */}
      <div className="mt-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">Why repay?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Improve health factor</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">Every dTOKEN you repay increases your health factor, moving you further from the liquidation threshold.</p>
          </div>
          <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
            <p className="font-bold text-[#141414] text-sm mb-1">Unlock collateral</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">Once your debt is fully repaid, you can withdraw your entire XLM collateral with no restrictions.</p>
          </div>
        </div>
      </div>

      {/* dTOKEN info */}
      <div className="mt-4">
        <div className="bg-[#fdf8f0] border border-[#f0e8d0] rounded-xl p-4 flex gap-3">
          <span className="text-amber-500 shrink-0 mt-0.5">△</span>
          <p className="text-sm text-[#6b6b6b] leading-relaxed">dTOKEN is minted by the protocol when you borrow and burned when you repay. There is no secondary market — dTOKEN only exists as a debt instrument within this protocol.</p>
        </div>
      </div>

      <TransactionModal status={txStatus} message={txMessage} onClose={() => setTxStatus('idle')} />
    </div>
  )
}
