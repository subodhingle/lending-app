interface HealthFactorGaugeProps {
  healthFactor: number  // raw value from contract (e.g. 150 = 150%)
  size?: number
}

export function HealthFactorGauge({ healthFactor, size = 120 }: HealthFactorGaugeProps) {
  // Contract returns collateral*100/debt, so 150 = 150%, 10000 = way over-collateralised
  // Cap the gauge fill at 300% for display — anything above is just "very safe"
  const DISPLAY_MAX = 300
  const clampedHF = Math.min(healthFactor, DISPLAY_MAX)
  const percentage = healthFactor === 0 ? 0 : clampedHF / DISPLAY_MAX

  const cx = size / 2
  const cy = size / 2
  const r = (size / 2) * 0.75
  const strokeWidth = size * 0.08

  const startAngle = -210
  const totalAngle = 240
  const endAngle = startAngle + totalAngle * percentage

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function describeArc(start: number, end: number) {
    const s = polarToCartesian(start)
    const e = polarToCartesian(end)
    const largeArc = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
  }

  const trackPath = describeArc(startAngle, startAngle + totalAngle)
  const valuePath = percentage > 0 ? describeArc(startAngle, endAngle) : ''

  const color =
    healthFactor === 0 ? '#9ca3af'
    : healthFactor >= 150 ? '#2d6a4f'
    : healthFactor >= 120 ? '#b5451b'
    : '#c1121f'

  // Display label: cap at 999% to avoid huge numbers, show ∞ if no debt
  const displayLabel =
    healthFactor === 0 ? '—'
    : healthFactor > 999 ? '999%+'
    : `${healthFactor}%`

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size}`}>
        <path d={trackPath} fill="none" stroke="#e8e8e0" strokeWidth={strokeWidth} strokeLinecap="round" />
        {valuePath && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
        <text x={cx} y={cy + 4} textAnchor="middle"
          fontSize={healthFactor > 999 ? size * 0.11 : size * 0.16}
          fontWeight="700" fill={color}>
          {displayLabel}
        </text>
      </svg>
      <p className="text-xs text-[#6b6b6b] -mt-2">Health Factor</p>
    </div>
  )
}
