export type Contacts = {
  phone: string | null
  email: string | null
  website: string | null
}

export type DeliveryType = 'pickup' | 'own_transport' | 'transport_company'

export const DELIVERY_TYPE_OPTIONS: { value: DeliveryType; label: string }[] = [
  { value: 'pickup', label: 'Самовывоз' },
  { value: 'own_transport', label: 'Транспортом поставщика' },
  { value: 'transport_company', label: 'До транспортной компании' },
]

export function deliveryTypeLabel(value: DeliveryType): string {
  return DELIVERY_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function formatDeliveryTypes(types: DeliveryType[] | undefined | null): string {
  if (!types?.length) return '—'
  return types.map(deliveryTypeLabel).join(', ')
}

/** Срок доставки; для чистого самовывоза — прочерк. */
export function formatLeadDays(supplier: {
  lead_time_days: number
  delivery_types?: DeliveryType[] | null
}): string {
  const pickupOnly =
    supplier.delivery_types?.length === 1 && supplier.delivery_types[0] === 'pickup'
  if (pickupOnly || supplier.lead_time_days <= 0) return '—'
  return `~${supplier.lead_time_days} дн.`
}

export type Supplier = {
  id: string
  name: string
  short_description: string
  categories: string[]
  cities: string[]
  regions: string[]
  contacts: Contacts
  source: string
  min_order: string | null
  min_order_amount: number | null
  price_hint: string | null
  certificates: string[]
  delivery: string | null
  /** Самовывоз / транспортом поставщика / до ТК */
  delivery_types: DeliveryType[]
  notes_default: string | null
  tags: string[]
  lead_time_days: number
  verified: boolean
  last_updated: string | null
  source_url: string | null
}

export type DataQuality = {
  completeness: number
  freshness_days: number | null
  verified: boolean
  missing_fields: string[]
  label: string
}

export type ScoreCriterion = {
  key: string
  label: string
  points: number
  max_points: number
  comment: string
}

export type ScoreBreakdown = {
  total: number
  relevance: number
  fit: number
  criteria: ScoreCriterion[]
  explanation: string[]
}

export type SupplierMatch = {
  supplier: Supplier
  score: ScoreBreakdown
  data_quality: DataQuality
}

export type Priorities = {
  speed: number
  reliability: number
  low_moq: number
}

export type ParsedQuery = {
  category: string | null
  city: string | null
  region: string | null
  max_moq: number | null
  max_lead_days: number | null
  require_certificates: boolean
  has_delivery: boolean
  delivery_type: DeliveryType | null
  keywords: string | null
  priorities: Priorities
  interpretation: string
  engine: 'rules' | 'llm'
}

export type SearchResponse = {
  total: number
  items: SupplierMatch[]
  categories: string[]
  cities: string[]
  regions: string[]
  max_lead_days: number
}

export type CompareResponse = {
  items: SupplierMatch[]
  recommendation_id: string | null
  recommendation_reason: string | null
  highlights: string[]
}

export type OutreachResponse = {
  subject: string
  body: string
  channel_hint: string
}

export type SearchParams = {
  q?: string
  category?: string
  cities?: string[]
  regions?: string[]
  max_moq?: number
  min_lead_days?: number
  max_lead_days?: number
  /** Самовывоз | транспортом поставщика | до ТК */
  delivery_type?: DeliveryType
  has_delivery?: boolean
  require_certificates?: boolean
}

export const DEFAULT_PRIORITIES: Priorities = {
  speed: 1,
  reliability: 1,
  low_moq: 1,
}

/** Минимальный срок доставки на слайдере (дни). */
export const LEAD_DAYS_MIN = 1

/** Fallback, пока meta ещё не пришла с бэка. */
export const LEAD_DAYS_MAX_FALLBACK = 14

/** Срок доставки активен для любого типа, кроме самовывоза. */
export function leadDaysEnabled(deliveryType?: DeliveryType) {
  return deliveryType !== 'pickup'
}
