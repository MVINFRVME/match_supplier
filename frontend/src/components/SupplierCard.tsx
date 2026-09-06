import { Link } from 'react-router-dom'
import type { SupplierMatch } from '../types'
import { deliveryTypeLabel, formatLeadDays } from '../types'
import { ScoreBadge } from './ScoreBadge'

type Props = {
  item: SupplierMatch
  inCompare: boolean
  inShortlist: boolean
  compareFull?: boolean
  onToggleCompare: (id: string) => void
  onToggleShortlist: (id: string, name: string, categories: string[], regions: string[]) => void
  searchQuery: string
  rank?: number
}

export function SupplierCard({
  item,
  inCompare,
  inShortlist,
  compareFull = false,
  onToggleCompare,
  onToggleShortlist,
  searchQuery,
  rank,
}: Props) {
  const { supplier, score } = item
  const href = `/suppliers/${supplier.id}${searchQuery}`
  const compareDisabled = !inCompare && compareFull

  return (
    <article className="group surface grid gap-4 rounded-2xl p-4 transition duration-300 hover:border-accent/20 hover:shadow-[0_14px_36px_-22px_rgb(44_46_51_/_0.16)] sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:items-start sm:gap-5 sm:px-5 sm:py-5">
      {rank != null ? (
        <div className="hidden justify-center pt-1 sm:flex">
          <span className="font-display text-lg tabular-nums text-leaf-deep/40">{rank}</span>
        </div>
      ) : (
        <div className="hidden sm:block" />
      )}

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {rank != null ? (
                <span className="pt-0.5 font-display text-lg tabular-nums text-leaf-deep/40 sm:hidden">
                  {rank}
                </span>
              ) : null}
              <div className="min-w-0">
                <Link
                  to={href}
                  className="font-display text-lg leading-snug text-ink transition group-hover:opacity-70"
                >
                  {supplier.name}
                </Link>
                <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{supplier.short_description}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                  <span>{supplier.categories.slice(0, 2).join(' · ')}</span>
                  <span className="text-line">|</span>
                  <span>{supplier.cities.slice(0, 2).join(', ')}</span>
                </div>
              </div>
            </div>
          </div>

          <ScoreBadge score={score} compact />
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-sand/50 px-2.5 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-soft/75">
              Сумма заказа от
            </dt>
            <dd className="mt-0.5 font-medium text-ink">{supplier.min_order ?? '—'}</dd>
          </div>
          <div className="rounded-lg bg-sand/50 px-2.5 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-soft/75">Срок доставки</dt>
            <dd className="mt-0.5 font-medium text-ink">{formatLeadDays(supplier)}</dd>
          </div>
          <div className="rounded-lg bg-sand/50 px-2.5 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-soft/75">Тип доставки</dt>
            <dd className="mt-0.5 font-medium leading-snug text-ink">
              {(supplier.delivery_types ?? []).length
                ? (supplier.delivery_types ?? []).map((t) => (
                    <span key={t} className="block">
                      {deliveryTypeLabel(t)}
                    </span>
                  ))
                : '—'}
            </dd>
          </div>
          <div className="rounded-lg bg-sand/50 px-2.5 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-soft/75">Документы</dt>
            <dd className="mt-0.5 truncate font-medium text-ink">
              {supplier.certificates.length
                ? supplier.certificates.slice(0, 2).join(', ')
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={href} className="btn-primary h-9 min-w-[7.5rem] justify-center">
            Карточка
          </Link>
          {compareDisabled ? (
            <span title="В сравнении уже 3 поставщика" className="inline-flex cursor-default">
              <button
                type="button"
                disabled
                className="btn-ghost h-9 min-w-[7.5rem] justify-center disabled:!cursor-default pointer-events-none"
              >
                Сравнить
              </button>
            </span>
          ) : (
            <button
              type="button"
              data-active={inCompare}
              onClick={() => onToggleCompare(supplier.id)}
              className="btn-ghost h-9 min-w-[7.5rem] justify-center"
            >
              {inCompare ? 'В сравнении' : 'Сравнить'}
            </button>
          )}
          <button
            type="button"
            data-active={inShortlist}
            onClick={() =>
              onToggleShortlist(supplier.id, supplier.name, supplier.categories, supplier.regions)
            }
            className="btn-ghost h-9 min-w-[7.5rem] justify-center"
          >
            {inShortlist ? 'В шортлисте' : 'Шортлист'}
          </button>
        </div>
      </div>
    </article>
  )
}
