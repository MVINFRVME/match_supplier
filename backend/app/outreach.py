"""Готовый текст первого запроса поставщику.

Принцип: не спрашивать то, что уже есть в карточке — подтверждать и
просить только пробелы (цена, оплата, актуальность, недостающие документы).
"""

from __future__ import annotations

from .models import DataQuality, OutreachResponse, Supplier


def _fmt(amount: int) -> str:
    return f"{amount:,}".replace(",", " ")


def build_message(
    supplier: Supplier,
    quality: DataQuality,
    *,
    category: str | None = None,
    city: str | None = None,
    volume: str | None = None,
) -> OutreachResponse:
    """Собирает тему, тело и подсказку канала; известные условия подтверждает, не переспрашивает."""
    subject_topic = category or (supplier.categories[0] if supplier.categories else "поставки")
    subject = f"Запрос коммерческого предложения: {subject_topic}"

    lines = [
        "Здравствуйте, коллеги!",
        "",
        f"Мы подбираем поставщика по направлению «{subject_topic}»"
        + (f" с поставкой в город {city}." if city else "."),
    ]

    if volume:
        lines.append(f"Планируемый объём: {volume}.")

    known: list[str] = []
    if supplier.min_order_amount is not None:
        known.append(f"минимальная сумма заказа от {_fmt(supplier.min_order_amount)} ₽")
    elif supplier.min_order:
        known.append(f"минимальная сумма заказа: {supplier.min_order}")
    if supplier.lead_time_days:
        known.append(f"типичный срок поставки ~{supplier.lead_time_days} дн.")
    if supplier.delivery:
        known.append(f"условия доставки: {supplier.delivery}")
    if supplier.certificates:
        known.append(f"документы: {', '.join(supplier.certificates)}")

    if known:
        lines += ["", "По открытым данным у вас указано:"]
        for item in known:
            lines.append(f"— {item}")
        lines.append("Просим подтвердить, что эти условия актуальны.")

    asks: list[str] = [
        "Актуальный прайс-лист / коммерческое предложение с оптовыми ценами.",
        "Условия оплаты и возможность отсрочки.",
    ]

    if supplier.min_order_amount is None and not supplier.min_order:
        asks.append("Минимальную сумму и партию заказа.")
    if not supplier.delivery:
        asks.append("Сроки и условия доставки.")
    elif quality.freshness_days is not None and quality.freshness_days > 60:
        asks.append("Подтверждение актуальных сроков поставки.")

    if "сертификаты" in quality.missing_fields:
        asks.append("Копии деклараций и сертификатов на продукцию.")
    elif supplier.certificates and (
        quality.freshness_days is not None and quality.freshness_days > 90
    ):
        asks.append("Подтверждение, что указанные сертификаты ещё действуют.")

    lines += ["", "Просим прислать:"]
    for i, ask in enumerate(asks, start=1):
        lines.append(f"{i}. {ask}")

    if quality.freshness_days is not None and quality.freshness_days > 60:
        lines += [
            "",
            "Отдельно просим подтвердить, что контактные данные на сайте актуальны.",
        ]

    lines += [
        "",
        "Готовы обсудить детали в удобное для вас время.",
        "",
        "С уважением,",
        "отдел закупа",
    ]

    if supplier.contacts.email:
        channel_hint = f"Отправить на {supplier.contacts.email}"
    elif supplier.contacts.phone:
        channel_hint = f"Email не указан — позвоните: {supplier.contacts.phone}"
    else:
        channel_hint = "Контакты неполные — уточните канал связи на сайте"

    return OutreachResponse(subject=subject, body="\n".join(lines), channel_hint=channel_hint)
