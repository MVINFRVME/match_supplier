import type { DeliveryType, SearchParams } from './types'

function splitList(sp: URLSearchParams, key: string): string[] | undefined {
  const values = sp
    .getAll(key)
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
  return values.length ? values : undefined
}

export function paramsFromUrl(sp: URLSearchParams): SearchParams {
  const deliveryType = sp.get('delivery_type')
  const validType =
    deliveryType === 'pickup' ||
    deliveryType === 'own_transport' ||
    deliveryType === 'transport_company'
      ? (deliveryType as DeliveryType)
      : undefined

  return {
    q: sp.get('q') || undefined,
    category: sp.get('category') || undefined,
    cities: splitList(sp, 'city'),
    regions: splitList(sp, 'region'),
    max_moq: sp.get('max_moq') ? Number(sp.get('max_moq')) : undefined,
    min_lead_days: sp.get('min_lead_days') ? Number(sp.get('min_lead_days')) : undefined,
    max_lead_days: sp.get('max_lead_days') ? Number(sp.get('max_lead_days')) : undefined,
    delivery_type: validType,
    has_delivery: sp.get('has_delivery') === '1' || sp.get('has_delivery') === 'true',
    require_certificates:
      sp.get('require_certificates') === '1' || sp.get('require_certificates') === 'true',
  }
}

export function toUrl(params: SearchParams) {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.category) sp.set('category', params.category)
  for (const city of params.cities ?? []) sp.append('city', city)
  for (const region of params.regions ?? []) sp.append('region', region)
  if (params.max_moq != null) sp.set('max_moq', String(params.max_moq))
  if (params.delivery_type !== 'pickup') {
    if (params.min_lead_days != null) sp.set('min_lead_days', String(params.min_lead_days))
    if (params.max_lead_days != null) sp.set('max_lead_days', String(params.max_lead_days))
  }
  if (params.delivery_type) sp.set('delivery_type', params.delivery_type)
  if (params.has_delivery) sp.set('has_delivery', '1')
  if (params.require_certificates) sp.set('require_certificates', '1')
  return sp
}

export function hasSearchFilters(params: SearchParams): boolean {
  return Boolean(
    params.q ||
      params.category ||
      params.cities?.length ||
      params.regions?.length ||
      params.max_moq != null ||
      params.min_lead_days != null ||
      params.max_lead_days != null ||
      params.delivery_type ||
      params.has_delivery ||
      params.require_certificates,
  )
}

/** Путь на поиск с последними фильтрами. */
export function searchHref(params: SearchParams): string {
  const qs = toUrl(params).toString()
  return qs ? `/?${qs}` : '/'
}
