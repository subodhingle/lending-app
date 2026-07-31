import { useState, useEffect } from 'react'
import { useWallet } from '../context/wallet-context'
import { TransactionModal } from '../components/TransactionModal'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import {
  depositCollateral,
  getTokenBalance,
  getPositionDetails,
  formatAmount,
  parseAmount,
  CONTRACT_IDS,
  COLLATERAL_SYMBOL,
  type PositionDetails,
} from '../lib/ContractInteraction'

export function Deposit() {
  const { address, connected } = useWallet()
  const [amount, setAmount] = useState('')
  const [balance, setBalance] = useState(0n)
  const [details, setDetails] = useState<PositionDetails | null>(null)
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [txMessage, setTxMessage] = useState('')

  useEffect(() => {
    if (!address) return
    Promise.all([
      getTokenBalance(CONTRACT_IDS.collateralToken, address),
      getPositionDetails(address)
    ])
      .then(([bal, det]) => {
        setBalance(bal)
        setDetails(det)
      })
      .catch(console.error)
  }, [address])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!address || !amount) return
    const parsed = parseAmount(amount)
    if (parsed <= 0n) return
    if (parsed > balance) {
      setTxStatus('error')
      setTxMessage(`Insufficient balance. You have ${formatAmount(balance)} ${COLLATERAL_SYMBOL}.`)
      return
    }
    setTxStatus('loading')
    setTxMessage(`Depositing ${COLLATERAL_SYMBOL}...`)
    try {
      await depositCollateral(address, parsed)
      setTxStatus('success')
      setTxMessage(`Successfully deposited ${amount} ${COLLATERAL_SYMBOL} as collateral.`)
      setAmount('')
      const [newBal, newDet] = await Promise.all([
        getTokenBalance(CONTRACT_IDS.collateralToken, address),
        getPositionDetails(address)
      ])
      setBalance(newBal)
      setDetails(newDet)
    } catch (e) {
      setTxStatus('error')
      setTxMessage(e instanceof Error ? e.message : 'Transaction failed')
    }
  }

  const price = details?.xlm_price_usd ?? 0n
  const depositAmountRaw = parseAmount(amount)
  const depositUsd = (depositAmountRaw * price) / 10_000_000n
  const depositMaxBorrowable = (depositUsd * 100n) / 150n

  const currentCollateral = details?.collateral_deposited ?? 0n
  const newCollateral = currentCollateral + depositAmountRaw
  const newCollateralUsd = (newCollateral * price) / 10_000_000n
  const currentDebt = details?.debt_borrowed ?? 0n
  const newMaxBorrowable = (newCollateralUsd * 100n) / 150n

  const currentHealth = details?.health_factor ?? 0
  let newHealthFactor = 0
  if (currentDebt > 0n) {
    newHealthFactor = Number((newCollateralUsd * 100n) / currentDebt)
  }

  return (
    <div className="py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Collateral</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Deposit XLM</h1>
        <p className="text-sm text-[#6b6b6b] mt-2">
          Lock native XLM into the lending pool. Enforces 150% collateral ratio in USD terms.
        </p>
      </div>
      <NotDeployedBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — form */}
        <div>
          {!connected ? (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-8 text-center">
              <p className="text-[#6b6b6b]">Connect your wallet to deposit</p>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-6 space-y-5">
              <div className="bg-[#f7f6f2] rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#6b6b6b]">Wallet Balance</span>
                  <span className="font-semibold text-[#141414]">{formatAmount(balance)} {COLLATERAL_SYMBOL}</span>
                </div>
                <p className="text-xs text-[#6b6b6b] mt-1">
                  Get testnet XLM free from{' '}
                  <a href="https://friendbot.stellar.org" target="_blank" rel="noopener noreferrer" className="underline">friendbot.stellar.org</a>
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#141414] mb-2">Amount to Deposit</label>
                  <div className="relative">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0000000" min="0" step="0.0000001"
                      className="w-full border border-[#e2e1d9] rounded-xl px-4 py-3 pr-20 text-[#141414] bg-white focus:outline-none focus:border-[#141414] transition-colors"
                      required />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button type="button" onClick={() => setAmount(formatAmount(balance))}
                        className="text-xs text-[#6b6b6b] hover:text-[#141414] font-medium">MAX</button>
                      <span className="text-sm font-medium text-[#6b6b6b]">{COLLATERAL_SYMBOL}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-[#f7f6f2] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b6b6b]">You deposit</span>
                    <span className="font-medium text-[#141414]">{amount || '0'} {COLLATERAL_SYMBOL}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6b6b6b]">Max borrowable (150%)</span>
                    <span className="font-medium text-[#141414]">
                      {amount ? formatAmount(depositMaxBorrowable) : '0'} dTOKEN
                    </span>
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
                        <span className="text-[#6b6b6b] block text-xs">Max Borrow Limit</span>
                        <span className="font-semibold text-[#141414]">${formatAmount((currentCollateral * price / 10_000_000n) * 100n / 150n)} → ${formatAmount(newMaxBorrowable)}</span>
                      </div>
                      {currentDebt > 0n && (
                        <div className="col-span-2 border-t border-[#e2e1d9] pt-2">
                          <span className="text-[#6b6b6b] block text-xs">Health Factor</span>
                          <span className="font-bold text-[#141414]">
                            {currentHealth > 999 ? '999%+' : `${currentHealth}%`} → {newHealthFactor > 999 ? '999%+' : `${newHealthFactor}%`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <button type="submit" disabled={!amount || parseFloat(amount) <= 0 || txStatus === 'loading'}
                  className="w-full bg-[#141414] text-white py-3 rounded-xl font-medium hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {txStatus === 'loading' ? 'Processing...' : `Deposit ${COLLATERAL_SYMBOL}`}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right — explainer */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest">What happens when you deposit?</p>
          <div className="space-y-3">
            {[
              { title: 'XLM leaves your wallet', body: 'Your XLM is transferred to the lending pool contract. It remains locked until you withdraw.' },
              { title: 'Collateral is recorded on-chain', body: 'Your deposited balance is stored in the contract. No intermediary holds your funds.' },
              { title: 'Borrowing capacity unlocked', body: 'You can now borrow up to 66.6% of your deposited XLM value as dTOKEN.' },
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
              <span className="font-semibold text-[#141414]">Why XLM?</span> Native XLM is the most liquid asset on Stellar. Every testnet wallet receives XLM from Friendbot — no faucet or token swap required.
            </p>
          </div>
        </div>
      </div>

      <TransactionModal status={txStatus} message={txMessage} onClose={() => setTxStatus('idle')} />
    </div>
  )
}
