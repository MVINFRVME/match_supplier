"""Разбор запроса, введённого обычным текстом, в структурированные фильтры.

Всегда работает на правилах. Если задан GROQ_API_KEY, сначала пробуем LLM
и валидируем его ответ теми же справочниками — модель не может выдумать
несуществующий город или категорию.
"""

from __future__ import annotations

import json
import os
import re

from .models import ParsedQuery, Priorities

CATEGORY_HINTS: dict[str, str] = {
    "молок": "Молочные продукты",
    "молоч": "Молочные продукты",
    "сыр": "Молочные продукты",
    "сливк": "Молочные продукты",
    "кефир": "Молочные продукты",
    "творог": "Молочные продукты",
    "упаковк": "Упаковка",
    "пакет": "Упаковка",
    "контейнер": "Упаковка",
    "этикетк": "Упаковка",
    "мясо": "Мясо и птица",
    "мясн": "Мясо и птица",
    "куриц": "Мясо и птица",
    "фарш": "Мясо и птица",
    "рыб": "Рыба и морепродукты",
    "морепродукт": "Рыба и морепродукты",
    "кофе": "Чай и кофе",
    "чай": "Чай и кофе",
    "какао": "Чай и кофе",
    "заморозк": "Заморозка",
    "заморожен": "Заморозка",
    "овощ": "Овощи и фрукты",
    "фрукт": "Овощи и фрукты",
    "зелен": "Овощи и фрукты",
    "ягод": "Овощи и фрукты",
    "соус": "Соусы",
    "кетчуп": "Соусы",
    "майонез": "Соусы",
    "напитк": "Напитки",
    "вода": "Напитки",
    "сок": "Напитки",
    "снек": "Снеки",
    "чипс": "Снеки",
    "орех": "Снеки",
    "конфет": "Кондитерские изделия",
    "шоколад": "Кондитерские изделия",
    "кондитер": "Кондитерские изделия",
    "мука": "Ингредиенты",
    "специ": "Ингредиенты",
    "масло": "Ингредиенты",
    "ингредиент": "Ингредиенты",
    "бакале": "Бакалея",
    "круп": "Бакалея",
    "хорек": "HoReCa",
    "horeca": "HoReCa",
    "ресторан": "HoReCa",
    "кафе": "HoReCa",
    "кофейн": "HoReCa",
    "готов": "Готовая продукция",
    "кулинар": "Готовая продукция",
}

SPEED_WORDS = ("срочно", "быстр", "завтра", "сегодня", "оперативн", "день в день", "скорост")
RELIABILITY_WORDS = ("надёжн", "надежн", "проверен", "сертифик", "хассп", "документ", "качеств")
SMALL_BATCH_WORDS = ("небольш", "маленьк", "малый объ", "мелкий опт", "小", "стартуем", "пробн")

DELIVERY_WORDS = ("доставк", "привоз", "привезт", "логистик")
CERT_WORDS = ("сертифик", "хассп", "haccp", "документ", "деклараци")

PICKUP_WORDS = ("самовывоз", "само вывоз", "заберём сами", "заберем сами", "заберу сам")
TRANSPORT_COMPANY_WORDS = (
    " до тк",
    "до тк ",
    "до тк,",
    "до тк.",
    "транспортн компан",
    "транспортной компан",
    "транспортная компан",
    "через тк",
    "отправк тк",
    "отправка тк",
)
OWN_TRANSPORT_WORDS = (
    "своим транспорт",
    "транспорт поставщик",
    "транспортом поставщик",
    "своей логистик",
    "своим авто",
)

# Разговорные сокращения городов.
CITY_ALIASES: dict[str, str] = {
    "спб": "Санкт-Петербург",
    "питер": "Санкт-Петербург",
    "петербург": "Санкт-Петербург",
    "мск": "Москва",
    "екб": "Екатеринбург",
    "нижний": "Нижний Новгород",
    "ростов": "Ростов-на-Дону",
    "новосиб": "Новосибирск",
}


def _find_delivery_type(text: str) -> str | None:
    """Тип доставки из свободного текста."""
    lowered = f" {text.lower()} "
    if any(w in lowered for w in PICKUP_WORDS):
        return "pickup"
    if any(w in lowered for w in TRANSPORT_COMPANY_WORDS) or re.search(
        r"(?:^|[\s,.;])тк(?:[\s,.;]|$)", lowered
    ):
        return "transport_company"
    if any(w in lowered for w in OWN_TRANSPORT_WORDS):
        return "own_transport"
    if any(w in lowered for w in DELIVERY_WORDS):
        return "own_transport"
    return None


