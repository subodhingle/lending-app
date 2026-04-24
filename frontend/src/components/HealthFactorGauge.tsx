interface HealthFactorGaugeProps {
  healthFactor: number
  size?: number
}

export function HealthFactorGauge({ healthFactor, size = 120 }: HealthFactorGaugeProps) {
  // Gauge goes from 0 to 200 (200+ is max safe)
  const maxHF = 200
  const clampedHF = Math.min(healthFactor, maxHF)
  const percentage = healthFactor === 0 ? 0 : clampedHF / maxHF

  // SVG arc parameters
  const cx = size / 2
  const cy = size / 2
  const r = (size / 2) * 0.75
  const strokeWidth = size * 0.08

  // Arc spans 240 degrees (from 150deg to 390deg = -210deg to 30deg)
  const startAngle = -210
  const totalAngle = 240
  const endAngle = startAngle + totalAngle * percentage

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
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
    healthFactor === 0
      ? '#9ca3af'
      : healthFactor >= 150
      ? '#2d6a4f'
      : healthFactor >= 120
      ? '#b5451b'
      : '#c1121f'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#e8e8e0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Center text */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={size * 0.16}
          fontWeight="700"
          fill={color}
        >
          {healthFactor === 0 ? '—' : `${healthFactor}%`}
        </text>
      </svg>
      <p className="text-xs text-[#6b6b6b] -mt-2">Health Factor</p>
    </div>
  )
}
