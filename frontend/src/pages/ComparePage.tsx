import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCompare } from '../api'
import { ScoreBadge } from '../components/ScoreBadge'
import { loadCompareIds, loadSearchContext, saveCompareIds, toggleShortlist } from '../storage'
import type { CompareResponse, SearchParams, SupplierMatch } from '../types'
import { formatDeliveryTypes, formatLeadDays } from '../types'
import { usePriorities } from '../usePriorities'

type Row = {
  label: string
  render: (item: SupplierMatch) => React.ReactNode
}

const ROWS: Row[] = [
  { label: 'Оценка соответствия', render: (item) => <ScoreBadge score={item.score} compact /> },
  { label: 'Категории', render: (item) => item.supplier.categories.join(', ') },
  { label: 'Города', render: (item) => item.supplier.cities.join(', ') },
  { label: 'Регионы работы', render: (item) => item.supplier.regions.join(', ') },
  { label: 'Минимальная сумма заказа', render: (item) => item.supplier.min_order ?? '—' },
  { label: 'Цена', render: (item) => item.supplier.price_hint ?? '—' },
  { label: 'Срок доставки', render: (item) => formatLeadDays(item.supplier) },
  {
    label: 'Тип доставки',
    render: (item) => formatDeliveryTypes(item.supplier.delivery_types),
  },
  {
    label: 'Документы',
    render: (item) => item.supplier.certificates.join(', ') || '—',
  },
  { label: 'Условия доставки', render: (item) => item.supplier.delivery ?? '—' },
  {
    label: 'Контакты',
    render: (item) => (
      <div className="space-y-0.5">
        <div>{item.supplier.contacts.phone ?? '—'}</div>
        <div className="text-ink-soft">{item.supplier.contacts.email ?? '—'}</div>
      </div>
    ),
  },
]

export function ComparePage({ onChange }: { onChange: () => void }) {
  const [ids, setIds] = useState(loadCompareIds)
  const [priorities] = usePriorities()
  const [searchContext, setSearchContext] = useState<SearchParams>(() => loadSearchContext())
  const [data, setData] = useState<CompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ids.length === 0) {
      setData(null)
      return
    }
    const ctx = loadSearchContext()
    setSearchContext(ctx)
    let cancelled = false
    fetchCompare(ids, ctx, priorities)
      .then((res) => !cancelled && setData(res))
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [ids, priorities])

  const remove = (id: string) => {
    const next = ids.filter((x) => x !== id)
    saveCompareIds(next)
    setIds(next)
    onChange()
  }

  if (ids.length === 0) {
    return (
      <div className="surface rounded-2xl border-dashed px-6 py-14 text-center">
        <h1 className="font-display text-2xl text-leaf-deep">Сравнение пусто</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Добавьте до 3 поставщиков кнопкой «Сравнить» в выдаче.
        </p>
        <Link to="/" className="btn-primary mt-5">
          К поиску
        </Link>
      </div>
    )
  }

  const recommended = data?.items.find((i) => i.supplier.id === data.recommendation_id)

  const contextBits = [
    searchContext.category,
    searchContext.cities?.length ? searchContext.cities.join(', ') : null,
    searchContext.regions?.length ? searchContext.regions.join(', ') : null,
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-leaf-deep">Сравнение</h1>
        {contextBits.length ? (
          <p className="mt-1 text-sm text-ink-soft">
            Оценка с учётом запроса: {contextBits.join(' · ')}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-accent">
          {error}
        </p>
      ) : null}

      {recommended ? (
        <div className="overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-br from-mint/70 via-white to-sand/50 p-5 shadow-[0_14px_36px_-24px_rgb(44_46_51_/_0.14)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            С кем лучше связаться
          </p>
          <p className="mt-2 font-display text-2xl text-ink sm:text-3xl">
            {recommended.supplier.name}
          </p>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-ink-soft">
            {data?.recommendation_reason}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/suppliers/${recommended.supplier.id}`} className="btn-primary">
              Открыть и подготовить запрос
            </Link>
            <button
              type="button"
              onClick={() => {
                toggleShortlist(
                  recommended.supplier.id,
                  recommended.supplier.name,
                  '',
                  recommended.supplier.categories,
                  recommended.supplier.regions,
                )
                onChange()
              }}
              className="btn-ghost"
            >
              В шортлист
            </button>
          </div>

          {data?.highlights.length ? (
            <ul
              className={`mt-4 grid gap-2 border-t border-leaf/15 pt-4 text-sm text-ink-soft ${
                data.highlights.length > 2 ? 'sm:grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {data.highlights.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="surface overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-sand/35 text-ink-soft">
            <tr>
              <th className="sticky left-0 z-10 min-w-40 bg-sand/80 px-4 py-3 font-semibold text-ink backdrop-blur-sm">
                Параметр
              </th>
              {data?.items.map((item) => (
                <th key={item.supplier.id} className="min-w-48 px-4 py-3 font-medium text-ink">
                  <div className="inline-flex max-w-full items-center gap-1.5">
                    <Link
                      to={`/suppliers/${item.supplier.id}`}
                      className="font-display text-base text-leaf-deep hover:text-leaf"
                    >
                      {item.supplier.name}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(item.supplier.id)}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-soft transition hover:bg-accent/10 hover:text-accent"
                      aria-label={`Убрать ${item.supplier.name} из сравнения`}
                      title="Убрать"
                    >
                      <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
                        <path
                          d="M7.5 4.5V3.75A1.25 1.25 0 0 1 8.75 2.5h2.5A1.25 1.25 0 0 1 12.5 3.75V4.5M4 5.5h12M15.5 5.5l-.7 9.1a1.75 1.75 0 0 1-1.74 1.65H6.94a1.75 1.75 0 0 1-1.74-1.65L4.5 5.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8.25 8.5v5M11.75 8.5v5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => (
              <tr
                key={row.label}
                className={`border-b border-line/60 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-sand/15'}`}
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-3 align-top font-medium text-ink shadow-[2px_0_8px_-6px_rgba(15,61,46,0.35)]">
                  {row.label}
                </td>
                {data?.items.map((item) => (
                  <td key={item.supplier.id} className="px-4 py-3 align-top text-ink-soft">
                    {row.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
