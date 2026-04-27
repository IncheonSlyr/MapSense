from typing import Literal

from pydantic import BaseModel, Field


EnergyType = Literal["Solar", "Wind", "Hydro"]


class LocationRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")
    demand_kw: float = Field(120.0, gt=0, le=10000, description="Estimated community demand")
    location_name: str | None = Field(None, max_length=120, description="Optional label for the location")


class FeatureEstimate(BaseModel):
    solar_irradiance: float
    wind_speed: float
    elevation: float
    water_availability: float
    temperature: float
    pressure: float


class SourceScore(BaseModel):
    source: EnergyType
    score: float
    expected_efficiency: float
    estimated_output_kw: float
    roi_years: float
    rationale: str


class RecommendationResponse(BaseModel):
    id: int | None = None
    location: dict[str, float]
    location_name: str | None = None
    demand_kw: float
    best_source: EnergyType
    confidence: float
    summary: str
    data_source: str
    fetched_at: str | None = None
    weather_context: dict[str, float | str] = Field(default_factory=dict)
    estimated_features: FeatureEstimate
    rankings: list[SourceScore]


class LocationSearchResult(BaseModel):
    name: str | None = None
    country: str | None = None
    admin1: str | None = None
    latitude: float
    longitude: float
    elevation: float | None = None
    timezone: str | None = None


class ReverseLocationResult(BaseModel):
    name: str
    country: str | None = None
    admin1: str | None = None
    latitude: float
    longitude: float


class HistoryResponse(BaseModel):
    items: list[RecommendationResponse]