def _find_from_list(text: str, options: list[str], use_aliases: bool = False) -> str | None:
    """Ищем город/регион по словарю, учитывая падежные окончания и сокращения."""
    lowered = text.lower()
    best: str | None = None

    if use_aliases:
        for alias, city in CITY_ALIASES.items():
            if alias in lowered and city in options:
                return city

    for option in options:
        opt = option.lower()
        if opt in lowered:
            if best is None or len(option) > len(best):
                best = option
            continue
        # «в Москве» → основа «москв»
        stem = opt[:-1] if len(opt) > 4 else opt
        if stem and stem in lowered:
            if best is None or len(option) > len(best):
                best = option
    return best


def _find_category(text: str, known: list[str]) -> str | None:
    lowered = text.lower()
    for option in known:
        if option.lower() in lowered:
            return option
    for hint, category in CATEGORY_HINTS.items():
        if hint in lowered and category in known:
            return category
    return None


def _find_budget(text: str) -> int | None:
    lowered = text.lower().replace("\u00a0", " ")

    match = re.search(
        r"(?:минимальн\w*\s+сумм\w*\s+заказ\w*|мин\.?\s*сумм\w*|моq|"
        r"до|не более|максимум|бюджет|лимит)\s*([\d\s]{2,12})\s*(к|тыс|₽|руб)?",
        lowered,
    )
    if match:
        raw = match.group(1).replace(" ", "")
        if raw.isdigit():
            value = int(raw)
            if match.group(2) in {"к", "тыс"}:
                value *= 1000
            if value > 0:
                return value

    match = re.search(r"(?:до|бюджет|лимит)\s*(\d+)\s*к\b", lowered)
    if match:
        return int(match.group(1)) * 1000

    return None


def _find_lead_days(text: str) -> int | None:
    lowered = text.lower().replace("\u00a0", " ")
    match = re.search(
        r"(?:срок(?:ом)?|доставк\w*|привоз\w*)\s*(?:до\s*)?(\d+)\s*(?:дн|день|дня|дней)",
        lowered,
    )
    if match:
        days = int(match.group(1))
        return days if days > 0 else None
    match = re.search(r"за\s+(\d+)\s*(?:дн|день|дня|дней)", lowered)
    if match:
        days = int(match.group(1))
        return days if days > 0 else None
    return None


def _detect_priorities(text: str) -> Priorities:
    """Поднимает API-веса soft-критериев, если в тексте есть явные маркеры важности."""
    lowered = text.lower()

    def level(words: tuple[str, ...]) -> int:
        return 3 if any(w in lowered for w in words) else 1

    return Priorities(
        speed=level(SPEED_WORDS),
        reliability=level(RELIABILITY_WORDS),
        low_moq=level(SMALL_BATCH_WORDS),
    )


def parse_with_rules(
    text: str,
    *,
    categories: list[str],
    cities: list[str],
    regions: list[str],
) -> ParsedQuery:
    """Детерминированный разбор по справочникам и ключевым словам."""
    lowered = text.lower()

    category = _find_category(text, categories)
    city = _find_from_list(text, cities, use_aliases=True)
    region = None if city else _find_from_list(text, regions)
    max_moq = _find_budget(text)
    max_lead_days = _find_lead_days(text)
    require_certificates = any(w in lowered for w in CERT_WORDS)
    delivery_type = _find_delivery_type(text)
    has_delivery = delivery_type in {"own_transport", "transport_company"}
    priorities = _detect_priorities(text)

    parts: list[str] = []
    parts.append(f"категория «{category}»" if category else "категория не распознана")
    if city:
        parts.append(f"город {city}")
    elif region:
        parts.append(f"регион работы {region}")
    if max_moq:
        parts.append(f"сумма заказа до {max_moq:,} ₽".replace(",", " "))
    if max_lead_days:
        parts.append(f"срок доставки до {max_lead_days} дн.")
    if require_certificates:
        parts.append("нужны документы")
    if delivery_type == "pickup":
        parts.append("самовывоз")
    elif delivery_type == "transport_company":
        parts.append("доставка до ТК")
    elif delivery_type == "own_transport":
        parts.append("транспортом поставщика")

    return ParsedQuery(
        category=category,
        city=city,
        region=region,
        max_moq=max_moq,
        max_lead_days=max_lead_days,
        require_certificates=require_certificates,
        has_delivery=has_delivery,
        delivery_type=delivery_type,
        keywords=text.strip() or None,
        priorities=priorities,
        interpretation="Понял так: " + ", ".join(parts),
        engine="rules",
    )


