"""Фильтрация каталога и ранжирование по оценке соответствия."""

from __future__ import annotations

from .models import Priorities, Supplier, SupplierMatch
from .quality import assess
from .query_parser import CATEGORY_HINTS
from .score import (
    is_delivery_supplier,
    is_pickup_supplier,
    matches_delivery_type,
    score_supplier,
)


def hinted_category(q: str | None, known: list[str]) -> str | None:
    """Угадывает категорию по подстрокам в свободном тексте запроса."""
    if not q:
        return None
    lowered = q.lower()
    for hint, category in CATEGORY_HINTS.items():
        if hint in lowered and category in known:
            return category
    return None


def matches_query(supplier: Supplier, needle: str, hinted: str | None) -> bool:
    """Совпадение по имени, описанию, тегам, категориям или подсказанной категории."""
    if (
        needle in supplier.name.lower()
        or needle in supplier.short_description.lower()
        or any(needle in t.lower() for t in supplier.tags)
        or any(needle in c.lower() for c in supplier.categories)
    ):
        return True
    if hinted:
        return any(hinted.lower() == c.lower() for c in supplier.categories)
    return False


def _as_list(value: list[str] | str | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    return [v.strip() for v in value if v and v.strip()]


def passes_lead_days(
    supplier: Supplier,
    *,
    delivery_type: str | None,
    min_lead_days: int | None,
    max_lead_days: int | None,
) -> bool:
    """Срок доставки не применяется к самовывозу.

    - тип «самовывоз» → срок игнорируем;
    - тип «любой» → самовывоз всегда проходит, остальные режем по диапазону дней;
    - свой транспорт / ТК → диапазон на всех оставшихся.
    """
    if min_lead_days is None and max_lead_days is None:
        return True
    if delivery_type == "pickup":
        return True
    if delivery_type is None and is_pickup_supplier(supplier):
        return True
    if min_lead_days is not None and supplier.lead_time_days < min_lead_days:
        return False
    if max_lead_days is not None and supplier.lead_time_days > max_lead_days:
        return False
    return True


def filter_suppliers(
    suppliers: list[Supplier],
    *,
    q: str | None = None,
    category: str | None = None,
    city: list[str] | str | None = None,
    region: list[str] | str | None = None,
    max_moq: int | None = None,
    min_lead_days: int | None = None,
    max_lead_days: int | None = None,
    has_delivery: bool | None = None,
    delivery_type: str | None = None,
    require_certificates: bool = False,
    all_categories: list[str] | None = None,
) -> list[Supplier]:
    """Жёсткие фильтры выдачи: текст, категория, гео, сумма, тип доставки, срок, документы."""
    result = suppliers
    cities = _as_list(city)
    regions = _as_list(region)

    if q:
        needle = q.lower().strip()
        hinted = hinted_category(needle, all_categories or [])
        result = [s for s in result if matches_query(s, needle, hinted)]

    if category:
        result = [s for s in result if any(category.lower() == c.lower() for c in s.categories)]

    if cities:
        lowered = {c.lower() for c in cities}
        result = [s for s in result if any(c.lower() in lowered for c in s.cities)]

    if regions:
        lowered = {r.lower() for r in regions}
        result = [s for s in result if any(r.lower() in lowered for r in s.regions)]

    if max_moq is not None:
        result = [
            s for s in result if s.min_order_amount is None or s.min_order_amount <= max_moq
        ]

    # «Любой» (delivery_type пустой) — не режем самовывоз.
    # has_delivery без типа — устаревший флаг «нужна доставка», самовывоз убираем.
    if delivery_type:
        result = [s for s in result if matches_delivery_type(s, delivery_type)]
    elif has_delivery is True:
        result = [s for s in result if is_delivery_supplier(s)]

    result = [
        s
        for s in result
        if passes_lead_days(
            s,
            delivery_type=delivery_type,
            min_lead_days=min_lead_days,
            max_lead_days=max_lead_days,
        )
    ]

    if require_certificates:
        result = [s for s in result if len(s.certificates) > 0]

    return result


def build_match(
    supplier: Supplier,
    *,
    category: str | None,
    city: list[str] | str | None,
    region: list[str] | str | None,
    max_moq: int | None,
    min_lead_days: int | None = None,
    max_lead_days: int | None = None,
    delivery_type: str | None = None,
    priorities: Priorities | None = None,
) -> SupplierMatch:
    """Карточка с оценкой и качеством данных под текущий запрос."""
    return SupplierMatch(
        supplier=supplier,
        score=score_supplier(
            supplier,
            category=category,
            city=city,
            region=region,
            max_moq=max_moq,
            min_lead_days=min_lead_days,
            max_lead_days=max_lead_days,
            delivery_type=delivery_type,
            priorities=priorities,
        ),
        data_quality=assess(supplier),
    )


def rank_suppliers(
    suppliers: list[Supplier],
    *,
    q: str | None = None,
    category: str | None = None,
    city: list[str] | str | None = None,
    region: list[str] | str | None = None,
    max_moq: int | None = None,
    min_lead_days: int | None = None,
    max_lead_days: int | None = None,
    delivery_type: str | None = None,
    priorities: Priorities | None = None,
    all_categories: list[str] | None = None,
) -> list[SupplierMatch]:
    """Считает score по отфильтрованным и сортирует: выше балл, ниже MOQ, имя."""
    effective_category = category or hinted_category(q, all_categories or [])
    matches = [
        build_match(
            s,
            category=effective_category,
            city=city,
            region=region,
            max_moq=max_moq,
            min_lead_days=min_lead_days,
            max_lead_days=max_lead_days,
            delivery_type=delivery_type,
            priorities=priorities,
        )
        for s in suppliers
    ]
    matches.sort(
        key=lambda m: (
            -m.score.total,
            m.supplier.min_order_amount or 10**9,
            m.supplier.name,
        )
    )
    return matches
