import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'
import { PositionCard } from '../components/PositionCard'
import { HealthFactorGauge } from '../components/HealthFactorGauge'
import { ActivityLog } from '../components/ActivityLog'
import {
  getPosition,
  getHealthFactor,
  getLendingConfig,
  getPositionDetails,
  getTokenBalance,
  formatAmount,
  contractsDeployed,
  CONTRACT_IDS,
  COLLATERAL_SYMBOL,
  DEBT_SYMBOL,
  type Position,
  type LendingConfig,
  type PositionDetails,
} from '../lib/ContractInteraction'

export function Dashboard() {
  const { address, connected } = useWallet()
  const [position, setPosition] = useState<Position>({ collateral_deposited: 0n, debt_borrowed: 0n })
  const [healthFactor, setHealthFactor] = useState(0)
  const [config, setConfig] = useState<LendingConfig | null>(null)
  const [details, setDetails] = useState<PositionDetails | null>(null)
  const [cBalance, setCBalance] = useState(0n)
  const [dBalance, setDBalance] = useState(0n)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!connected || !address) return
    setLoading(true)
    Promise.all([
      getPosition(address),
      getHealthFactor(address),
      getLendingConfig(),
      getPositionDetails(address),
      getTokenBalance(CONTRACT_IDS.collateralToken, address),
      getTokenBalance(CONTRACT_IDS.debtToken, address),
    ])
      .then(([pos, hf, cfg, det, cb, db]) => {
        setPosition(pos)
        setHealthFactor(hf)
        setConfig(cfg)
        setDetails(det)
        setCBalance(cb)
        setDBalance(db)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [address, connected])

  const quickActions = [
    { to: '/app/deposit', label: 'Deposit', icon: '↓', desc: `Add ${COLLATERAL_SYMBOL} collateral` },
    { to: '/app/borrow', label: 'Borrow', icon: '↗', desc: `Borrow ${DEBT_SYMBOL}` },
    { to: '/app/repay', label: 'Repay', icon: '↩', desc: 'Repay your debt' },
    { to: '/app/withdraw', label: 'Withdraw', icon: '↑', desc: 'Withdraw collateral' },
  ]

  return (
    <div className="py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-2">Overview</p>
        <h1 className="text-3xl font-black tracking-tight text-[#141414]">Dashboard</h1>
        <p className="text-sm text-[#6b6b6b] mt-1">
          Deposit XLM · Borrow dTOKEN · Stellar Testnet
        </p>
      </div>

      {!contractsDeployed() && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <span className="text-amber-500 text-lg shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">Contracts not deployed</p>
            <p className="text-amber-700 text-xs mt-0.5">
              Run <code className="bg-amber-100 px-1 rounded font-mono">scripts/deploy.sh</code> then
              update <code className="bg-amber-100 px-1 rounded font-mono">frontend/.env</code>.
            </p>
          </div>
        </div>
      )}

      {!connected ? (
        <div className="bg-white border border-[#e0e0d8] rounded-2xl p-8 text-center">
          <div className="w-14 h-14 bg-[#f5f5f0] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔗</span>
          </div>
          <h2 className="font-semibold text-[#1a1a1a] mb-2">Connect Your Wallet</h2>
          <p className="text-sm text-[#6b6b6b] mb-4 max-w-xs mx-auto">
            Connect Freighter to deposit XLM and borrow dTOKEN.
          </p>
          <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#6b6b6b] underline">
            Don't have Freighter? Get it here →
          </a>
        </div>
      ) : (
        <>
          {/* Position + Gauge */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <PositionCard position={position} healthFactor={healthFactor} loading={loading} />
            </div>
            <div className="bg-white border border-[#e0e0d8] rounded-2xl p-5 flex flex-col items-center justify-center">
              <HealthFactorGauge healthFactor={healthFactor} size={130} />
            </div>
          </div>

          {/* Wallet balances */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-[#e0e0d8] rounded-2xl p-4">
              <p className="text-xs text-[#6b6b6b] mb-1">Wallet {COLLATERAL_SYMBOL}</p>
              <p className="text-lg font-bold text-[#1a1a1a]">{formatAmount(cBalance)}</p>
              <p className="text-xs text-[#6b6b6b]">Native XLM (testnet)</p>
            </div>
            <div className="bg-white border border-[#e0e0d8] rounded-2xl p-4">
              <p className="text-xs text-[#6b6b6b] mb-1">Wallet {DEBT_SYMBOL}</p>
              <p className="text-lg font-bold text-[#1a1a1a]">{formatAmount(dBalance)}</p>
              <p className="text-xs text-[#6b6b6b]">Debt Token</p>
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map((action) => (
                <Link key={action.to} to={action.to}
                  className="bg-white border border-[#e0e0d8] rounded-2xl p-4 hover:border-[#1a1a1a] hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 bg-[#f5f5f0] rounded-xl flex items-center justify-center mb-3 group-hover:bg-[#1a1a1a] transition-colors">
                    <span className="text-sm group-hover:text-white transition-colors">{action.icon}</span>
                  </div>
                  <p className="font-semibold text-sm text-[#1a1a1a]">{action.label}</p>
                  <p className="text-xs text-[#6b6b6b] mt-0.5">{action.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Protocol config */}
          {config && (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">
                Protocol Parameters
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-[#6b6b6b]">Collateral Ratio</p>
                  <p className="font-bold text-[#141414]">{config.collateral_ratio}%</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">Liq. Threshold</p>
                  <p className="font-bold text-[#141414]">{config.liquidation_threshold}%</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">Liq. Bonus</p>
                  <p className="font-bold text-[#141414]">{config.liquidation_bonus}%</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">Interest Rate (APR)</p>
                  <p className="font-bold text-[#141414]">{(config.interest_rate_bps / 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">XLM Price (Oracle)</p>
                  <p className="font-bold text-[#141414]">${(Number(config.xlm_price_usd) / 10_000_000).toFixed(4)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Position USD details */}
          {details && details.debt_borrowed > 0n && (
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
              <h2 className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">
                Position in USD
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[#6b6b6b]">Collateral Value</p>
                  <p className="font-bold text-[#141414]">${formatAmount(details.collateral_usd)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">Total Debt</p>
                  <p className="font-bold text-red-600">${formatAmount(details.debt_borrowed)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">Accrued Interest</p>
                  <p className="font-bold text-amber-600">${formatAmount(details.accrued_interest)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">Health Factor</p>
                  <p className={`font-bold ${details.health_factor >= 150 ? 'text-green-700' : details.health_factor >= 120 ? 'text-amber-600' : 'text-red-600'}`}>
                    {details.health_factor > 999 ? '999%+' : `${details.health_factor}%`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* How the protocol works */}
          <div className="mt-8">
            <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">How the protocol works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
                <p className="font-bold text-[#141414] text-sm mb-1">150% Collateral Ratio</p>
                <p className="text-sm text-[#6b6b6b] leading-relaxed">For every 100 dTOKEN you borrow, you must hold at least 150 XLM as collateral. This over-collateralisation protects the protocol from insolvency.</p>
              </div>
              <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
                <p className="font-bold text-[#141414] text-sm mb-1">120% Liquidation Threshold</p>
                <p className="text-sm text-[#6b6b6b] leading-relaxed">If your health factor drops below 120%, your position becomes eligible for liquidation. Keep your ratio healthy by repaying debt or adding collateral.</p>
              </div>
              <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
                <p className="font-bold text-[#141414] text-sm mb-1">5% Liquidation Bonus</p>
                <p className="text-sm text-[#6b6b6b] leading-relaxed">Liquidators receive a 5% bonus on the collateral they seize. This incentivises the community to keep the protocol solvent.</p>
              </div>
            </div>
          </div>

          {/* Your position at a glance */}
          <div className="mt-8">
            <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">Your position at a glance</p>
            <div className="bg-white border border-[#e2e1d9] rounded-2xl p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 w-3 h-3 rounded-full bg-green-500 inline-block" />
                  <p className="text-sm text-[#6b6b6b] leading-relaxed"><span className="font-semibold text-[#141414]">≥ 150% — Safe.</span> Your position is well-collateralised.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                  <p className="text-sm text-[#6b6b6b] leading-relaxed"><span className="font-semibold text-[#141414]">120–149% — Warning.</span> Consider repaying debt or adding collateral.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 w-3 h-3 rounded-full bg-red-500 inline-block" />
                  <p className="text-sm text-[#6b6b6b] leading-relaxed"><span className="font-semibold text-[#141414]">&lt; 120% — Danger.</span> Your position is at risk of liquidation.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="mt-8">
            <ActivityLog />
          </div>
        </>
      )}
    </div>
  )
}
