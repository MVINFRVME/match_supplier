import { DEFAULT_PRIORITIES, type Priorities, type SearchParams } from './types'

const COMPARE_KEY = 'match-supplier-compare'
const SHORTLIST_KEY = 'match-supplier-shortlist'
const PRIORITIES_KEY = 'match-supplier-priorities'
const RECENT_SEARCHES_KEY = 'match-supplier-recent-searches'
const SEARCH_CONTEXT_KEY = 'match-supplier-search-context'
const RECENT_LIMIT = 6

export type ShortlistStatus = 'new' | 'contacted' | 'waiting' | 'rejected'

export type ShortlistEntry = {
  id: string
  name: string
  categories: string[]
  regions: string[]
  status: ShortlistStatus
  note: string
  addedAt: string
}

export const STATUS_LABELS: Record<ShortlistStatus, string> = {
  new: 'В работе',
  contacted: 'Связались',
  waiting: 'Ждём прайс',
  rejected: 'Не подошёл',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

/* --- Недавние поисковые запросы --- */

export function loadRecentSearches(): string[] {
  const raw = read<string[]>(RECENT_SEARCHES_KEY, [])
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string' && x.trim()) : []
}

export function pushRecentSearch(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return loadRecentSearches()
  const next = [trimmed, ...loadRecentSearches().filter((x) => x !== trimmed)].slice(
    0,
    RECENT_LIMIT,
  )
  write(RECENT_SEARCHES_KEY, next)
  return next
}

export function removeRecentSearch(text: string): string[] {
  const next = loadRecentSearches().filter((x) => x !== text)
  write(RECENT_SEARCHES_KEY, next)
  return next
}

/* --- Приоритеты закупщика --- */

export function loadPriorities(): Priorities {
  const stored = read<Partial<Priorities>>(PRIORITIES_KEY, {})
  return {
    speed: stored.speed ?? DEFAULT_PRIORITIES.speed,
    reliability: stored.reliability ?? DEFAULT_PRIORITIES.reliability,
    low_moq: stored.low_moq ?? DEFAULT_PRIORITIES.low_moq,
  }
}

export function savePriorities(priorities: Priorities) {
  write(PRIORITIES_KEY, priorities)
}

/** Последний применённый поиск — для оценки в сравнении и карточках. */
export function saveSearchContext(params: SearchParams) {
  write(SEARCH_CONTEXT_KEY, params)
}

export function loadSearchContext(): SearchParams {
  const stored = read<Partial<SearchParams>>(SEARCH_CONTEXT_KEY, {})
  return {
    q: stored.q || undefined,
    category: stored.category || undefined,
    cities: Array.isArray(stored.cities) ? stored.cities : undefined,
    regions: Array.isArray(stored.regions) ? stored.regions : undefined,
    max_moq: typeof stored.max_moq === 'number' ? stored.max_moq : undefined,
    min_lead_days: typeof stored.min_lead_days === 'number' ? stored.min_lead_days : undefined,
    max_lead_days: typeof stored.max_lead_days === 'number' ? stored.max_lead_days : undefined,
    delivery_type: stored.delivery_type,
    has_delivery: Boolean(stored.has_delivery),
    require_certificates: Boolean(stored.require_certificates),
  }
}

/* --- Сравнение (до 3) --- */

export const COMPARE_LIMIT = 3

export function loadCompareIds(): string[] {
  const raw = read<string[]>(COMPARE_KEY, [])
  return Array.isArray(raw) ? raw.slice(0, COMPARE_LIMIT) : []
}

export function saveCompareIds(ids: string[]) {
  write(COMPARE_KEY, ids.slice(0, COMPARE_LIMIT))
}

export function toggleCompareId(id: string): string[] {
  const current = loadCompareIds()
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : current.length >= COMPARE_LIMIT
      ? current
      : [...current, id]
  saveCompareIds(next)
  return next
}

/* --- Шортлист с воронкой и заметками --- */

export function loadShortlist(): ShortlistEntry[] {
  const raw = read<ShortlistEntry[]>(SHORTLIST_KEY, [])
  if (!Array.isArray(raw)) return []
  return raw.map((e) => ({
    ...e,
    categories: Array.isArray(e.categories) ? e.categories : [],
    regions: Array.isArray(e.regions) ? e.regions : [],
    note: typeof e.note === 'string' ? e.note : '',
  }))
}

function saveShortlist(entries: ShortlistEntry[]) {
  write(SHORTLIST_KEY, entries)
}

export function isInShortlist(id: string): boolean {
  return loadShortlist().some((e) => e.id === id)
}

export function findShortlistEntry(id: string): ShortlistEntry | undefined {
  return loadShortlist().find((e) => e.id === id)
}

export function toggleShortlist(
  id: string,
  name: string,
  note = '',
  categories: string[] = [],
  regions: string[] = [],
): ShortlistEntry[] {
  const current = loadShortlist()
  const next = current.some((e) => e.id === id)
    ? current.filter((e) => e.id !== id)
    : [
        ...current,
        {
          id,
          name,
          categories,
          regions,
          status: 'new' as ShortlistStatus,
          note,
          addedAt: new Date().toISOString(),
        },
      ]
  saveShortlist(next)
  return next
}

export function updateShortlist(id: string, patch: Partial<ShortlistEntry>): ShortlistEntry[] {
  const next = loadShortlist().map((e) => (e.id === id ? { ...e, ...patch } : e))
  saveShortlist(next)
  return next
}