LLM_SYSTEM_PROMPT = """Ты помощник закупщика продуктов питания.
Разбери запрос пользователя и верни СТРОГО JSON без пояснений:
{{
  "category": строка или null,
  "city": строка или null,
  "region": строка или null,
  "max_moq": число в рублях или null,
  "max_lead_days": число дней или null,
  "require_certificates": true/false,
  "has_delivery": true/false,
  "delivery_type": "pickup" | "own_transport" | "transport_company" | null,
  "priorities": {{"speed": 0-3, "reliability": 0-3, "low_moq": 0-3}},
  "interpretation": короткая фраза на русском, как ты понял запрос
}}
category выбирай ТОЛЬКО из списка: {categories}
city выбирай ТОЛЬКО из списка: {cities}
region выбирай ТОЛЬКО из списка: {regions}
delivery_type: pickup — самовывоз; own_transport — транспортом поставщика; transport_company — до ТК.
Если подходящего значения в списке нет — ставь null.
priorities: 3 — критично для пользователя, 1 — обычная важность, 0 — не важно."""


def parse_with_llm(
    text: str,
    *,
    categories: list[str],
    cities: list[str],
    regions: list[str],
) -> ParsedQuery | None:
    """Разбор через Groq. Возвращает None, если ключа нет или запрос не удался."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None

    try:
        import httpx
    except ImportError:
        return None

    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    try:
        prompt = LLM_SYSTEM_PROMPT.format(
            categories=", ".join(categories),
            cities=", ".join(cities),
            regions=", ".join(regions),
        )
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text},
                ],
            },
            timeout=12.0,
        )
        response.raise_for_status()
        payload = json.loads(response.json()["choices"][0]["message"]["content"])
    except Exception:
        return None

    # Доверяем модели только то, что подтверждается справочниками.
    def pick(value: object, options: list[str]) -> str | None:
        if isinstance(value, str):
            for option in options:
                if option.lower() == value.strip().lower():
                    return option
        return None

    raw_priorities = payload.get("priorities") or {}
    try:
        priorities = Priorities(
            speed=int(raw_priorities.get("speed", 1)),
            reliability=int(raw_priorities.get("reliability", 1)),
            low_moq=int(raw_priorities.get("low_moq", 1)),
        )
    except (TypeError, ValueError):
        priorities = Priorities()

    max_moq = payload.get("max_moq")
    if not isinstance(max_moq, int) or max_moq <= 0:
        max_moq = None

    max_lead_days = payload.get("max_lead_days")
    if not isinstance(max_lead_days, int) or max_lead_days <= 0:
        max_lead_days = None

    interpretation = payload.get("interpretation")
    if not isinstance(interpretation, str) or not interpretation.strip():
        interpretation = "Запрос разобран моделью"

    delivery_raw = payload.get("delivery_type")
    delivery_type = None
    if isinstance(delivery_raw, str) and delivery_raw in {
        "pickup",
        "own_transport",
        "transport_company",
    }:
        delivery_type = delivery_raw
    else:
        delivery_type = _find_delivery_type(text)

    has_delivery = bool(payload.get("has_delivery")) or delivery_type in {
        "own_transport",
        "transport_company",
    }
    if delivery_type == "pickup":
        has_delivery = False

    return ParsedQuery(
        category=pick(payload.get("category"), categories),
        city=pick(payload.get("city"), cities),
        region=pick(payload.get("region"), regions),
        max_moq=max_moq,
        max_lead_days=max_lead_days,
        require_certificates=bool(payload.get("require_certificates")),
        has_delivery=has_delivery,
        delivery_type=delivery_type,
        keywords=text.strip() or None,
        priorities=priorities,
        interpretation=interpretation.strip(),
        engine="llm",
    )


def parse_query(
    text: str,
    *,
    categories: list[str],
    cities: list[str],
    regions: list[str],
) -> ParsedQuery:
    """Сначала LLM (если есть ключ), иначе правила. LLM без распознанной гео/категории — откат."""
    llm_result = parse_with_llm(text, categories=categories, cities=cities, regions=regions)
    if llm_result and (llm_result.category or llm_result.city or llm_result.region):
        return llm_result
    return parse_with_rules(text, categories=categories, cities=cities, regions=regions)
