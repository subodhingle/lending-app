import { formatAmount, getHealthColor, getHealthBg, getHealthLabel } from '../lib/ContractInteraction'
import { COLLATERAL_SYMBOL, DEBT_SYMBOL } from '../lib/ContractInteraction'
import type { Position } from '../lib/ContractInteraction'

interface PositionCardProps {
  position: Position
  healthFactor: number
  loading?: boolean
}

export function PositionCard({ position, healthFactor, loading }: PositionCardProps) {
  const healthColor = getHealthColor(healthFactor)
  const healthBg = getHealthBg(healthFactor)
  const healthLabel = getHealthLabel(healthFactor)

  if (loading) {
    return (
      <div className="bg-white border border-[#e0e0d8] rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
        <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
      </div>
    )
  }

  return (
    <div className={`border rounded-2xl p-5 ${healthBg}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#6b6b6b] uppercase tracking-wide">
          Your Position
        </h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
          healthFactor === 0
            ? 'bg-gray-100 text-gray-500 border-gray-200'
            : healthFactor >= 150
            ? 'bg-green-100 text-green-700 border-green-200'
            : healthFactor >= 120
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-red-100 text-red-600 border-red-200'
        }`}>
          {healthLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-[#6b6b6b] mb-1">Collateral</p>
          <p className="text-xl font-bold text-[#1a1a1a]">
            {formatAmount(position.collateral_deposited)}
          </p>
          <p className="text-xs text-[#6b6b6b]">{COLLATERAL_SYMBOL}</p>
        </div>
        <div>
          <p className="text-xs text-[#6b6b6b] mb-1">Debt</p>
          <p className="text-xl font-bold text-[#1a1a1a]">
            {formatAmount(position.debt_borrowed)}
          </p>
          <p className="text-xs text-[#6b6b6b]">{DEBT_SYMBOL}</p>
        </div>
      </div>

      {healthFactor > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6b6b6b]">Health Factor:</span>
          <span className={`text-sm font-bold ${healthColor}`}>
            {healthFactor}%
          </span>
        </div>
      )}
    </div>
  )
}
