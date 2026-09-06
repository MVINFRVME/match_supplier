import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fetchOutreach, fetchSupplier } from '../api'
import { ProfileGapsPanel } from '../components/DataQualityBadge'
import { ScoreBadge, ScoreDetails } from '../components/ScoreBadge'
import {
  COMPARE_LIMIT,
  findShortlistEntry,
  loadCompareIds,
  toggleCompareId,
  toggleShortlist,
  updateShortlist,
} from '../storage'
import type { OutreachResponse, SearchParams, SupplierMatch } from '../types'
import { formatDeliveryTypes, formatLeadDays } from '../types'
import { usePriorities } from '../usePriorities'

function splitList(sp: URLSearchParams, key: string): string[] | undefined {
  const values = sp
    .getAll(key)
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
  return values.length ? values : undefined
}

export function SupplierPage({ onChange }: { onChange: () => void }) {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const [priorities] = usePriorities()
  const [item, setItem] = useState<SupplierMatch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [inCompare, setInCompare] = useState(false)
  const [compareFull, setCompareFull] = useState(false)
  const [inShortlist, setInShortlist] = useState(false)
  const [outreach, setOutreach] = useState<OutreachResponse | null>(null)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [copied, setCopied] = useState(false)

  const filters: SearchParams = {
    q: searchParams.get('q') || undefined,
    category: searchParams.get('category') || undefined,
    cities: splitList(searchParams, 'city'),
    regions: splitList(searchParams, 'region'),
    max_moq: searchParams.get('max_moq') ? Number(searchParams.get('max_moq')) : undefined,
    min_lead_days: searchParams.get('min_lead_days')
      ? Number(searchParams.get('min_lead_days'))
      : undefined,
    max_lead_days: searchParams.get('max_lead_days')
      ? Number(searchParams.get('max_lead_days'))
      : undefined,
  }

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetchSupplier(id, filters, priorities)
      .then((res) => {
        if (cancelled) return
        setItem(res)
        const entry = findShortlistEntry(id)
        setNote(entry?.note ?? res.supplier.notes_default ?? '')
        setInShortlist(Boolean(entry))
        const ids = loadCompareIds()
        setInCompare(ids.includes(id))
        setCompareFull(ids.length >= COMPARE_LIMIT)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [id, searchParams, priorities])

  if (error) {
    return (
      <p className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm text-accent">
        {error}
      </p>
    )
  }

  if (!item) return <p className="text-ink-soft">Загрузка карточки…</p>

  const { supplier, score, data_quality } = item

  const buildOutreach = async () => {
    const res = await fetchOutreach(supplier.id, {
      category: filters.category ?? supplier.categories[0],
      city: filters.cities?.[0] ?? supplier.cities[0],
    })
    setOutreach(res)
    setDraftSubject(res.subject)
    setDraftBody(res.body)
    setCopied(false)
  }

  const mailtoHref =
    supplier.contacts.email && draftSubject
      ? `mailto:${supplier.contacts.email}?subject=${encodeURIComponent(draftSubject)}&body=${encodeURIComponent(draftBody)}`
      : null

  const saveNote = () => {
    if (!inShortlist) {
      toggleShortlist(supplier.id, supplier.name, note, supplier.categories, supplier.regions)
      setInShortlist(true)
    } else {
      updateShortlist(supplier.id, { note })
    }
    setSaved(true)
    onChange()
  }

  return (
    <div className="space-y-5">
      <Link
        to={`/${searchParams.toString() ? `?${searchParams}` : ''}`}
        className="text-sm text-leaf hover:underline"
      >
        ← К результатам
      </Link>

      <section className="surface rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl text-leaf-deep sm:text-4xl">{supplier.name}</h1>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-ink-soft sm:text-[15px]">
              {supplier.short_description}
            </p>
          </div>
          <ScoreBadge score={score} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {supplier.categories.map((c) => (
            <span key={c} className="chip bg-mint/80 text-leaf-deep">
              {c}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => void buildOutreach()} className="btn-primary">
            Подготовить запрос
          </button>
          <button
            type="button"
            data-active={inShortlist}
            onClick={() => {
              const next = toggleShortlist(
                supplier.id,
                supplier.name,
                note,
                supplier.categories,
                supplier.regions,
              )
              setInShortlist(next.some((e) => e.id === supplier.id))
              onChange()
            }}
            className="btn-ghost"
          >
            {inShortlist ? 'В шортлисте' : 'В шортлист'}
          </button>
          {!inCompare && compareFull ? (
            <span title="В сравнении уже 3 поставщика" className="inline-flex cursor-default">
              <button
                type="button"
                disabled
                className="btn-ghost disabled:!cursor-default pointer-events-none"
              >
                Сравнить
              </button>
            </span>
          ) : (
            <button
              type="button"
              data-active={inCompare}
              onClick={() => {
                const next = toggleCompareId(supplier.id)
                setInCompare(next.includes(supplier.id))
                setCompareFull(next.length >= COMPARE_LIMIT)
                onChange()
              }}
              className="btn-ghost"
            >
              {inCompare ? 'В сравнении' : 'Сравнить'}
            </button>
          )}
        </div>
      </section>

      {outreach ? (
        <section className="overflow-hidden rounded-2xl border border-line/60 bg-gradient-to-br from-mint/60 via-white to-sand/40 p-5 shadow-[0_14px_36px_-24px_rgb(44_46_51_/_0.14)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl text-leaf-deep">Готовый запрос</h2>
            <span className="text-xs text-ink-soft">{outreach.channel_hint}</span>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Готовый шаблон письма. Вы можете отредактировать его или отправить как есть
          </p>

          <label className="mt-4 block">
            <span className="field-label">Тема</span>
            <input
              className="field field-control"
              value={draftSubject}
              onChange={(e) => {
                setDraftSubject(e.target.value)
                setCopied(false)
              }}
            />
          </label>

          <label className="mt-3 block">
            <span className="field-label">Текст письма</span>
            <textarea
              className="field mt-0 min-h-56 font-sans text-sm leading-relaxed"
              value={draftBody}
              onChange={(e) => {
                setDraftBody(e.target.value)
                setCopied(false)
              }}
              rows={14}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {mailtoHref ? (
              <a href={mailtoHref} className="btn-primary">
                Отправить по почте
              </a>
            ) : (
              <button type="button" className="btn-primary" disabled title="У поставщика нет email">
                Отправить по почте
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(`${draftSubject}\n\n${draftBody}`)
                setCopied(true)
              }}
              className="btn-ghost"
            >
              {copied ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3.5 text-emerald-500"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Скопировано
                </span>
              ) : (
                'Скопировать'
              )}
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface rounded-2xl p-5">
          <h2 className="font-display text-xl text-leaf-deep">Ключевая информация</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink-soft">Города</dt>
              <dd>{supplier.cities.join(', ')}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Регионы работы</dt>
              <dd>{supplier.regions.join(', ')}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Минимальная сумма заказа</dt>
              <dd>{supplier.min_order ?? 'не указана'}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Цена</dt>
              <dd>{supplier.price_hint ?? 'не указана'}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Срок доставки</dt>
              <dd>{formatLeadDays(supplier)}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Тип доставки</dt>
              <dd>{formatDeliveryTypes(supplier.delivery_types)}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Условия доставки</dt>
              <dd>{supplier.delivery ?? 'не указаны'}</dd>
            </div>
            <div>
              <dt className="text-ink-soft">Документы и сертификаты</dt>
              <dd>
                {supplier.certificates.length ? supplier.certificates.join(', ') : 'не указаны'}
              </dd>
            </div>
          </dl>

          <h3 className="mt-6 font-display text-lg text-leaf-deep">Контакты</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Телефон: {supplier.contacts.phone ?? '—'}</li>
            <li>Email: {supplier.contacts.email ?? '—'}</li>
            <li>
              Сайт:{' '}
              {supplier.contacts.website ? (
                <a
                  className="text-leaf underline-offset-2 hover:underline"
                  href={supplier.contacts.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {supplier.contacts.website}
                </a>
              ) : (
                '—'
              )}
            </li>
          </ul>
        </section>

        <div className="space-y-4">
          <ScoreDetails score={score} />
          <ProfileGapsPanel quality={data_quality} supplier={supplier} />
        </div>
      </div>

      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-xl text-leaf-deep">Заметки</h2>
        <p className="mt-1 text-sm text-ink-soft">Сохраняются в шортлисте</p>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setSaved(false)
          }}
          rows={4}
          className="field mt-3"
          placeholder="Перезвонить в среду, спросить про отсрочку…"
        />
        <button type="button" onClick={saveNote} className="btn-primary mt-3">
          Сохранить
        </button>
        {saved ? <span className="ml-3 text-sm text-leaf">Сохранено</span> : null}
      </section>
    </div>
  )
}
