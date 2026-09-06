import type { ReactNode } from 'react'
import { Modal } from './Modal'

type Props = {
  open: boolean
  onClose: () => void
}

type Section = {
  title: string
  body: ReactNode
}

const SECTIONS: Section[] = [
  {
    title: 'Поиск',
    body: 'Запрос текстом или фильтрами: категория, город, регион работы, минимальная сумма, тип доставки и срок. Фильтры отсекают неподходящих; оставшихся ранжирует оценка соответствия.',
  },
  {
    title: 'Сравнение',
    body: 'До трёх поставщиков из выдачи. Таблица по полям и блок «с кем лучше связаться» — по той же оценке, что и в поиске, с учётом вашего последнего запроса. Рекомендуем того, кто совпал с городом/регионом и типом доставки, если они были выбраны.',
  },
  {
    title: 'Шортлист',
    body: 'Личная воронка: статусы, заметки, фильтры по статусу и региону. Всё хранится локально в браузере.',
  },
  {
    title: 'Оценка соответствия',
    body: (
      <div className="space-y-3">
        <p>
          Фильтры сначала отбирают список. Оценка от 0 до 100 расставляет уже отобранных.
          Баллы по пунктам всегда складываются в 100: чем меньше пунктов участвует, тем больше
          достаётся каждому.
        </p>
        <div>
          <p className="mb-1.5 font-medium text-ink">
            Если выставили в фильтрах — считаем жёстко (совпало или ноль)
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Категория</li>
            <li>Город / регион</li>
            <li>Тип доставки</li>
          </ul>
        </div>
        <div>
          <p className="mb-1.5 font-medium text-ink">Считаем всегда</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Срок доставки</li>
            <li>Минимальная сумма заказа</li>
            <li>Документы (указаны или нет)</li>
          </ul>
        </div>
        <div>
          <p className="mb-1.5 font-medium text-ink">
            Сколько примерно баллов максимум, если выставили фильтры
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Категория + город/регион + тип доставки → по ~22 на каждый и по ~11 на срок, сумму и документы</li>
            <li>Любые два из этих трёх → по ~29 на каждый фильтр и по ~14 на остальные</li>
            <li>Только один → 40 на него и по 20 на срок, сумму и документы</li>
            <li>Ни одного → по ~33 на срок, сумму и документы</li>
          </ul>
        </div>
        <p>Цена в оценку не входит. Нажмите на оценку у карточки — увидите разбор.</p>
      </div>
    ),
  },
]

export function HelpModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Как это работает" wide>
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
            <div className="mt-1 text-sm leading-relaxed text-ink-soft">{section.body}</div>
          </section>
        ))}
      </div>
    </Modal>
  )
}
