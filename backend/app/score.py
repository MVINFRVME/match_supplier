"""Оценка соответствия поставщика запросу (0–100).

Фильтры категории, географии и типа доставки дают баллы только если
выставлены в запросе (совпало — полный вклад, нет — 0). Срок, сумма заказа
и документы участвуют всегда. Цена в оценку не входит.
"""

from __future__ import annotations

import re

from .models import Priorities, ScoreBreakdown, ScoreCriterion, Supplier


def _fmt(amount: int) -> str:
    return f"{amount:,}".replace(",", " ")


def _clamp_priority(value: int) -> int:
    return max(0, min(3, int(value)))


def _as_list(value: list[str] | str | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    return [v for v in value if v and str(v).strip()]


def _is_pickup_only(supplier: Supplier) -> bool:
    types = [t.lower() for t in supplier.delivery_types]
    return types == ["pickup"]


def _geo_quality(
    supplier: Supplier,
    city: str | list[str] | None,
    region: str | list[str] | None,
) -> tuple[float, str] | None:
    """Качество географии: только если город/регион заданы; иначе критерий пропускаем."""
    cities = _as_list(city)
    regions = _as_list(region)
    if not cities and not regions:
        return None

    city_ok = True
    region_ok = True
    if cities:
        wanted = {c.lower() for c in cities}
        city_ok = any(c.lower() in wanted for c in supplier.cities)
    if regions:
        wanted = {r.lower() for r in regions}
        region_ok = any(r.lower() in wanted for r in supplier.regions)

    bits: list[str] = []
    if cities:
        bits.append(", ".join(cities))
    if regions:
        bits.append(", ".join(regions))
    label = " / ".join(bits)

    if city_ok and region_ok:
        return 1.0, f"совпадает с запросом ({label})"
    return 0.0, f"не совпадает с запросом ({label})"


def matches_geo(
    supplier: Supplier,
    city: str | list[str] | None,
    region: str | list[str] | None,
) -> bool:
    """Совпадает ли поставщик с гео из запроса; если гео не задана — True."""
    result = _geo_quality(supplier, city, region)
    if result is None:
        return True
    return result[0] >= 1.0


DELIVERY_TYPE_LABELS = {
    "pickup": "самовывоз",
    "own_transport": "транспортом поставщика",
    "transport_company": "до транспортной компании",
}


def matches_delivery_type(supplier: Supplier, delivery_type: str) -> bool:
    """Есть ли у поставщика нужный тип доставки."""
    known = {t.lower() for t in supplier.delivery_types}
    if known:
        return delivery_type in known

    text = (supplier.delivery or "").lower()
    if not text:
        return False
    if delivery_type == "pickup":
        return "самовывоз" in text
    if delivery_type == "transport_company":
        return "тк" in text.split() or "тк," in text or "тк." in text or "транспортн" in text
    if delivery_type == "own_transport":
        own_keys = (
            "доставк",
            "логистик",
            "рефрижератор",
            "рейс",
            "сво",
            "паллет",
            "слот",
            "холодов",
            "цистерн",
            "курьер",
            "маршрут",
            "отправк",
            "отгрузк",
        )
        return any(k in text for k in own_keys)
    return True


def is_pickup_supplier(supplier: Supplier) -> bool:
    return matches_delivery_type(supplier, "pickup")


def is_delivery_supplier(supplier: Supplier) -> bool:
    if supplier.delivery_types:
        return any(
            t in {"own_transport", "transport_company"} for t in supplier.delivery_types
        )
    if not supplier.delivery:
        return False
    return matches_delivery_type(supplier, "own_transport") or matches_delivery_type(
        supplier, "transport_company"
    )


def _delivery_quality(
    supplier: Supplier, delivery_type: str | None
) -> tuple[float, str] | None:
    """Качество типа доставки: только если тип задан в запросе."""
    if not delivery_type:
        return None
    label = DELIVERY_TYPE_LABELS.get(delivery_type, delivery_type)
    if matches_delivery_type(supplier, delivery_type):
        return 1.0, f"есть «{label}»"
    return 0.0, f"нет «{label}»"


def _speed_quality(
    supplier: Supplier,
    min_lead_days: int | None,
    max_lead_days: int | None,
) -> tuple[float, str]:
    """Качество срока: полный балл для чистого самовывоза; иначе по дням/диапазону."""
    if _is_pickup_only(supplier) or supplier.lead_time_days <= 0:
        return 1.0, "самовывоз"

    days = supplier.lead_time_days
    if min_lead_days is not None or max_lead_days is not None:
        lo = min_lead_days if min_lead_days is not None else 0
        hi = max_lead_days if max_lead_days is not None else 10**9
        if lo <= days <= hi:
            if min_lead_days is not None and max_lead_days is not None:
                span = f"{min_lead_days}–{max_lead_days}"
            elif max_lead_days is not None:
                span = f"до {max_lead_days}"
            else:
                span = f"от {min_lead_days}"
            return 1.0, f"~{days} дн. (в диапазоне {span} дн.)"
        # Жёсткий промах по сроку — почти ноль, а не «чуть хуже».
        return 0.0, f"~{days} дн. (вне диапазона)"
    # Без фильтра: чем быстрее, тем лучше (1–2 дн. ≈ топ).
    quality = max(0.2, min(1.0, 1.2 - 0.12 * days))
    return quality, f"~{days} дн."


def _docs_quality(supplier: Supplier) -> tuple[float, str]:
    """Документы бинарно: есть / нет. Число сертификатов не влияет."""
    if supplier.certificates:
        return 1.0, "есть"
    return 0.15, "не указаны"


def _moq_quality(supplier: Supplier, max_moq: int | None) -> tuple[float, str]:
    """Качество минимальной суммы: ниже — лучше; выше лимита запроса — 0."""
    amount = supplier.min_order_amount
    if amount is None:
        return 0.45, "не указана"

    if max_moq is not None:
        if amount <= max_moq:
            return 1.0, f"от {_fmt(amount)} ₽ (в пределах {_fmt(max_moq)} ₽)"
        return 0.0, f"от {_fmt(amount)} ₽ (выше лимита {_fmt(max_moq)} ₽)"

    quality = max(0.15, min(1.0, 1.1 - amount / 60000))
    return quality, f"от {_fmt(amount)} ₽"


def score_supplier(
    supplier: Supplier,
    *,
    category: str | None = None,
    city: str | list[str] | None = None,
    region: str | list[str] | None = None,
    max_moq: int | None = None,
    min_lead_days: int | None = None,
    max_lead_days: int | None = None,
    delivery_type: str | None = None,
    priorities: Priorities | None = None,
) -> ScoreBreakdown:
    """Оценка 0–100: сумма баллов по критериям после нормировки весов.

    Если выставлены в запросе — категория / гео / тип доставки (база 40 каждый,
    совпало = полный вклад, нет = 0). Всегда — срок, сумма заказа, документы
    (база 20 × приоритет API, по умолчанию 1). Невыставленный фильтр не
    участвует, его доля уходит остальным пунктам.
    """
    pri = priorities or Priorities()
    explanation: list[str] = []
    criteria: list[ScoreCriterion] = []

    parts: list[tuple[str, str, float, float, str]] = []
    # (key, label, weight, quality 0..1, comment)

    if category:
        if any(category.lower() == c.lower() for c in supplier.categories):
            parts.append(
                ("category", "Категория", 40.0, 1.0, f"есть категория «{category}»")
            )
        else:
            parts.append(
                ("category", "Категория", 40.0, 0.0, f"нет категории «{category}»")
            )

    geo = _geo_quality(supplier, city, region)
    if geo is not None:
        geo_q, geo_c = geo
        parts.append(("geo", "География", 40.0, geo_q, geo_c))

    delivery = _delivery_quality(supplier, delivery_type)
    if delivery is not None:
        del_q, del_c = delivery
        parts.append(("delivery", "Тип доставки", 40.0, del_q, del_c))

    p_speed = max(1, _clamp_priority(pri.speed))
    p_moq = max(1, _clamp_priority(pri.low_moq))
    p_rel = max(1, _clamp_priority(pri.reliability))

    speed_q, speed_c = _speed_quality(supplier, min_lead_days, max_lead_days)
    moq_q, moq_c = _moq_quality(supplier, max_moq)
    docs_q, docs_c = _docs_quality(supplier)

    parts.append(("speed", "Срок доставки", 20.0 * p_speed, speed_q, speed_c))
    parts.append(("moq", "Минимальная сумма заказа", 20.0 * p_moq, moq_q, moq_c))
    parts.append(("docs", "Документы", 20.0 * p_rel, docs_q, docs_c))

    weight_sum = sum(p[2] for p in parts)
    if weight_sum <= 0:
        weight_sum = 1.0

    relevance = 0.0
    fit = 0.0
    total_raw = 0.0

    for key, label, weight, quality, comment in parts:
        max_points = 100.0 * weight / weight_sum
        points = max_points * quality
        total_raw += points
        if key in {"category", "geo", "delivery"}:
            relevance += points
        else:
            fit += points
        criteria.append(
            ScoreCriterion(
                key=key,
                label=label,
                points=round(points, 1),
                max_points=round(max_points, 1),
                comment=comment,
            )
        )
        explanation.append(f"{label}: {comment} — {points:.0f} из {max_points:.0f}")

    total = int(round(total_raw))
    return ScoreBreakdown(
        total=total,
        relevance=round(relevance, 1),
        fit=round(fit, 1),
        criteria=criteria,
        explanation=explanation,
    )


def recommendation_fit_reasons(
    supplier: Supplier,
    *,
    category: str | None = None,
    city: str | list[str] | None = None,
    region: str | list[str] | None = None,
    delivery_type: str | None = None,
) -> list[str]:
    """Короткие плюсы по категории/гео/типу доставки для блока рекомендации."""
    lines: list[str] = []
    if category and any(category.lower() == c.lower() for c in supplier.categories):
        lines.append(f"Есть нужная категория «{category}».")

    cities = _as_list(city)
    regions = _as_list(region)
    if (cities or regions) and matches_geo(supplier, city, region):
        bits: list[str] = []
        if cities:
            bits.append(", ".join(cities))
        if regions:
            bits.append(", ".join(regions))
        lines.append(f"Совпадает с географией запроса ({' / '.join(bits)}).")

    if delivery_type and matches_delivery_type(supplier, delivery_type):
        label = DELIVERY_TYPE_LABELS.get(delivery_type, delivery_type)
        lines.append(f"Есть «{label}».")

    return lines


def recommendation_snippets(
    explanation: list[str],
    limit: int = 2,
    *,
    skip_lead_time: bool = False,
) -> list[str]:
    """Убирает нейтральные формулировки и хвост «N из M» из текста рекомендации.

    Совпадения по категории/гео/типу доставки уже даёт recommendation_fit_reasons.
    """
    skip = (
        "не указана",
        "не указан",
        "категория в запросе не указана",
        "не совпадает",
        "нет «",
        "нет категории",
    )
    skip_prefixes = ["категория:", "география:", "тип доставки:"]
    if skip_lead_time:
        skip_prefixes.append("срок доставки:")
    useful: list[str] = []
    for line in explanation:
        lowered = line.lower()
        if any(s in lowered for s in skip):
            continue
        if any(lowered.startswith(p) for p in skip_prefixes):
            continue
        cleaned = re.sub(r"\s*—\s*\d+(?:[.,]\d+)?\s+из\s+\d+(?:[.,]\d+)?\s*$", "", line).strip()
        if cleaned:
            useful.append(cleaned)
    return useful[:limit]
