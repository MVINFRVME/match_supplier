import { useState } from 'react'
import type { ScoreBreakdown } from '../types'
import { Modal } from './Modal'

/** Короткое пояснение для демо. */
export function ScoreMethodCopy() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
      <p>
        Фильтры сначала <span className="font-medium text-ink">отбирают</span> список.
        Оценка от 0 до 100 расставляет уже отобранных. Баллы всегда складываются в 100: не
        выставили фильтр — его доля уходит в остальные пункты.
      </p>

      <div>
        <p className="mb-1 font-medium text-ink">
          Если выставили в фильтрах — совпало или ноль
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Категория</li>
          <li>Город / регион</li>
          <li>Тип доставки</li>
        </ul>
      </div>

      <div>
        <p className="mb-1 font-medium text-ink">Считаем всегда</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Срок доставки (при самовывозе срок не важен — полный балл)</li>
          <li>Минимальная сумма заказа</li>
          <li>Документы — указаны или нет</li>
        </ul>
      </div>

      <div>
        <p className="mb-1 font-medium text-ink">Сколько примерно максимум баллов</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Выставили все три фильтра (категория, гео, тип доставки) → по ~22 на каждый и по
            ~11 на срок, сумму и документы
          </li>
          <li>Выставили два → по ~29 на каждый фильтр и по ~14 на остальные</li>
          <li>Выставили один → 40 на него и по 20 на срок, сумму и документы</li>
          <li>Не выставили ни одного → по ~33 на срок, сумму и документы</li>
        </ul>
      </div>

      <p>Цена в оценку не входит.</p>
    </div>
  )
}

export function ScoreBars({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="space-y-2.5">
      {score.criteria.map((criterion) => {
        const pct = criterion.max_points
          ? Math.round((criterion.points / criterion.max_points) * 100)
          : 0
        return (
          <div key={criterion.key}>
            <div className="mb-0.5 flex justify-between gap-3 text-xs">
              <span className="text-ink">{criterion.label}</span>
              <span className="tabular-nums text-ink-soft">
                {criterion.points.toFixed(0)} из {criterion.max_points.toFixed(0)}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-accent/45 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">{criterion.comment}</p>
          </div>
        )
      })}
    </div>
  )
}

export function ScoreExplainModal({
  open,
  onClose,
  score,
}: {
  open: boolean
  onClose: () => void
  score: ScoreBreakdown
}) {
  return (
    <Modal open={open} onClose={onClose} title="Разбор оценки" wide>
      <p className="text-sm text-ink">
        Итого <span className="font-semibold tabular-nums">{score.total} из 100</span>
      </p>
      <p className="mt-1 text-xs text-ink-soft">
        Категория: {score.relevance.toFixed(0)} · условия поставки: {score.fit.toFixed(0)} ·
        в скобках — набрали / максимум
      </p>
      <div className="mt-4">
        <ScoreBars score={score} />
      </div>
      <p className="mt-4 text-xs text-ink-soft">Цена в оценку не входит.</p>
    </Modal>
  )
}

export function ScoreBadge({ score, compact = false }: { score: ScoreBreakdown; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const tone =
    score.total >= 75
      ? 'bg-mint text-accent ring-1 ring-accent/25'
      : score.total >= 55
        ? 'bg-sand text-ink ring-1 ring-line'
        : 'bg-sand/70 text-ink-soft ring-1 ring-line'

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        title="Разбор оценки"
        className={`inline-flex shrink-0 flex-col text-left transition hover:opacity-80 ${
          compact ? 'w-[5rem] items-start' : 'items-start'
        }`}
      >
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-ink-soft">
          <span className="block">Оценка</span>
          <span className="block">соответствия</span>
        </span>
        <span
          className={`mt-1.5 inline-flex h-7 min-w-[3.5rem] items-center justify-center rounded-full px-2.5 text-sm font-semibold tabular-nums leading-none ${tone}`}
        >
          {score.total}
          <span className="ml-0.5 text-[10px] font-medium opacity-70">/100</span>
        </span>
      </button>
      <ScoreExplainModal open={open} onClose={() => setOpen(false)} score={score} />
    </>
  )
}

export function ScoreDetails({ score }: { score: ScoreBreakdown }) {
  return (
    <div className="surface relative z-20 overflow-visible rounded-xl p-4">
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold text-ink">Почему такая оценка</p>
        <div className="group relative z-30 shrink-0">
          <button
            type="button"
            tabIndex={0}
            className="flex size-5 cursor-help items-center justify-center rounded-full border border-line bg-white text-[11px] font-semibold text-ink-soft transition group-hover:border-accent/40 group-hover:text-accent group-focus-within:border-accent/40 group-focus-within:text-accent"
            aria-describedby="score-method-hint"
            aria-label="Как считается оценка"
          >
            i
          </button>
          <div
            id="score-method-hint"
            role="tooltip"
            className="pointer-events-none absolute left-0 z-50 mt-2 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-3 text-xs leading-relaxed text-ink-soft opacity-0 shadow-[0_16px_40px_-12px_rgb(15_23_42_/_0.18)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <p className="font-medium text-ink">Методика расчёта</p>
            <div className="mt-2 [&_ol]:text-xs [&_p]:text-xs">
              <ScoreMethodCopy />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-1 mb-3 text-xs text-ink-soft">
        Итого {score.total} из 100 · категория {score.relevance.toFixed(0)} · условия{' '}
        {score.fit.toFixed(0)}
      </p>
      <ScoreBars score={score} />
    </div>
  )
}
