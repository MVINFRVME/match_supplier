import type { DataQuality, Supplier } from '../types'

/** Источник и пробелы профиля — без «верификации» (её нет в ТЗ). */
export function ProfileGapsPanel({
  quality,
  supplier,
}: {
  quality: DataQuality
  supplier: Supplier
}) {
  const hasGaps = quality.missing_fields.length > 0

  return (
    <div className="surface relative z-0 rounded-xl p-4">
      <p className="text-sm font-semibold text-leaf-deep">Источник</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">Откуда данные</dt>
          <dd className="text-right">{supplier.source}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">Обновлено</dt>
          <dd className="text-right">{supplier.last_updated ?? '—'}</dd>
        </div>
      </dl>

      {hasGaps ? (
        <p className="mt-3 rounded-lg bg-sand/70 px-3 py-2 text-xs text-ink-soft">
          Не указаны: {quality.missing_fields.join(', ')}. Это попадёт в текст запроса
          поставщику.
        </p>
      ) : null}
    </div>
  )
}
