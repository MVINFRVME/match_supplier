"""Проставляет delivery_types по тексту delivery / tags / описанию."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "suppliers.json"

ORDER = ("pickup", "own_transport", "transport_company")


def _has_tk(text: str) -> bool:
    return bool(re.search(r"(?<![а-яё])тк(?![а-яё])", text)) or "транспортн" in text


def infer_types(supplier: dict) -> list[str]:
    delivery = (supplier.get("delivery") or "").lower()
    desc = (supplier.get("short_description") or "").lower()
    tags = " ".join(supplier.get("tags") or []).lower()
    blob = f"{delivery} {desc} {tags}"

    pickup_only = any(
        x in blob
        for x in (
            "только самовывоз",
            "без доставки",
            "самовывоз со склада",
            "самовывоз с сыроварни",
        )
    ) and not any(
        x in delivery
        for x in ("или", "тк", "курьер", "транспорт", "рейс", "доставк", "логистик")
    )
    # Явный pickup-only: «без доставки» или описание «только самовывоз»
    if "без доставки" in delivery or "только самовывоз" in desc:
        pickup_only = True

    has_pickup = "самовывоз" in blob
    has_tk = _has_tk(blob)
    has_own = any(
        k in blob
        for k in (
            "своя логистик",
            "своей логистик",
            "свой транспорт",
            "своим транспорт",
            "курьер",
            "рейс",
            "рефрижератор",
            "холодов",
            "паллет",
            "слот",
            "маршрут",
            "отгрузк",
            "отправк",
            "дистрибуц",
            "цистерн",
            "термокороб",
            "объединённая доставк",
            "объединенная доставк",
        )
    ) or (
        "доставк" in delivery
        and "самовывоз" not in delivery.replace("самовывоз или", "").replace(
            "самовывоз,", ""
        )
    )

    # «Доставка …» без самовывоза → свой транспорт
    if "доставк" in delivery and not has_pickup:
        has_own = True
    if "логистик" in delivery and not has_pickup:
        has_own = True

    types: list[str] = []
    if pickup_only:
        return ["pickup"]

    if has_pickup:
        types.append("pickup")
    if has_own:
        types.append("own_transport")
    if has_tk:
        types.append("transport_company")

    # Самовывоз + «или ТК / курьер / объединённая доставка»
    if has_pickup and "или" in delivery:
        if has_tk and "own_transport" not in types and "курьер" not in delivery:
            pass
        if "курьер" in delivery or "объединённ" in delivery or "объединенн" in delivery:
            if "own_transport" not in types:
                types.append("own_transport")

    if not types and delivery:
        types = ["own_transport"]

    # Уникальные, в стабильном порядке
    return [t for t in ORDER if t in set(types)]


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    for supplier in data:
        types = infer_types(supplier)
        supplier["delivery_types"] = types
        print(f"{supplier['name']}: {types}")

    DATA.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\nUpdated {len(data)} suppliers → {DATA}")


if __name__ == "__main__":
    main()
