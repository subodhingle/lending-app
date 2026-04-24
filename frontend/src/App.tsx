import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext'
import { AppShell } from './components/AppShell'
import { Landing } from './pages/Landing'
import { Dashboard } from './pages/Dashboard'
import { Deposit } from './pages/Deposit'
import { Borrow } from './pages/Borrow'
import { Repay } from './pages/Repay'
import { Withdraw } from './pages/Withdraw'
import { Liquidate } from './pages/Liquidate'

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing page — no app shell */}
          <Route path="/" element={<Landing />} />

          {/* App routes — wrapped in AppShell with navbar */}
          <Route
            path="/app"
            element={
              <AppShell>
                <Dashboard />
              </AppShell>
            }
          />
          <Route
            path="/app/deposit"
            element={
              <AppShell>
                <Deposit />
              </AppShell>
            }
          />
          <Route
            path="/app/borrow"
            element={
              <AppShell>
                <Borrow />
              </AppShell>
            }
          />
          <Route
            path="/app/repay"
            element={
              <AppShell>
                <Repay />
              </AppShell>
            }
          />
          <Route
            path="/app/withdraw"
            element={
              <AppShell>
                <Withdraw />
              </AppShell>
            }
          />
          <Route
            path="/app/liquidate"
            element={
              <AppShell>
                <Liquidate />
              </AppShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  )
}

export default App
