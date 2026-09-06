import { useState, type MouseEvent, type PropsWithChildren } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { searchHref } from '../searchParams'
import { loadSearchContext } from '../storage'
import { HelpModal } from './HelpModal'

type Props = {
  compareCount: number
  shortlistCount: number
}

function Counter({ value }: { value: number }) {
  if (!value) return null
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/90 px-1.5 text-[11px] font-semibold text-white">
      {value}
    </span>
  )
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `relative rounded-2xl px-3.5 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-mint text-ink shadow-[inset_0_0_0_1px_rgb(99_102_241_/_0.2)]'
      : 'text-ink-soft hover:bg-sand hover:text-ink'
  }`

export function Layout({
  children,
  compareCount,
  shortlistCount,
}: PropsWithChildren<Props>) {
  const [helpOpen, setHelpOpen] = useState(false)
  const navigate = useNavigate()

  const goSearch = (e: MouseEvent) => {
    e.preventDefault()
    navigate(searchHref(loadSearchContext()))
  }

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <header className="sticky top-0 z-30 w-full border-b border-line/60 bg-paper/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" onClick={goSearch} className="min-w-0 transition hover:opacity-80">
            <p className="font-brand text-[1.3rem] font-bold leading-none text-ink sm:text-[1.45rem]">
              Match Supplier
            </p>
            <p className="mt-1.5 text-[10px] font-medium lowercase tracking-[0.14em] text-ink-soft">
              поиск поставщиков
            </p>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <nav className="flex items-center gap-0.5 rounded-2xl bg-white/70 p-1 ring-1 ring-line/60">
              <NavLink to="/" className={navClass} end onClick={goSearch}>
                Поиск
              </NavLink>
              <NavLink to="/compare" className={navClass}>
                Сравнение
                <Counter value={compareCount} />
              </NavLink>
              <NavLink to="/shortlist" className={navClass}>
                Шортлист
                <Counter value={shortlistCount} />
              </NavLink>
            </nav>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="shrink-0 rounded-2xl px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink"
            >
              Справка
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 fade-up sm:px-6">
        {children}
      </main>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
