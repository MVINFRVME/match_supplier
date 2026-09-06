"""HTTP API Match Supplier: поиск, карточка, сравнение, outreach, статика фронта."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .models import (
    CompareResponse,
    OutreachResponse,
    ParsedQuery,
    Priorities,
    SearchResponse,
    Supplier,
    SupplierMatch,
)
from .outreach import build_message
from .quality import assess
from .query_parser import parse_query
from .score import (
    matches_delivery_type,
    matches_geo,
    recommendation_fit_reasons,
    recommendation_snippets,
)
from .search import build_match, filter_suppliers, hinted_category, rank_suppliers

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BACKEND_DIR / "data" / "suppliers.json"
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"

# Ключ Groq можно положить в backend/.env или в .env в корне проекта.
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")

app = FastAPI(
    title="Match Supplier API",
    description=(
        "Поиск и сравнение поставщиков продуктов питания. "
        "Фильтры (категория, география, тип доставки) отсекают выдачу и при "
        "выборе дают баллы в оценке 0–100; срок, сумма заказа и документы "
        "учитываются всегда. Цена в оценку не входит."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_suppliers() -> list[Supplier]:
    """Читает демо-каталог suppliers.json."""
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return [Supplier.model_validate(item) for item in raw]


def meta_lists() -> tuple[list[str], list[str], list[str], int]:
    """Справочники для фильтров и верхняя граница срока доставки по каталогу."""
    suppliers = load_suppliers()
    categories = sorted({c for s in suppliers for c in s.categories})
    cities = sorted({c for s in suppliers for c in s.cities})
    regions = sorted({r for s in suppliers for r in s.regions})
    max_lead = max((s.lead_time_days for s in suppliers if s.lead_time_days > 0), default=14)
    return categories, cities, regions, max(1, max_lead)


def priorities_param(
    p_speed: int = Query(1, ge=0, le=3, description="Важность скорости поставки"),
    p_reliability: int = Query(1, ge=0, le=3, description="Важность документов и надёжности"),
    p_low_moq: int = Query(1, ge=0, le=3, description="Важность низкого минимального заказа"),
) -> Priorities:
    """Веса soft-критериев для API (в UI ползунков нет, по умолчанию все = 1)."""
    return Priorities(speed=p_speed, reliability=p_reliability, low_moq=p_low_moq)


BuyerPriorities = Annotated[Priorities, Depends(priorities_param)]


@app.get("/api/health", tags=["service"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/meta", tags=["service"])
def meta() -> dict[str, list[str] | int]:
    categories, cities, regions, max_lead_days = meta_lists()
    return {
        "categories": categories,
        "cities": cities,
        "regions": regions,
        "max_lead_days": max_lead_days,
    }


class ParseRequest(BaseModel):
    text: str


@app.post("/api/parse-query", response_model=ParsedQuery, tags=["search"])
def parse_free_text(payload: ParseRequest) -> ParsedQuery:
    """Разбирает свободный текст в фильтры (правила, при ключе — Groq с откатом)."""
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Пустой запрос")
    categories, cities, regions, _max_lead = meta_lists()
    return parse_query(payload.text, categories=categories, cities=cities, regions=regions)


def _split_csv(values: list[str] | None) -> list[str] | None:
    if not values:
        return None
    result: list[str] = []
    for value in values:
        result.extend(part.strip() for part in value.split(",") if part.strip())
    return result or None


@app.get("/api/suppliers", response_model=SearchResponse, tags=["search"])
def list_suppliers(
    priorities: BuyerPriorities,
    q: str | None = Query(None, description="Текстовый поиск"),
    category: str | None = None,
    city: list[str] | None = Query(None, description="Города (можно несколько)"),
    region: list[str] | None = Query(None, description="Регионы работы"),
    max_moq: int | None = Query(None, ge=0, description="Макс. минимальная сумма заказа"),
    min_lead_days: int | None = Query(None, ge=0, description="Мин. срок доставки, дни"),
    max_lead_days: int | None = Query(None, ge=0, description="Макс. срок доставки, дни"),
    has_delivery: bool | None = None,
    delivery_type: str | None = Query(
        None,
        description="pickup | own_transport | transport_company",
    ),
    require_certificates: bool = False,
) -> SearchResponse:
    all_suppliers = load_suppliers()
    categories, cities, regions, catalog_max_lead = meta_lists()
    cities_f = _split_csv(city)
    regions_f = _split_csv(region)

    filtered = filter_suppliers(
        all_suppliers,
        q=q,
        category=category,
        city=cities_f,
        region=regions_f,
        max_moq=max_moq,
        min_lead_days=min_lead_days,
        max_lead_days=max_lead_days,
        has_delivery=has_delivery,
        delivery_type=delivery_type,
        require_certificates=require_certificates,
        all_categories=categories,
    )
    ranked = rank_suppliers(
        filtered,
        q=q,
        category=category,
        city=cities_f,
        region=regions_f,
        max_moq=max_moq,
        min_lead_days=min_lead_days,
        max_lead_days=max_lead_days,
        delivery_type=delivery_type,
        priorities=priorities,
        all_categories=categories,
    )
    return SearchResponse(
        total=len(ranked),
        items=ranked,
        categories=categories,
        cities=cities,
        regions=regions,
        max_lead_days=catalog_max_lead,
    )


def _get_supplier(supplier_id: str) -> Supplier:
    supplier = next((s for s in load_suppliers() if s.id == supplier_id), None)
    if not supplier:
        raise HTTPException(status_code=404, detail="Поставщик не найден")
    return supplier


@app.get("/api/suppliers/{supplier_id}", response_model=SupplierMatch, tags=["search"])
def get_supplier(
    supplier_id: str,
    priorities: BuyerPriorities,
    q: str | None = None,
    category: str | None = None,
    city: list[str] | None = Query(None),
    region: list[str] | None = Query(None),
    max_moq: int | None = Query(None, ge=0),
    min_lead_days: int | None = Query(None, ge=0),
    max_lead_days: int | None = Query(None, ge=0),
    delivery_type: str | None = Query(
        None,
        description="pickup | own_transport | transport_company",
    ),
) -> SupplierMatch:
    supplier = _get_supplier(supplier_id)
    categories, _, _, _ = meta_lists()
    return build_match(
        supplier,
        category=category or hinted_category(q, categories),
        city=_split_csv(city),
        region=_split_csv(region),
        max_moq=max_moq,
        min_lead_days=min_lead_days,
        max_lead_days=max_lead_days,
        delivery_type=delivery_type,
        priorities=priorities,
    )


@app.get("/api/compare", response_model=CompareResponse, tags=["compare"])
def compare_suppliers(
    priorities: BuyerPriorities,
    ids: str = Query(..., description="ID через запятую, до 3"),
    category: str | None = None,
    city: list[str] | None = Query(None),
    region: list[str] | None = Query(None),
    max_moq: int | None = Query(None, ge=0),
    min_lead_days: int | None = Query(None, ge=0),
    max_lead_days: int | None = Query(None, ge=0),
    delivery_type: str | None = Query(
        None,
        description="pickup | own_transport | transport_company",
    ),
) -> CompareResponse:
    """Сравнение до 3 id: оценка под контекст поиска и рекомендация с приоритетом гео/типа доставки."""
    id_list = [x.strip() for x in ids.split(",") if x.strip()][:3]
    if not id_list:
        raise HTTPException(status_code=400, detail="Укажите хотя бы один id")

    cities_f = _split_csv(city)
    regions_f = _split_csv(region)
    items = [
        build_match(
            _get_supplier(sid),
            category=category,
            city=cities_f,
            region=regions_f,
            max_moq=max_moq,
            min_lead_days=min_lead_days,
            max_lead_days=max_lead_days,
            delivery_type=delivery_type,
            priorities=priorities,
        )
        for sid in id_list
    ]

    def _fits_request(m: SupplierMatch) -> bool:
        if not matches_geo(m.supplier, cities_f, regions_f):
            return False
        if delivery_type and not matches_delivery_type(m.supplier, delivery_type):
            return False
        return True

    def _rank_key(m: SupplierMatch) -> tuple:
        # Сначала те, кто совпал с гео и типом доставки из запроса.
        miss = 0 if _fits_request(m) else 1
        return (
            miss,
            -m.score.total,
            m.supplier.min_order_amount or 10**9,
            m.supplier.name,
        )

    items.sort(key=_rank_key)

    fitted = [m for m in items if _fits_request(m)]
    best = fitted[0] if fitted else items[0]
    skip_lead = delivery_type == "pickup" or (
        delivery_type is None and best.supplier.delivery_types == ["pickup"]
    )
    reason_parts = [f"Лучшая оценка соответствия {best.score.total}/100."]
    reason_parts.extend(
        recommendation_fit_reasons(
            best.supplier,
            category=category,
            city=cities_f,
            region=regions_f,
            delivery_type=delivery_type,
        )
    )
    reason_parts.extend(
        recommendation_snippets(
            best.score.explanation,
            limit=2,
            skip_lead_time=skip_lead,
        )
    )
    if (cities_f or regions_f or delivery_type) and not fitted:
        reason_parts.append(
            "Никто из сравнения не совпал с гео/типом доставки запроса — "
            "показан лучший по оценке."
        )

    highlights: list[str] = []
    if len(items) > 1:
        if not skip_lead:
            with_lead = [m for m in items if m.supplier.lead_time_days > 0]
            lead_days = {m.supplier.lead_time_days for m in with_lead}
            if len(lead_days) > 1:
                fastest_days = min(lead_days)
                fastest = [
                    m for m in with_lead if m.supplier.lead_time_days == fastest_days
                ]
                names = ", ".join(m.supplier.name for m in fastest)
                highlights.append(
                    f"Быстрее привезёт: {names} (~{fastest_days} дн.)"
                )

        moq_amounts = {
            m.supplier.min_order_amount
            for m in items
            if m.supplier.min_order_amount is not None
        }
        if len(moq_amounts) > 1:
            lowest = min(moq_amounts)
            winners = [
                m for m in items if m.supplier.min_order_amount == lowest
            ]
            names = ", ".join(m.supplier.name for m in winners)
            moq_text = winners[0].supplier.min_order or f"от {lowest} ₽"
            highlights.append(f"Ниже минимальная сумма: {names} ({moq_text})")

        # Цену в подсветках не сравниваем: в price_hint часто разные товары.

        with_docs = [m for m in items if m.supplier.certificates]
        without_docs = [m for m in items if not m.supplier.certificates]
        if with_docs and without_docs:
            names = ", ".join(m.supplier.name for m in with_docs)
            highlights.append(f"Есть документы: {names}")

    reason = "\n".join(reason_parts)

    return CompareResponse(
        items=items,
        recommendation_id=best.supplier.id,
        recommendation_reason=reason,
        highlights=highlights,
    )


class OutreachRequest(BaseModel):
    category: str | None = None
    city: str | None = None
    volume: str | None = None


@app.post(
    "/api/suppliers/{supplier_id}/outreach",
    response_model=OutreachResponse,
    tags=["compare"],
)
def outreach(supplier_id: str, payload: OutreachRequest) -> OutreachResponse:
    """Готовый текст запроса поставщику — закрывает пробелы в его профиле."""
    supplier = _get_supplier(supplier_id)
    return build_message(
        supplier,
        assess(supplier),
        category=payload.category,
        city=payload.city,
        volume=payload.volume,
    )


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_index() -> FileResponse:
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
