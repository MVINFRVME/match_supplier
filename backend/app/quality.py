"""Оценка полноты и свежести профиля поставщика."""

from __future__ import annotations

from datetime import date

from .models import DataQuality, Supplier

# Поля, без которых закупщику сложно принять решение.
REQUIRED_FIELDS: list[tuple[str, str]] = [
    ("phone", "телефон"),
    ("email", "email"),
    ("website", "сайт"),
    ("min_order_amount", "минимальный заказ"),
    ("price_hint", "ориентир цены"),
    ("certificates", "сертификаты"),
    ("delivery", "условия доставки"),
]


def assess(supplier: Supplier, today: date | None = None) -> DataQuality:
    """Считает % заполненности, дни с обновления и человекочитаемый label."""
    today = today or date.today()

    values = {
        "phone": supplier.contacts.phone,
        "email": supplier.contacts.email,
        "website": supplier.contacts.website,
        "min_order_amount": supplier.min_order_amount,
        "price_hint": supplier.price_hint,
        "certificates": supplier.certificates or None,
        "delivery": supplier.delivery,
    }

    missing = [label for key, label in REQUIRED_FIELDS if not values[key]]
    filled = len(REQUIRED_FIELDS) - len(missing)
    completeness = round(filled / len(REQUIRED_FIELDS) * 100)

    freshness_days = (today - supplier.last_updated).days if supplier.last_updated else None

    if completeness >= 85 and supplier.verified and (freshness_days or 999) <= 30:
        label = "Данные полные и свежие"
    elif completeness >= 70 and (freshness_days or 999) <= 60:
        label = "Данных достаточно для звонка"
    elif (freshness_days or 0) > 60:
        label = "Данные могли устареть — уточните при контакте"
    else:
        label = "Профиль неполный — уточните недостающее"

    return DataQuality(
        completeness=completeness,
        freshness_days=freshness_days,
        verified=supplier.verified,
        missing_fields=missing,
        label=label,
    )
