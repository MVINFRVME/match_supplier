import type {
  CompareResponse,
  OutreachResponse,
  ParsedQuery,
  Priorities,
  SearchParams,
  SearchResponse,
  SupplierMatch,
} from './types'

export type MetaResponse = {
  categories: string[]
  cities: string[]
  regions: string[]
  max_lead_days: number
}

function toQuery(params: SearchParams & { ids?: string }, priorities?: Priorities) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.category) qs.set('category', params.category)
  for (const city of params.cities ?? []) qs.append('city', city)
  for (const region of params.regions ?? []) qs.append('region', region)
  if (params.max_moq != null) qs.set('max_moq', String(params.max_moq))
  if (params.delivery_type !== 'pickup') {
    if (params.min_lead_days != null) qs.set('min_lead_days', String(params.min_lead_days))
    if (params.max_lead_days != null) qs.set('max_lead_days', String(params.max_lead_days))
  }
  if (params.delivery_type) qs.set('delivery_type', params.delivery_type)
  if (params.has_delivery) qs.set('has_delivery', 'true')
  if (params.require_certificates) qs.set('require_certificates', 'true')
  if (params.ids) qs.set('ids', params.ids)

  if (priorities) {
    qs.set('p_speed', String(priorities.speed))
    qs.set('p_reliability', String(priorities.reliability))
    qs.set('p_low_moq', String(priorities.low_moq))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Ошибка запроса: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchMeta() {
  return request<MetaResponse>('/api/meta')
}

export function fetchSuppliers(params: SearchParams, priorities?: Priorities) {
  return request<SearchResponse>(`/api/suppliers${toQuery(params, priorities)}`)
}

export function fetchSupplier(id: string, params: SearchParams = {}, priorities?: Priorities) {
  return request<SupplierMatch>(`/api/suppliers/${id}${toQuery(params, priorities)}`)
}

export function fetchCompare(ids: string[], params: SearchParams = {}, priorities?: Priorities) {
  return request<CompareResponse>(
    `/api/compare${toQuery({ ...params, ids: ids.join(',') }, priorities)}`,
  )
}

export function parseQuery(text: string) {
  return request<ParsedQuery>('/api/parse-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export function fetchOutreach(
  id: string,
  payload: { category?: string; city?: string; volume?: string },
) {
  return request<OutreachResponse>(`/api/suppliers/${id}/outreach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
