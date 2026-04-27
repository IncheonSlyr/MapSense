from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db, load_recent_recommendations, save_recommendation
from .engine import RecommendationEngine
from .schemas import (
    HistoryResponse,
    LocationRequest,
    LocationSearchResult,
    RecommendationResponse,
    ReverseLocationResult,
)
from .services import OpenMeteoService


app = FastAPI(
    title="Renewable Energy Recommendation API",
    description="Recommend the best renewable energy source for a location.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RecommendationEngine()
weather_service = OpenMeteoService()
init_db()


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/recommend", response_model=RecommendationResponse)
def recommend(payload: LocationRequest) -> RecommendationResponse:
    live_conditions = weather_service.fetch_conditions(payload.latitude, payload.longitude)
    recommendation = engine.recommend(
        payload.latitude,
        payload.longitude,
        payload.demand_kw,
        sample=live_conditions.features,
        location_name=payload.location_name,
        data_source=live_conditions.data_source,
        fetched_at=live_conditions.fetched_at,
        weather_context=live_conditions.weather_context,
    )
    recommendation["id"] = save_recommendation(recommendation)
    return RecommendationResponse(**recommendation)


@app.get("/api/history", response_model=HistoryResponse)
def history(limit: int = Query(10, ge=1, le=50)) -> HistoryResponse:
    items = [RecommendationResponse(**item) for item in load_recent_recommendations(limit)]
    return HistoryResponse(items=items)


@app.get("/api/locations/search", response_model=list[LocationSearchResult])
def search_locations(q: str = Query(..., min_length=2), count: int = Query(5, ge=1, le=10)) -> list[LocationSearchResult]:
    return [LocationSearchResult(**item) for item in weather_service.search_locations(q, count)]


@app.get("/api/locations/reverse", response_model=ReverseLocationResult)
def reverse_location(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
) -> ReverseLocationResult:
    return ReverseLocationResult(**weather_service.reverse_location(latitude, longitude))
