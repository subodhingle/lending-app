import { Link } from 'react-router-dom'

const stats = [
  { label: 'Collateral Ratio', value: '150%' },
  { label: 'Liquidation Threshold', value: '120%' },
  { label: 'Liquidation Bonus', value: '5%' },
  { label: 'Network', value: 'Stellar Testnet' },
  { label: 'Settlement', value: '< 5 sec' },
  { label: 'Collateral Asset', value: 'Native XLM' },
]

const steps = [
  {
    n: '01',
    title: 'Connect your wallet',
    body: 'Link your Freighter wallet. No sign-up, no KYC — just your keys.',
  },
  {
    n: '02',
    title: 'Deposit XLM as collateral',
    body: 'Lock native XLM into the lending pool. Your position is tracked on-chain in real time.',
  },
  {
    n: '03',
    title: 'Borrow dTOKEN',
    body: 'Draw up to 66% of your collateral value as dTOKEN. Repay any time, no fixed schedule.',
  },
  {
    n: '04',
    title: 'Manage your position',
    body: 'Monitor your health factor. Repay debt, withdraw collateral, or top up at any point.',
  },
]

const features = [
  {
    icon: '⬡',
    title: 'Non-custodial',
    body: 'Your assets never leave your control. The protocol holds collateral in a transparent on-chain contract — no intermediaries.',
  },
  {
    icon: '◈',
    title: 'Soroban smart contracts',
    body: 'Built on Stellar\'s native smart contract platform. Deterministic execution, low fees, and sub-5-second finality.',
  },
  {
    icon: '◎',
    title: 'Over-collateralised lending',
    body: 'A 150% collateral ratio keeps the protocol solvent. Positions below 120% become eligible for liquidation with a 5% bonus for liquidators.',
  },
  {
    icon: '⬕',
    title: 'Transparent liquidations',
    body: 'Any wallet can liquidate an unhealthy position. The incentive structure keeps the protocol healthy without a centralised backstop.',
  },
  {
    icon: '◇',
    title: 'Real-time health factor',
    body: 'A live gauge shows your collateral-to-debt ratio. Green means safe. Yellow means watch it. Red means act now.',
  },
  {
    icon: '⬡',
    title: 'Open source',
    body: 'Every line of contract code is public. Audit it, fork it, build on it. No black boxes.',
  },
]

const tickerItems = [
  'Non-custodial', 'XLM Collateral', 'Soroban Contracts',
  'Sub-5s Finality', 'Open Source', '150% Collateral Ratio',
  'Transparent Liquidations', 'Stellar Testnet', 'dTOKEN Debt',
]

