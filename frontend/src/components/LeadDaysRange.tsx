import { LEAD_DAYS_MIN } from '../types'

type Props = {
  minValue: number
  maxValue: number
  /** Верх шкалы = max lead_time_days по каталогу. */
  maxDays: number
  onChange: (min: number, max: number) => void
  disabled?: boolean
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

/** Срок доставки: баблы + слайдер; верх шкалы из данных поставщиков. */
export function LeadDaysRange({
  minValue,
  maxValue,
  maxDays,
  onChange,
  disabled = false,
}: Props) {
  const sliderMax = Math.max(LEAD_DAYS_MIN, maxDays)
  const span = Math.max(sliderMax - LEAD_DAYS_MIN, 1)
  const safeMin = clamp(minValue, LEAD_DAYS_MIN, sliderMax)
  const safeMax = clamp(maxValue, LEAD_DAYS_MIN, sliderMax)
  const leftPct = ((safeMin - LEAD_DAYS_MIN) / span) * 100
  const rightPct = ((safeMax - LEAD_DAYS_MIN) / span) * 100

  const setMin = (raw: number) => {
    if (disabled) return
    onChange(clamp(Math.min(raw, safeMax), LEAD_DAYS_MIN, sliderMax), safeMax)
  }
  const setMax = (raw: number) => {
    if (disabled) return
    onChange(safeMin, clamp(Math.max(raw, safeMin), LEAD_DAYS_MIN, sliderMax))
  }

  return (
    <div className={`min-w-0 ${disabled ? 'opacity-45' : ''}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="field-label mb-0">Срок доставки</p>
        {disabled ? <p className="text-[11px] text-ink-soft">Не для самовывоза</p> : null}
      </div>

      <div className="w-[300px] max-w-full">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="lead-bubble lead-bubble-static">
            <span className="text-ink-soft">от</span>
            <input
              type="number"
              min={LEAD_DAYS_MIN}
              max={sliderMax}
              value={safeMin}
              disabled={disabled}
              onChange={(e) => setMin(Number(e.target.value) || LEAD_DAYS_MIN)}
              className="lead-bubble-input"
              aria-label="Срок от, дней"
            />
            <span className="text-ink-soft">дн.</span>
          </div>
          <div className="lead-bubble lead-bubble-static">
            <span className="text-ink-soft">до</span>
            <input
              type="number"
              min={LEAD_DAYS_MIN}
              max={sliderMax}
              value={safeMax}
              disabled={disabled}
              onChange={(e) => setMax(Number(e.target.value) || sliderMax)}
              className="lead-bubble-input"
              aria-label="Срок до, дней"
            />
            <span className="text-ink-soft">дн.</span>
          </div>
        </div>

        <div className={`lead-range-wrap w-full ${disabled ? 'pointer-events-none' : ''}`}>
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line" />
          <div
            className="pointer-events-none absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ink"
            style={{ left: `${leftPct}%`, width: `${Math.max(rightPct - leftPct, 0)}%` }}
          />
          <input
            type="range"
            min={LEAD_DAYS_MIN}
            max={sliderMax}
            step={1}
            value={safeMin}
            disabled={disabled}
            onChange={(e) => setMin(Number(e.target.value))}
            className="lead-range"
            style={{ zIndex: safeMin > sliderMax - 3 ? 5 : 3 }}
            aria-label="Минимальный срок доставки"
          />
          <input
            type="range"
            min={LEAD_DAYS_MIN}
            max={sliderMax}
            step={1}
            value={safeMax}
            disabled={disabled}
            onChange={(e) => setMax(Number(e.target.value))}
            className="lead-range"
            style={{ zIndex: 4 }}
            aria-label="Максимальный срок доставки"
          />
        </div>
      </div>
    </div>
  )
}
