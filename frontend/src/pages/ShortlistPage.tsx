import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSupplier } from '../api'
import {
  STATUS_LABELS,
  loadShortlist,
  toggleShortlist,
  updateShortlist,
  type ShortlistEntry,
  type ShortlistStatus,
} from '../storage'

const STATUS_ORDER: ShortlistStatus[] = ['new', 'contacted', 'waiting', 'rejected']

type StatusFilter = 'all' | ShortlistStatus

const STATUS_TONE: Record<ShortlistStatus, string> = {
  new: 'bg-mint text-ink',
  contacted: 'bg-leaf-deep text-white',
  waiting: 'bg-sand text-ink-soft',
  rejected: 'bg-rose-50 text-rose-600',
}

const chipClass = (active: boolean) =>
  `inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${
    active
      ? 'border-accent/35 bg-mint text-ink shadow-[inset_0_0_0_1px_rgb(99_102_241_/_0.12)]'
      : 'border-line bg-white text-ink-soft hover:border-accent/25 hover:bg-sand hover:text-ink'
  }`

function matchesRegion(entry: ShortlistEntry, regions: string[]) {
  if (regions.length === 0) return true
  return entry.regions.some((r) => regions.includes(r))
}

export function ShortlistPage({ onChange }: { onChange: () => void }) {
  const [entries, setEntries] = useState(loadShortlist)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [regionFilter, setRegionFilter] = useState<string[]>([])

  useEffect(() => {
    const missing = loadShortlist().filter(
      (e) => !e.categories?.length || !e.regions?.length,
    )
    if (missing.length === 0) return
    let cancelled = false

    void (async () => {
      for (const entry of missing) {
        try {
          const res = await fetchSupplier(entry.id)
          if (cancelled) return
          updateShortlist(entry.id, {
            categories: entry.categories?.length
              ? entry.categories
              : res.supplier.categories,
            regions: entry.regions?.length ? entry.regions : res.supplier.regions,
            name: res.supplier.name,
          })
        } catch {
          // ignore
        }
      }
      if (!cancelled) setEntries(loadShortlist())
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const regionOptions = useMemo(() => {
    const counts = new Map<string, number>()
    const pool =
      statusFilter === 'all' ? entries : entries.filter((e) => e.status === statusFilter)
    for (const entry of pool) {
      for (const region of entry.regions) {
        counts.set(region, (counts.get(region) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => a.region.localeCompare(b.region, 'ru'))
  }, [entries, statusFilter])

  // Status counts ignore region — dependency is one-way: status → regions
  const statusCounts = useMemo(() => {
    const byStatus = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
      ShortlistStatus,
      number
    >
    for (const entry of entries) byStatus[entry.status] += 1
    return { all: entries.length, ...byStatus }
  }, [entries])

  const visible = useMemo(() => {
    return entries.filter((e) => {
      const statusOk = statusFilter === 'all' || e.status === statusFilter
      return statusOk && matchesRegion(e, regionFilter)
    })
  }, [entries, statusFilter, regionFilter])

  // Keep only regions that exist in the current status pool
  useEffect(() => {
    const known = new Set(regionOptions.map((o) => o.region))
    setRegionFilter((prev) => {
      const next = prev.filter((r) => known.has(r))
      return next.length === prev.length ? prev : next
    })
  }, [regionOptions])

  if (entries.length === 0) {
    return (
      <div className="surface rounded-2xl border-dashed px-6 py-14 text-center">
        <h1 className="font-display text-2xl text-ink">Шортлист пуст</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Добавляйте поставщиков из выдачи — здесь появятся статусы и заметки.
        </p>
        <Link to="/" className="btn-primary mt-5">
          К поиску
        </Link>
      </div>
    )
  }

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Все', count: statusCounts.all },
    ...STATUS_ORDER.map((status) => ({
      key: status as StatusFilter,
      label: STATUS_LABELS[status],
      count: statusCounts[status],
    })),
  ]

  const toggleRegion = (region: string) => {
    setRegionFilter((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    )
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setRegionFilter([])
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-ink">Шортлист</h1>

      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">
            Статус
          </p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Фильтр по статусу">
            {statusFilters.map(({ key, label, count }) => {
              const active = statusFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (key === statusFilter) return
                    setStatusFilter(key)
                    setRegionFilter([])
                  }}
                  className={chipClass(active)}
                >
                  {label}
                  <span
                    className={`tabular-nums ${active ? 'text-accent' : 'text-ink-soft/80'}`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {regionOptions.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-soft">
              Регион
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Фильтр по региону">
              <button
                type="button"
                onClick={() => setRegionFilter([])}
                className={chipClass(regionFilter.length === 0)}
              >
                Все регионы
                <span
                  className={`tabular-nums ${
                    regionFilter.length === 0 ? 'text-accent' : 'text-ink-soft/80'
                  }`}
                >
                  {statusFilter === 'all'
                    ? entries.length
                    : entries.filter((e) => e.status === statusFilter).length}
                </span>
              </button>
              {regionOptions.map(({ region, count }) => {
                const active = regionFilter.includes(region)
                return (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={chipClass(active)}
                  >
                    {region}
                    <span
                      className={`tabular-nums ${active ? 'text-accent' : 'text-ink-soft/80'}`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="surface rounded-2xl border-dashed px-6 py-10 text-center">
          <p className="font-display text-lg text-ink">Никого не нашли по фильтрам</p>
          <p className="mt-1.5 text-sm text-ink-soft">
            Сбросьте статус или регион — либо добавьте поставщиков в шортлист.
          </p>
          <button type="button" className="btn-ghost mt-4" onClick={resetFilters}>
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((entry) => (
            <ShortlistCard
              key={entry.id}
              entry={entry}
              showStatusChip={statusFilter === 'all'}
              onChange={(next) => {
                setEntries(next)
                onChange()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ShortlistCard({
  entry,
  showStatusChip,
  onChange,
}: {
  entry: ShortlistEntry
  showStatusChip: boolean
  onChange: (next: ShortlistEntry[]) => void
}) {
  const [draft, setDraft] = useState(entry.note)
  const [noteFocused, setNoteFocused] = useState(false)
  const [typedWhileFocused, setTypedWhileFocused] = useState(false)
  const dirty = draft !== entry.note
  const showSave = noteFocused && typedWhileFocused && dirty
  const noteExpanded = noteFocused || draft.trim().length > 0

  useEffect(() => {
    setDraft(entry.note)
  }, [entry.id, entry.note])

  const categoriesLabel = entry.categories?.length
    ? entry.categories.slice(0, 3).join(' · ')
    : null
  const regionsLabel = entry.regions?.length ? entry.regions.slice(0, 2).join(', ') : null
  const metaLine = [categoriesLabel, regionsLabel].filter(Boolean).join(' · ')

  const saveNote = () => {
    if (!dirty) return
    onChange(updateShortlist(entry.id, { note: draft }))
    setTypedWhileFocused(false)
  }

  return (
    <article className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/suppliers/${entry.id}`}
            className="font-display text-xl text-ink transition hover:opacity-70"
          >
            {entry.name}
          </Link>
          {metaLine ? <p className="mt-1 text-sm text-ink-soft">{metaLine}</p> : null}
          {showStatusChip ? (
            <p className="mt-1.5">
              <span className={`chip ${STATUS_TONE[entry.status]}`}>
                {STATUS_LABELS[entry.status]}
              </span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() =>
            onChange(
              toggleShortlist(entry.id, entry.name, '', entry.categories, entry.regions),
            )
          }
          className="text-xs text-ink-soft hover:text-accent"
        >
          убрать
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onChange(updateShortlist(entry.id, { status }))}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              entry.status === status
                ? STATUS_TONE[status]
                : 'border border-line text-ink-soft hover:border-accent/30 hover:bg-mint'
            }`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setTypedWhileFocused(true)
          }}
          onFocus={() => {
            setNoteFocused(true)
            setTypedWhileFocused(false)
          }}
          onBlur={() => setNoteFocused(false)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              saveNote()
            }
          }}
          placeholder="Что уточнить, когда перезвонить…"
          className={`field resize-none overflow-y-auto transition-[height] duration-300 ease-out ${
            noteExpanded ? 'h-[15rem]' : 'h-[5.75rem]'
          }`}
        />
        {/* Слот под галку только в развёрнутом виде — высота заложена сразу. */}
        <div
          className={`flex justify-end overflow-hidden transition-[height,margin] duration-300 ease-out ${
            noteExpanded ? 'mt-1.5 h-8' : 'mt-0 h-0'
          }`}
        >
          {showSave ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={saveNote}
              title="Сохранить комментарий"
              aria-label="Сохранить комментарий"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-accent/90"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  d="M5 10.5 8.5 14 15 6.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
