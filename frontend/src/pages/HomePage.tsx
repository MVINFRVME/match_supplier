import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchSuppliers } from '../api'
import { SearchWorkspace } from '../components/SearchWorkspace'
import { SupplierCard } from '../components/SupplierCard'
import {
  COMPARE_LIMIT,
  loadCompareIds,
  loadSearchContext,
  loadShortlist,
  savePriorities,
  saveSearchContext,
  toggleCompareId,
  toggleShortlist,
} from '../storage'
import { hasSearchFilters, paramsFromUrl, toUrl } from '../searchParams'
import type { ParsedQuery, SearchParams, SearchResponse } from '../types'
import { leadDaysEnabled } from '../types'
import { usePriorities } from '../usePriorities'

function SkeletonRow() {
  return (
    <div className="surface animate-pulse rounded-xl p-4 sm:px-5">
      <div className="flex gap-4">
        <div className="h-8 w-10 rounded bg-sand" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 rounded bg-sand" />
          <div className="h-3 w-2/3 rounded bg-sand/70" />
          <div className="mt-3 grid grid-cols-4 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 rounded bg-sand/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function HomePage({ onChange }: { onChange: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [priorities, setPriorities] = usePriorities()
  const [hydrated, setHydrated] = useState(false)
  const [draft, setDraft] = useState<SearchParams>(() => {
    const fromUrl = paramsFromUrl(searchParams)
    return hasSearchFilters(fromUrl) ? fromUrl : loadSearchContext()
  })
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState(loadCompareIds)
  const [shortlistIds, setShortlistIds] = useState(() => loadShortlist().map((e) => e.id))

  const applied = useMemo(() => paramsFromUrl(searchParams), [searchParams])

  // Вернулись на «Поиск» без query — подтянуть последний запрос из localStorage.
  useEffect(() => {
    const ctx = loadSearchContext()
    if (![...searchParams.keys()].length && hasSearchFilters(ctx)) {
      setSearchParams(toUrl(ctx), { replace: true })
    }
    setHydrated(true)
    // только при монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    setDraft(applied)
    saveSearchContext(applied)
  }, [applied, hydrated])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchSuppliers(applied, priorities)
      .then((res) => !cancelled && setData(res))
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [applied, priorities, hydrated])

  const meta = {
    categories: data?.categories ?? [],
    cities: data?.cities ?? [],
    regions: data?.regions ?? [],
    max_lead_days: data?.max_lead_days,
  }

  const detailQuery = `?${toUrl(applied).toString()}`

  const applyParsed = (parsed: ParsedQuery) => {
    const deliveryType = parsed.delivery_type ?? undefined
    const next: SearchParams = {
      q: parsed.category ? undefined : (parsed.keywords ?? undefined),
      category: parsed.category ?? undefined,
      cities: parsed.city ? [parsed.city] : undefined,
      regions: parsed.region ? [parsed.region] : undefined,
      max_moq: parsed.max_moq ?? undefined,
      min_lead_days: undefined,
      max_lead_days: leadDaysEnabled(deliveryType)
        ? (parsed.max_lead_days ?? undefined)
        : undefined,
      delivery_type: deliveryType,
      has_delivery:
        deliveryType === 'own_transport' || deliveryType === 'transport_company',
      require_certificates: parsed.require_certificates,
    }
    savePriorities(parsed.priorities)
    setPriorities(parsed.priorities)
    setDraft(next)
    setSearchParams(toUrl(next))
  }

  return (
    <div className="space-y-5">
      <SearchWorkspace
        meta={meta}
        value={draft}
        onChange={setDraft}
        onSubmit={() => setSearchParams(toUrl(draft))}
        onParsed={applyParsed}
      />

      <div className="flex flex-wrap items-end justify-between gap-3 px-0.5">
        <div>
          <h2 className="font-display text-xl text-leaf-deep">Найденные</h2>
          <p className="text-xs text-ink-soft">Отсортировано по оценке соответствия</p>
        </div>
        <p className="text-sm tabular-nums text-ink-soft">
          {loading ? '…' : `${data?.total ?? 0} поставщиков`}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-accent">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
          : data?.items.map((item, index) => (
              <SupplierCard
                key={item.supplier.id}
                item={item}
                rank={index + 1}
                inCompare={compareIds.includes(item.supplier.id)}
                inShortlist={shortlistIds.includes(item.supplier.id)}
                compareFull={compareIds.length >= COMPARE_LIMIT}
                searchQuery={detailQuery === '?' ? '' : detailQuery}
                onToggleCompare={(id) => {
                  const next = toggleCompareId(id)
                  setCompareIds(next)
                  onChange()
                }}
                onToggleShortlist={(id, name, categories, regions) => {
                  const next = toggleShortlist(id, name, '', categories, regions)
                  setShortlistIds(next.map((e) => e.id))
                  onChange()
                }}
              />
            ))}
      </div>

      {!loading && data && data.items.length === 0 ? (
        <div className="surface rounded-2xl border-dashed px-6 py-12 text-center">
          <p className="font-display text-lg text-leaf-deep">Никого не нашли</p>
          <p className="mt-1 text-sm text-ink-soft">Ослабьте фильтры или переформулируйте запрос.</p>
          <Link
            to="/"
            className="btn-ghost mt-4"
            onClick={() => saveSearchContext({})}
          >
            Сбросить
          </Link>
        </div>
      ) : null}
    </div>
  )
}
