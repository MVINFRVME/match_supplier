/**
 * Не используется в UI: приоритеты задаются только через API (p_speed / …).
 * Компонент оставлен на случай возврата ручной настройки весов.
 */
import type { Priorities } from '../types'

const ITEMS: { key: keyof Priorities; label: string }[] = [
  { key: 'speed', label: 'Скорость' },
  { key: 'reliability', label: 'Надёжность' },
  { key: 'low_moq', label: 'Низкий МОQ' },
]

const LEVELS = ['—', 'обычно', 'важно', 'критично']

type Props = {
  value: Priorities
  onChange: (next: Priorities) => void
  compact?: boolean
}

export function PriorityControls({ value, onChange, compact = false }: Props) {
  if (compact) {
    return (
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">
            Приоритеты
          </p>
          <p className="text-[11px] text-ink-soft/80">меняют порядок выдачи</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <label key={item.key} className="block">
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-ink">{item.label}</span>
                <span className="text-leaf">{LEVELS[value[item.key]]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={value[item.key]}
                onChange={(e) => onChange({ ...value, [item.key]: Number(e.target.value) })}
                className="w-full accent-accent"
                aria-label={item.label}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-leaf-deep">Что для вас важнее</h2>
        <p className="text-xs text-ink-soft">40 из 100 баллов — под ваши приоритеты</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="text-xs text-leaf">{LEVELS[value[item.key]]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={value[item.key]}
              onChange={(e) => onChange({ ...value, [item.key]: Number(e.target.value) })}
              className="mt-2 w-full accent-accent"
              aria-label={item.label}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
