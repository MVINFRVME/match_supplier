import { useEffect, useId, useMemo, useRef, useState } from 'react'

type Props = {
  label: string
  hint?: string
  options: string[]
  selected: string[]
  placeholder?: string
  onToggle: (value: string) => void
  onClear: () => void
}

function matchesQuery(option: string, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return option.toLowerCase().includes(q)
}

export function MultiSelectDropdown({
  label,
  hint,
  options,
  selected,
  placeholder = 'Не выбрано',
  onToggle,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        inputRef.current?.blur()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const matched = options.filter((option) => matchesQuery(option, query))
    if (!query.trim()) {
      const selectedFirst = selected.filter((s) => options.includes(s))
      const rest = matched.filter((o) => !selected.includes(o))
      return [...selectedFirst, ...rest]
    }
    return matched
  }, [options, query, selected])

  const summary =
    selected.length === 0
      ? ''
      : selected.length === 1
        ? selected[0]
        : `Выбрано: ${selected.length}`

  const inputValue = open || query ? query : summary

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="field-label mb-0">{label}</span>
        {hint ? <span className="text-[11px] text-ink-soft/80">{hint}</span> : null}
      </div>

      <div
        className={`field field-control flex w-full items-center gap-2 ${
          selected.length ? 'border-leaf/25' : ''
        } ${open ? 'border-accent/40 ring-[3px] ring-accent/12' : ''}`}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          placeholder={placeholder}
          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink-soft/55 ${
            !open && selected.length > 0 ? 'text-ink' : 'text-ink'
          }`}
          autoComplete="off"
        />
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
              setQuery('')
              inputRef.current?.focus()
            }}
            className="shrink-0 text-[11px] text-ink-soft hover:text-ink"
          >
            сбросить
          </button>
        ) : null}
        <svg
          viewBox="0 0 16 16"
          className={`size-4 shrink-0 text-ink-soft transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          aria-hidden
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_16px_40px_-18px_rgb(15_23_42_/_0.16)]"
        >
          <ul className="max-h-56 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-ink-soft">Список ещё загружается</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-ink-soft">Ничего не найдено</li>
            ) : (
              filtered.map((option) => {
                const checked = selected.includes(option)
                return (
                  <li key={option} role="option" aria-selected={checked}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-mint/35">
                      <input
                        type="checkbox"
                        className="size-4 accent-accent"
                        checked={checked}
                        onChange={() => onToggle(option)}
                      />
                      <span>{option}</span>
                    </label>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
