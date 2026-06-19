import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotDeployedBanner } from '../components/NotDeployedBanner'
import { HealthFactorGauge } from '../components/HealthFactorGauge'
import { PositionCard } from '../components/PositionCard'
import { contractsDeployed } from '../lib/ContractInteraction'

vi.mock('../lib/ContractInteraction', () => ({
  contractsDeployed: vi.fn(() => true),
  formatAmount: (amount: bigint) => {
    return (Number(amount) / 10_000_000).toString()
  },
  getHealthColor: vi.fn(() => 'text-green-700'),
  getHealthBg: vi.fn(() => 'bg-green-50'),
  getHealthLabel: vi.fn(() => 'Safe'),
  COLLATERAL_SYMBOL: 'XLM',
  DEBT_SYMBOL: 'dTOKEN',
}))

describe('NotDeployedBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when contracts are deployed', () => {
    vi.mocked(contractsDeployed).mockReturnValue(true)
    const { container } = render(<NotDeployedBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('renders warning when contracts are not deployed', () => {
    vi.mocked(contractsDeployed).mockReturnValue(false)
    render(<NotDeployedBanner />)
    expect(screen.getByText('Contracts not deployed')).toBeInTheDocument()
    expect(screen.getByText(/scripts\/deploy.sh/)).toBeInTheDocument()
  })
})

describe('HealthFactorGauge', () => {
  it('renders correct display label for no debt (hf = 0)', () => {
    render(<HealthFactorGauge healthFactor={0} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders capped display label for high health factor', () => {
    render(<HealthFactorGauge healthFactor={1500} />)
    expect(screen.getByText('999%+')).toBeInTheDocument()
  })

  it('renders exact percentage for moderate health factor', () => {
    render(<HealthFactorGauge healthFactor={145} />)
    expect(screen.getByText('145%')).toBeInTheDocument()
  })
})

describe('PositionCard', () => {
  it('renders collateral and debt details correctly', () => {
    const position = {
      collateral_deposited: 1500_0000000n,
      debt_borrowed: 50_0000000n,
    }
    render(<PositionCard position={position} healthFactor={300} loading={false} />)
    expect(screen.getByText('1500')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('renders loading placeholder when loading is true', () => {
    const position = { collateral_deposited: 0n, debt_borrowed: 0n }
    const { container } = render(<PositionCard position={position} healthFactor={0} loading={true} />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
