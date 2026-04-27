from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import radians, sin

import httpx

from .engine import FeatureSample, estimate_features


WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast"
ELEVATION_API_URL = "https://api.open-meteo.com/v1/elevation"
GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search"
REVERSE_GEOCODING_API_URL = "https://nominatim.openstreetmap.org/reverse"


@dataclass(frozen=True)
class LiveConditions:
    features: FeatureSample
    fetched_at: str
    data_source: str
    weather_context: dict[str, float | str]


def _first_value(values: object, fallback: float) -> float:
    if isinstance(values, list) and values:
        return float(values[0])
    return float(fallback)


class OpenMeteoService:
    def __init__(self, timeout_seconds: float = 12.0) -> None:
        self.timeout_seconds = timeout_seconds

    def fetch_conditions(self, latitude: float, longitude: float) -> LiveConditions:
        fallback = estimate_features(latitude, longitude)
        fallback_context = {
            "temperature_2m": fallback.temperature,
            "wind_speed_10m": fallback.wind_speed,
            "surface_pressure": fallback.pressure,
            "shortwave_radiation_sum": round(fallback.solar_irradiance * 3.6, 2),
            "precipitation_sum": max(round(fallback.water_availability * 0.15, 2), 0.0),
            "timezone": "UTC",
        }

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                weather_response = client.get(
                    WEATHER_API_URL,
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "current": "temperature_2m,surface_pressure,wind_speed_10m",
                        "daily": "shortwave_radiation_sum,precipitation_sum",
                        "timezone": "auto",
                        "forecast_days": 1,
                        "wind_speed_unit": "ms",
                    },
                )
                weather_response.raise_for_status()

                elevation_response = client.get(
                    ELEVATION_API_URL,
                    params={"latitude": latitude, "longitude": longitude},
                )
                elevation_response.raise_for_status()
        except httpx.HTTPError:
            return LiveConditions(
                features=fallback,
                fetched_at=datetime.now(timezone.utc).isoformat(),
                data_source="synthetic-fallback",
                weather_context=fallback_context,
            )

        weather_payload = weather_response.json()
        elevation_payload = elevation_response.json()
        current = weather_payload.get("current", {})
        daily = weather_payload.get("daily", {})
        elevation_values = elevation_payload.get("elevation", [fallback.elevation])
        elevation = float(elevation_values[0]) if elevation_values else fallback.elevation

        shortwave_sum_mj = _first_value(daily.get("shortwave_radiation_sum"), fallback.solar_irradiance * 3.6)
        precipitation_sum_mm = _first_value(daily.get("precipitation_sum"), max(fallback.water_availability * 0.15, 0.0))
        solar_irradiance = round(shortwave_sum_mj / 3.6, 2)
        wind_speed = round(float(current.get("wind_speed_10m", fallback.wind_speed)), 2)
        temperature = round(float(current.get("temperature_2m", fallback.temperature)), 2)
        pressure = round(float(current.get("surface_pressure", fallback.pressure)), 2)

        latitude_radians = radians(latitude)
        longitude_radians = radians(longitude)
        hydro_index = min(
            100.0,
            max(
                5.0,
                precipitation_sum_mm * 6.0
                + max(elevation, 0.0) / 120.0
                + 15.0 * abs(sin(latitude_radians * 0.7 - longitude_radians * 0.25)),
            ),
        )

        return LiveConditions(
            features=FeatureSample(
                solar_irradiance=solar_irradiance,
                wind_speed=wind_speed,
                elevation=round(elevation, 2),
                water_availability=round(hydro_index, 2),
                temperature=temperature,
                pressure=pressure,
            ),
            fetched_at=datetime.now(timezone.utc).isoformat(),
            data_source="open-meteo-live",
            weather_context={
                "temperature_2m": temperature,
                "wind_speed_10m": wind_speed,
                "surface_pressure": pressure,
                "shortwave_radiation_sum": round(shortwave_sum_mj, 2),
                "precipitation_sum": round(precipitation_sum_mm, 2),
                "timezone": weather_payload.get("timezone", "UTC"),
            },
        )

    def search_locations(self, query: str, count: int = 5) -> list[dict[str, object]]:
        if len(query.strip()) < 2:
            return []

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.get(
                    GEOCODING_API_URL,
                    params={
                        "name": query.strip(),
                        "count": count,
                        "language": "en",
                        "format": "json",
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError:
            return []

        payload = response.json()
        return [
            {
                "name": item.get("name"),
                "country": item.get("country"),
                "admin1": item.get("admin1"),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "elevation": item.get("elevation"),
                "timezone": item.get("timezone"),
            }
            for item in payload.get("results", [])
        ]

    def reverse_location(self, latitude: float, longitude: float) -> dict[str, object]:
        fallback_name = f"Selected point ({round(latitude, 4)}, {round(longitude, 4)})"

        try:
            with httpx.Client(
                timeout=self.timeout_seconds,
                headers={"User-Agent": "MapSense/1.0"},
            ) as client:
                response = client.get(
                    REVERSE_GEOCODING_API_URL,
                    params={
                        "lat": latitude,
                        "lon": longitude,
                        "format": "jsonv2",
                        "zoom": 10,
                        "addressdetails": 1,
                    },
                )
                response.raise_for_status()
        except httpx.HTTPError:
            return {
                "name": fallback_name,
                "country": None,
                "admin1": None,
                "latitude": latitude,
                "longitude": longitude,
            }

        payload = response.json()
        address = payload.get("address", {})
        locality = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("county")
            or address.get("state_district")
        )
        admin1 = address.get("state") or address.get("region")
        country = address.get("country")
        name_parts = [part for part in [locality, admin1, country] if part]
        name = ", ".join(dict.fromkeys(name_parts)) if name_parts else fallback_name

        return {
            "name": name,
            "country": country,
            "admin1": admin1,
            "latitude": latitude,
            "longitude": longitude,
        }
