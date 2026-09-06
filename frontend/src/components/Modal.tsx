import { useEffect, type PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'

type Props = PropsWithChildren<{
  open: boolean
  title: string
  onClose: () => void
  wide?: boolean
}>

export function Modal({ open, title, onClose, wide = false, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 max-h-[min(88vh,40rem)] w-full overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_-24px_rgb(15_23_42_/_0.35)] sm:p-6 ${
          wide ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="modal-title" className="font-display text-xl text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-ink-soft transition hover:bg-sand hover:text-ink"
          >
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
