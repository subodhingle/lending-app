import { Link, useLocation } from 'react-router-dom'
import { WalletConnect } from './WalletConnect'

const navLinks = [
  { to: '/app', label: 'Dashboard' },
  { to: '/app/deposit', label: 'Deposit' },
  { to: '/app/borrow', label: 'Borrow' },
  { to: '/app/repay', label: 'Repay' },
  { to: '/app/withdraw', label: 'Withdraw' },
  { to: '/app/liquidate', label: 'Liquidate' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      <header className="sticky top-0 z-40 bg-[#f7f6f2]/90 backdrop-blur-md border-b border-[#e2e1d9]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-[#141414] rounded-lg flex items-center justify-center">
              <span className="text-white text-[10px] font-black">SL</span>
            </div>
            <span className="font-bold text-[#141414] text-sm hidden sm:block tracking-tight">
              Stellar Lending
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 overflow-x-auto flex-1 justify-center">
            {navLinks.map((link) => {
              const active = location.pathname === link.to
              return (
                <Link key={link.to} to={link.to}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[#141414] text-white'
                      : 'text-[#6b6b6b] hover:text-[#141414] hover:bg-[#e8e8e0]'
                  }`}>
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="shrink-0"><WalletConnect /></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-16">
        {children}
      </main>
    </div>
  )
}
