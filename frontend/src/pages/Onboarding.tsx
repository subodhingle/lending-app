import { Link } from 'react-router-dom'
import { useWallet } from '../context/wallet-context'
import { CONTRACT_IDS, contractsDeployed } from '../lib/ContractInteraction'

const actions = [
  { title: 'Deposit XLM', detail: 'Lock a small amount of Testnet XLM as collateral.', to: '/app/deposit' },
  { title: 'Borrow dTOKEN', detail: 'Borrow within the displayed limit after depositing.', to: '/app/borrow' },
  { title: 'Repay or withdraw', detail: 'Close the loop by reducing debt or withdrawing safely.', to: '/app/repay' },
]

export function Onboarding() {
  const { address, connected } = useWallet()
  const deployed = contractsDeployed()

  return (
    <div className="py-8 max-w-5xl mx-auto space-y-8">
      <section className="rounded-3xl bg-[#141414] px-6 py-8 md:px-10 md:py-10 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a7d9c3]">Testnet onboarding</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight md:text-5xl">A clear first interaction, from wallet to proof.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#c8c8c3] md:text-base">
          Use Stellar Testnet only. Connect Freighter, fund a public Testnet wallet, complete one useful action, and retain the resulting transaction hash.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="https://friendbot.stellar.org" target="_blank" rel="noopener noreferrer"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#141414] transition-colors hover:bg-[#e8e8e0]">
            Fund Testnet wallet ↗
          </a>
          <Link to={connected ? '/app/deposit' : '/app'} className="rounded-full border border-[#4f4f4d] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2c2c2b]">
            {connected ? 'Make first deposit →' : 'Connect Freighter →'}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['01', 'Use Testnet', 'Switch Freighter to Stellar Testnet. Never use a seed phrase or mainnet funds.'],
          ['02', 'Fund your wallet', 'Request free Testnet XLM from Friendbot, then return here once the balance appears.'],
          ['03', 'Keep proof', 'Save your public wallet address and the confirmed transaction hash after the action.'],
        ].map(([number, title, body]) => (
          <article key={number} className="rounded-2xl border border-[#e2e1d9] bg-white p-5">
            <p className="text-3xl font-black tracking-tight text-[#d0d0c8]">{number}</p>
            <h2 className="mt-5 text-base font-bold text-[#141414]">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6b6b6b]">{body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[#e2e1d9] bg-white p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b]">Your Testnet session</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#141414]">{connected ? 'Wallet connected' : 'Wallet not connected yet'}</h2>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${deployed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {deployed ? 'Contracts ready' : 'Contracts need configuration'}
          </span>
        </div>
        {address ? (
          <div className="mt-4 rounded-xl bg-[#f7f6f2] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6b6b6b]">Public wallet address</p>
            <p className="mt-1 break-all font-mono text-sm text-[#141414]">{address}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-[#6b6b6b]">Connect Freighter from the header to reveal your public Testnet address and continue.</p>
        )}
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6b6b6b]">Choose one meaningful action</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#141414]">Learn the flow by using it.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.title} to={action.to} className="group rounded-2xl border border-[#e2e1d9] bg-white p-5 transition-all hover:border-[#141414] hover:shadow-sm">
              <h3 className="font-bold text-[#141414]">{action.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6b6b6b]">{action.detail}</p>
              <p className="mt-5 text-sm font-semibold text-[#141414]">Open action <span className="transition-transform group-hover:translate-x-0.5 inline-block">→</span></p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#f0e8d0] bg-[#fdf8f0] p-5">
        <p className="text-sm font-bold text-[#141414]">Cohort testing note</p>
        <p className="mt-1 text-sm leading-relaxed text-[#6b6b6b]">
          For the Level 5 cohort, each real participant should make one confirmed Testnet interaction 2–3 minutes apart and share only their public wallet address and transaction hash. Never collect or share secret keys.
        </p>
        {deployed && <p className="mt-3 break-all text-xs text-[#6b6b6b]">Pool contract: {CONTRACT_IDS.lendingPool}</p>}
      </section>
    </div>
  )
}
