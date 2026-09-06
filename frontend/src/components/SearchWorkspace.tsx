import { useState } from 'react'
import { parseQuery } from '../api'
import { loadRecentSearches, pushRecentSearch, removeRecentSearch } from '../storage'
import type { DeliveryType, ParsedQuery, SearchParams } from '../types'
import {
  DELIVERY_TYPE_OPTIONS,
  LEAD_DAYS_MAX_FALLBACK,
  LEAD_DAYS_MIN,
  leadDaysEnabled,
} from '../types'
import { LeadDaysRange } from './LeadDaysRange'
import { MultiSelectDropdown } from './MultiSelectDropdown'

type Meta = {
  categories: string[]
  cities: string[]
  regions: string[]
  max_lead_days?: number
}

type Props = {
  meta: Meta
  value: SearchParams
  onChange: (next: SearchParams) => void
  onSubmit: () => void
  onParsed: (parsed: ParsedQuery, rawText: string) => void
}

function leadFilterActive(value: SearchParams, leadDaysMax: number) {
  return (
    (value.min_lead_days != null && value.min_lead_days > LEAD_DAYS_MIN) ||
    (value.max_lead_days != null && value.max_lead_days < leadDaysMax)
  )
}

function hasActiveFilters(value: SearchParams, leadDaysMax: number) {
  return Boolean(
    value.category ||
      value.cities?.length ||
      value.regions?.length ||
      value.max_moq ||
      value.delivery_type ||
      value.require_certificates ||
      (leadFilterActive(value, leadDaysMax) && leadDaysEnabled(value.delivery_type)),
  )
}

function toggleInList(list: string[] | undefined, item: string): string[] | undefined {
  const current = list ?? []
  const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item]
  return next.length ? next : undefined
}