export function Landing() {
  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#141414]">

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#f7f6f2]/90 backdrop-blur-md border-b border-[#e2e1d9]">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#141414] rounded-lg flex items-center justify-center">
              <span className="text-white text-[10px] font-black tracking-tight">SL</span>
            </div>
            <span className="font-bold text-sm tracking-tight">Stellar Lending</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#6b6b6b]">
            <a href="#how-it-works" className="hover:text-[#141414] transition-colors">How it works</a>
            <a href="#features" className="hover:text-[#141414] transition-colors">Features</a>
            <a href="#protocol" className="hover:text-[#141414] transition-colors">Protocol</a>
          </nav>
          <Link
            to="/app"
            className="bg-[#141414] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#333] transition-colors"
          >
            Launch App →
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-[#e2e1d9] rounded-full px-3 py-1 text-xs text-[#6b6b6b] mb-8 fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
              Live on Stellar Testnet
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-6 fade-up-2">
              Borrow against<br />
              <span className="text-[#6b6b6b]">your XLM.</span>
            </h1>
            <p className="text-lg md:text-xl text-[#6b6b6b] leading-relaxed max-w-xl mb-10 fade-up-3">
              A non-custodial lending protocol on Stellar. Deposit native XLM,
              borrow dTOKEN, manage your position — all on-chain, all transparent.
            </p>
            <div className="flex flex-wrap items-center gap-3 fade-up-3">
              <Link to="/app"
                className="bg-[#141414] text-white font-semibold px-6 py-3 rounded-full hover:bg-[#333] transition-colors text-sm">
                Launch App
              </Link>
              <a href="#how-it-works"
                className="border border-[#e2e1d9] text-[#141414] font-medium px-6 py-3 rounded-full hover:bg-white transition-colors text-sm">
                How it works
              </a>
            </div>
          </div>

          {/* Live position preview card */}
          <div className="fade-up-3 hidden lg:block">
            <div className="bg-white border border-[#e2e1d9] rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest">Sample Position</p>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">Safe</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-[#f7f6f2] rounded-2xl p-4">
                  <p className="text-xs text-[#6b6b6b] mb-1">Collateral</p>
                  <p className="text-2xl font-black text-[#141414]">300</p>
                  <p className="text-xs text-[#6b6b6b]">XLM deposited</p>
                </div>
                <div className="bg-[#f7f6f2] rounded-2xl p-4">
                  <p className="text-xs text-[#6b6b6b] mb-1">Debt</p>
                  <p className="text-2xl font-black text-[#141414]">150</p>
                  <p className="text-xs text-[#6b6b6b]">dTOKEN borrowed</p>
                </div>
              </div>
              {/* Health factor bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[#6b6b6b] mb-2">
                  <span>Health Factor</span>
                  <span className="font-bold text-green-700">200%</span>
                </div>
                <div className="h-2.5 bg-[#f0efe8] rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-green-500 rounded-full" />
                </div>
                <div className="flex justify-between text-[10px] text-[#9b9b9b] mt-1">
                  <span>0%</span>
                  <span className="text-red-400">120% liquidation</span>
                  <span>300%+</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Ratio', value: '150%' },
                  { label: 'Threshold', value: '120%' },
                  { label: 'Bonus', value: '+5%' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#f7f6f2] rounded-xl py-2">
                    <p className="text-sm font-bold text-[#141414]">{value}</p>
                    <p className="text-[10px] text-[#6b6b6b]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ticker ──────────────────────────────────────────────────────── */}
      <div className="border-y border-[#e2e1d9] bg-white overflow-hidden py-3">
        <div className="flex ticker-track whitespace-nowrap">
          {[...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3 px-6 text-sm text-[#6b6b6b] font-medium">
              <span className="w-1 h-1 rounded-full bg-[#c0bfb8] inline-block" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <section id="protocol" className="max-w-6xl mx-auto px-5 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-[#e2e1d9] rounded-2xl overflow-hidden border border-[#e2e1d9]">
          {stats.map((s) => (
            <div key={s.label} className="bg-white px-5 py-6">
              <p className="text-2xl font-black tracking-tight text-[#141414]">{s.value}</p>
              <p className="text-xs text-[#6b6b6b] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-5 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Four steps.<br />Full control.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="bg-white border border-[#e2e1d9] rounded-2xl p-6 hover:shadow-sm transition-shadow">
              <p className="text-4xl font-black text-[#e2e1d9] mb-4 tracking-tighter">{s.n}</p>
              <h3 className="font-bold text-[#141414] mb-2">{s.title}</h3>
              <p className="text-sm text-[#6b6b6b] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-16">
        <div className="mb-12">
          <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Built different.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-white border border-[#e2e1d9] rounded-2xl p-6 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 bg-[#f7f6f2] rounded-xl flex items-center justify-center text-lg mb-4">
                {f.icon}
              </div>
              <h3 className="font-bold text-[#141414] mb-2">{f.title}</h3>
              <p className="text-sm text-[#6b6b6b] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Risk notice ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-8">
        <div className="bg-[#fdf8f0] border border-[#f0e8d0] rounded-2xl p-6 flex gap-4">
          <span className="text-amber-500 text-xl shrink-0 mt-0.5">△</span>
          <div>
            <p className="font-semibold text-[#141414] text-sm mb-1">Risk disclosure</p>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">
              This protocol is deployed on Stellar Testnet for demonstration purposes.
              Smart contracts carry inherent risks including bugs and liquidation risk.
              Never deposit assets you cannot afford to lose. This is not financial advice.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="bg-[#141414] rounded-3xl p-10 md:p-16 text-center">
          <p className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-widest mb-4">Get started</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-4">
            Your XLM.<br />Put to work.
          </h2>
          <p className="text-[#9b9b9b] text-base mb-8 max-w-md mx-auto">
            Connect your Freighter wallet and start borrowing in under a minute.
            No registration. No waiting.
          </p>
          <Link
            to="/app"
            className="inline-block bg-white text-[#141414] font-bold px-8 py-3.5 rounded-full hover:bg-[#f0f0f0] transition-colors text-sm"
          >
            Launch App →
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e2e1d9] max-w-6xl mx-auto px-5 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#141414] rounded-md flex items-center justify-center">
              <span className="text-white text-[9px] font-black">SL</span>
            </div>
            <span className="font-bold text-sm">Stellar Lending</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[#6b6b6b]">
            <span>Stellar Testnet</span>
            <span>Soroban Smart Contracts</span>
            <span>Built on Stellar</span>
          </div>
          <p className="text-xs text-[#9b9b9b]">
            Testnet only. Not for production use.
          </p>
        </div>
      </footer>

    </div>
  )
}
