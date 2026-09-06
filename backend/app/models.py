"""Pydantic-модели каталога, оценки, поиска, сравнения и outreach."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class Contacts(BaseModel):
    phone: str | None = None
    email: str | None = None
    website: str | None = None


class Supplier(BaseModel):
    """Профиль поставщика из демо-каталога (или будущего фида)."""

    id: str
    name: str
    short_description: str
    categories: list[str]
    cities: list[str]
    regions: list[str]
    contacts: Contacts
    source: str
    min_order: str | None = None
    min_order_amount: int | None = None
    price_hint: str | None = None  # только отображение, не входит в score
    certificates: list[str] = Field(default_factory=list)
    delivery: str | None = None
    delivery_types: list[str] = Field(
        default_factory=list,
        description="pickup | own_transport | transport_company",
    )
    notes_default: str | None = None
    tags: list[str] = Field(default_factory=list)

    lead_time_days: int = Field(3, ge=0, description="Типичный срок поставки, дни")

    verified: bool = False
    last_updated: date | None = None
    source_url: str | None = None


class DataQuality(BaseModel):
    """Насколько профилю можно доверять: полнота, свежесть, верификация."""

    completeness: int = Field(..., ge=0, le=100, description="Полнота профиля, %")
    freshness_days: int | None = Field(None, description="Сколько дней назад обновлён")
    verified: bool
    missing_fields: list[str] = Field(default_factory=list)
    label: str


class Priorities(BaseModel):
    """Множители soft-критериев для API (0–3). В UI ползунков нет, по умолчанию 1."""

    speed: int = Field(1, ge=0, le=3)
    reliability: int = Field(1, ge=0, le=3)
    low_moq: int = Field(1, ge=0, le=3)


class ScoreCriterion(BaseModel):
    """Один пункт разбора оценки."""

    key: str
    label: str
    points: float
    max_points: float
    comment: str


class ScoreBreakdown(BaseModel):
    """Итог оценки: total 0–100, пункты и текстовые пояснения."""

    total: int
    relevance: float  # вклад категории / гео / типа доставки
    fit: float  # вклад срока, суммы, документов
    criteria: list[ScoreCriterion]
    explanation: list[str]


class SupplierMatch(BaseModel):
    """Поставщик с оценкой и качеством данных под запрос."""

    supplier: Supplier
    score: ScoreBreakdown
    data_quality: DataQuality


class ParsedQuery(BaseModel):
    """Результат разбора свободного текста в фильтры (и опционально приоритеты)."""

    category: str | None = None
    city: str | None = None
    region: str | None = None
    max_moq: int | None = None
    max_lead_days: int | None = None
    require_certificates: bool = False
    has_delivery: bool = False
    delivery_type: str | None = Field(
        None,
        description="pickup | own_transport | transport_company",
    )
    keywords: str | None = None
    priorities: Priorities = Field(default_factory=Priorities)
    interpretation: str
    engine: str = Field("rules", description="rules или llm")


class SearchResponse(BaseModel):
    total: int
    items: list[SupplierMatch]
    categories: list[str]
    cities: list[str]
    regions: list[str]
    max_lead_days: int = 14


class CompareResponse(BaseModel):
    """Сравнение до 3 поставщиков + id и текст рекомендации."""

    items: list[SupplierMatch]
    recommendation_id: str | None = None
    recommendation_reason: str | None = None
    highlights: list[str] = Field(default_factory=list)


class OutreachResponse(BaseModel):
    """Тема и тело первого письма поставщику."""

    subject: str
    body: str
    channel_hint: str