export function SearchWorkspace({ meta, value, onChange, onSubmit, onParsed }: Props) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState(loadRecentSearches)

  const leadDaysMax = meta.max_lead_days ?? LEAD_DAYS_MAX_FALLBACK

  const set = <K extends keyof SearchParams>(key: K, v: SearchParams[K]) =>
    onChange({ ...value, [key]: v })

  const filtersActive = hasActiveFilters(value, leadDaysMax)

  const runPrompt = async (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const parsed = await parseQuery(text)
      setRecent(pushRecentSearch(text))
      onParsed(parsed, text)
    } catch {
      setError('Не удалось разобрать запрос — уточните фильтры вручную')
    } finally {
      setLoading(false)
    }
  }

  const clearAll = () => {
    onChange({
      q: undefined,
      category: undefined,
      cities: undefined,
      regions: undefined,
      max_moq: undefined,
      min_lead_days: undefined,
      max_lead_days: undefined,
      delivery_type: undefined,
      has_delivery: false,
      require_certificates: false,
    })
    setPrompt('')
  }

  return (
    <section className="surface-raised overflow-hidden rounded-2xl">
      <div className="border-b border-line/50 bg-gradient-to-br from-mint/70 via-white to-sand/60 px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
        <h1 className="font-display text-3xl leading-tight text-ink sm:text-[2.35rem]">
          Поиск поставщика
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Можно ввести запрос своими словами или настроить фильтры вручную
        </p>

        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault()
            void runPrompt(prompt)
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Запрос</span>
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft/65"
              fill="none"
              aria-hidden
            >
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12.5 12.5 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="молоко Екатеринбург минимальная сумма заказа 30000"
              className="field h-12 rounded-xl border-leaf/20 bg-white/95 pl-10 pr-3.5 text-[15px] shadow-[0_1px_2px_rgb(26_46_38_/_0.04)]"
            />
          </label>
          <button type="submit" disabled={loading || !prompt.trim()} className="btn-primary h-12 px-6">
            {loading ? 'Ищу…' : 'Найти'}
          </button>
        </form>

        {recent.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-ink-soft/70">Недавние</span>
            {recent.map((example) => (
              <span
                key={example}
                className="inline-flex max-w-72 items-center gap-1 rounded-full border border-line bg-white/90 py-0.5 pl-3 pr-1 text-xs text-ink-soft transition hover:border-accent/30 hover:bg-mint hover:text-ink"
              >
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(example)
                    void runPrompt(example)
                  }}
                  className="min-w-0 truncate py-0.5 text-left"
                  title={example}
                >
                  {example}
                </button>
                <button
                  type="button"
                  onClick={() => setRecent(removeRecentSearch(example))}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-soft/70 transition hover:bg-sand hover:text-ink"
                  aria-label={`Удалить «${example}» из недавних`}
                  title="Удалить"
                >
                  <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden>
                    <path
                      d="M3 3l6 6M9 3 3 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      </div>

      <form
        className="space-y-5 px-5 py-5 sm:px-7"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm font-semibold text-leaf-deep">Фильтры</p>
          <button
            type="button"
            onClick={clearAll}
            disabled={!filtersActive}
            className="text-xs text-ink-soft transition hover:text-accent disabled:invisible"
          >
            Сбросить все
          </button>
        </div>

        {/* Одна сетка 4×N — как горизонтальный filter bar: равные колонки, без «дыр» */}
        <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block min-w-0">
            <span className="field-label">Категория товара</span>
            <select
              className="field field-control"
              value={value.category ?? ''}
              onChange={(e) => set('category', e.target.value || undefined)}
            >
              <option value="">Все категории</option>
              {meta.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="field-label">Сумма заказа от</span>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={5000}
                className="field field-control pr-8"
                value={value.max_moq ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\s/g, '')
                  if (!raw) {
                    set('max_moq', undefined)
                    return
                  }
                  const n = Number(raw)
                  set('max_moq', Number.isFinite(n) ? n : undefined)
                }}
                placeholder="30 000"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
                ₽
              </span>
            </div>
          </label>

          <MultiSelectDropdown
            label="Город"
            options={meta.cities}
            selected={value.cities ?? []}
            placeholder="Любой город"
            onToggle={(city) => set('cities', toggleInList(value.cities, city))}
            onClear={() => set('cities', undefined)}
          />

          <MultiSelectDropdown
            label="Регион работы"
            options={meta.regions}
            selected={value.regions ?? []}
            placeholder="Любой регион"
            onToggle={(region) => set('regions', toggleInList(value.regions, region))}
            onClear={() => set('regions', undefined)}
          />

          <label className="block min-w-0 lg:col-span-2">
            <span className="field-label">Тип доставки</span>
            <select
              className="field field-control"
              value={value.delivery_type ?? ''}
              onChange={(e) => {
                const next = (e.target.value || undefined) as DeliveryType | undefined
                onChange({
                  ...value,
                  delivery_type: next,
                  has_delivery: next !== 'pickup' && next !== undefined,
                  min_lead_days: leadDaysEnabled(next) ? value.min_lead_days : undefined,
                  max_lead_days: leadDaysEnabled(next) ? value.max_lead_days : undefined,
                })
              }}
            >
              <option value="">Любой</option>
              {DELIVERY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex min-w-0 flex-col justify-end lg:col-span-2">
            <span className="field-label invisible select-none" aria-hidden>
              &nbsp;
            </span>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-accent"
                checked={Boolean(value.require_certificates)}
                onChange={(e) => set('require_certificates', e.target.checked)}
              />
              Наличие сертификатов
            </label>
          </div>

          <div className="min-w-0 sm:col-span-2 lg:col-span-4">
            <LeadDaysRange
              minValue={value.min_lead_days ?? LEAD_DAYS_MIN}
              maxValue={value.max_lead_days ?? leadDaysMax}
              maxDays={leadDaysMax}
              disabled={!leadDaysEnabled(value.delivery_type)}
              onChange={(min, max) =>
                onChange({
                  ...value,
                  min_lead_days: min > LEAD_DAYS_MIN ? min : undefined,
                  max_lead_days: max < leadDaysMax ? max : undefined,
                })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line/70 pt-4">
          <button type="submit" className="btn-primary h-11 px-5">
            Применить фильтры
          </button>
        </div>
      </form>
    </section>
  )
}
