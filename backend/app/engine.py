from __future__ import annotations

from dataclasses import dataclass
from math import cos, radians, sin
from typing import Any


ENERGY_SOURCES = ("Solar", "Wind", "Hydro")


@dataclass(frozen=True)
class FeatureSample:
    solar_irradiance: float
    wind_speed: float
    elevation: float
    water_availability: float
    temperature: float
    pressure: float


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def estimate_features(latitude: float, longitude: float) -> FeatureSample:
    lat = radians(latitude)
    lon = radians(longitude)

    solar_irradiance = _clamp(
        4.0 + 1.8 * cos(lat) + 0.45 * sin(lon * 1.7) - 0.25 * abs(latitude) / 90,
        2.4,
        7.2,
    )
    wind_speed = _clamp(
        3.2 + 2.5 * abs(sin(lat * 1.4)) + 1.1 * abs(cos(lon * 1.8)),
        1.5,
        9.8,
    )
    elevation = _clamp(
        250 + 1950 * abs(sin(lat) * cos(lon * 0.6)),
        0,
        3200,
    )
    water_availability = _clamp(
        35 + 42 * abs(sin(lat * 0.9 - lon * 0.2)) + 18 * abs(cos(lon * 1.3)),
        10,
        100,
    )
    temperature = _clamp(
        30 - (abs(latitude) / 90) * 24 + 4 * sin(lon),
        -5,
        38,
    )
    pressure = _clamp(
        1013.25 - elevation * 0.09,
        700,
        1015,
    )

    return FeatureSample(
        solar_irradiance=round(solar_irradiance, 2),
        wind_speed=round(wind_speed, 2),
        elevation=round(elevation, 2),
        water_availability=round(water_availability, 2),
        temperature=round(temperature, 2),
        pressure=round(pressure, 2),
    )


def _source_metrics(sample: FeatureSample, demand_kw: float) -> dict[str, dict[str, float | str]]:
    demand_kw = _clamp(demand_kw, 1.0, 10000.0)
    normalized_demand = _clamp((demand_kw - 50.0) / 950.0, 0.0, 1.0)

    resource_scores = {
        "Solar": _clamp(
            0.58 * (sample.solar_irradiance / 7.2)
            + 0.16 * (1 - abs(sample.temperature - 24.0) / 24.0)
            + 0.12 * (sample.elevation / 3200.0)
            + 0.14 * (1 - sample.water_availability / 100.0),
            0.05,
            0.99,
        ),
        "Wind": _clamp(
            0.62 * (sample.wind_speed / 9.8)
            + 0.12 * (sample.pressure / 1015.0)
            + 0.10 * (1 - abs(sample.temperature - 18.0) / 30.0)
            + 0.16 * (sample.elevation / 3200.0),
            0.05,
            0.99,
        ),
        "Hydro": _clamp(
            0.52 * (sample.water_availability / 100.0)
            + 0.30 * (sample.elevation / 3200.0)
            + 0.10 * (sample.pressure / 1015.0)
            + 0.08 * (1 - abs(sample.temperature - 16.0) / 28.0),
            0.05,
            0.99,
        ),
    }

    capacity_factors = {
        "Solar": _clamp(
            0.13
            + 0.19 * (sample.solar_irradiance - 2.4) / 4.8
            - 0.02 * abs(sample.temperature - 24.0) / 20.0,
            0.12,
            0.32,
        ),
        "Wind": _clamp(
            0.16
            + 0.24 * (sample.wind_speed - 1.5) / 8.3
            + 0.03 * (sample.pressure - 700.0) / 315.0,
            0.15,
            0.46,
        ),
        "Hydro": _clamp(
            0.26
            + 0.28 * (sample.water_availability / 100.0)
            + 0.06 * (sample.elevation / 3200.0),
            0.28,
            0.64,
        ),
    }

    resource_output_kw = {
        "Solar": 45.0 + 22.0 * sample.solar_irradiance + 0.05 * sample.elevation - 0.25 * max(sample.temperature - 32.0, 0.0),
        "Wind": 25.0 + 17.5 * sample.wind_speed + 0.02 * sample.elevation + 0.04 * max(sample.pressure - 850.0, 0.0),
        "Hydro": 18.0 + 0.90 * sample.water_availability + 0.06 * sample.elevation,
    }

    scalability = {
        "Solar": _clamp(0.96 - 0.12 * normalized_demand, 0.74, 0.98),
        "Wind": _clamp(0.72 + 0.18 * normalized_demand, 0.70, 0.92),
        "Hydro": _clamp(0.58 + 0.30 * normalized_demand, 0.55, 0.91),
    }

    reliability = {
        "Solar": _clamp(0.54 + 0.22 * resource_scores["Solar"], 0.52, 0.82),
        "Wind": _clamp(0.57 + 0.22 * resource_scores["Wind"], 0.55, 0.85),
        "Hydro": _clamp(0.66 + 0.20 * resource_scores["Hydro"], 0.64, 0.92),
    }

    capex_per_kw = {
        "Solar": 920.0,
        "Wind": 1480.0,
        "Hydro": 2180.0,
    }
    om_rate = {
        "Solar": 0.018,
        "Wind": 0.026,
        "Hydro": 0.034,
    }
    electricity_value_per_kwh = 0.082

    rationale = {
        "Solar": "Solar resource, moderate temperature, and modular deployment make photovoltaics a strong fit here.",
        "Wind": "Wind speed and pressure support turbine performance with good scalability for higher demand.",
        "Hydro": "Water availability and elevation create usable hydraulic head, but economics depend on site conditions.",
    }

    results: dict[str, dict[str, float | str]] = {}
    for source in ENERGY_SOURCES:
        raw_output = max(18.0, resource_output_kw[source])
        usable_output = min(raw_output, demand_kw * 1.35)
        demand_fit = _clamp(1.0 - abs(raw_output - demand_kw) / max(demand_kw * 1.15, 80.0), 0.20, 1.0)
        annual_energy_kwh = usable_output * capacity_factors[source] * 8760.0
        annual_value = annual_energy_kwh * electricity_value_per_kwh
        total_capex = usable_output * capex_per_kw[source]
        annual_om = total_capex * om_rate[source]
        roi_years = total_capex / max(annual_value - annual_om, 1.0)
        roi_score = _clamp(1.0 - (roi_years - 4.0) / 18.0, 0.0, 1.0)

        final_score = _clamp(
            0.50 * resource_scores[source]
            + 0.24 * demand_fit
            + 0.14 * scalability[source]
            + 0.08 * reliability[source]
            + 0.04 * roi_score,
            0.05,
            0.99,
        )

        results[source] = {
            "score": round(final_score, 4),
            "resource_score": round(resource_scores[source], 4),
            "demand_fit": round(demand_fit, 4),
            "scalability": round(scalability[source], 4),
            "expected_efficiency": round(capacity_factors[source], 4),
            "estimated_output_kw": round(usable_output, 2),
            "roi_years": round(roi_years, 1),
            "rationale": rationale[source],
        }

    return results


class RecommendationEngine:
    def recommend(
        self,
        latitude: float,
        longitude: float,
        demand_kw: float,
        sample: FeatureSample | None = None,
        location_name: str | None = None,
        data_source: str = "synthetic-estimate",
        fetched_at: str | None = None,
        weather_context: dict[str, Any] | None = None,
    ) -> dict[str, object]:
        sample = sample or estimate_features(latitude, longitude)
        raw_scores = _source_metrics(sample, demand_kw)

        rankings = [
            {
                "source": source,
                "score": round(float(values["score"]) * 100.0, 1),
                "expected_efficiency": round(float(values["expected_efficiency"]) * 100.0, 1),
                "estimated_output_kw": round(float(values["estimated_output_kw"]), 1),
                "roi_years": float(values["roi_years"]),
                "rationale": str(values["rationale"]),
            }
            for source, values in sorted(
                raw_scores.items(), key=lambda item: float(item[1]["score"]), reverse=True
            )
        ]

        best_item = rankings[0]
        second_score = rankings[1]["score"] if len(rankings) > 1 else rankings[0]["score"]
        margin = (best_item["score"] - second_score) / 100.0
        confidence = _clamp(
            0.46 + (best_item["score"] / 100.0) * 0.28 + margin * 0.70,
            0.35,
            0.97,
        )

        return {
            "location": {"latitude": latitude, "longitude": longitude},
            "location_name": location_name,
            "demand_kw": demand_kw,
            "best_source": best_item["source"],
            "confidence": round(confidence * 100.0, 1),
            "summary": (
                f"{best_item['source']} is the strongest fit here with an estimated "
                f"{best_item['expected_efficiency']}% efficiency and "
                f"{best_item['estimated_output_kw']} kW output potential."
            ),
            "data_source": data_source,
            "fetched_at": fetched_at,
            "weather_context": weather_context or {},
            "estimated_features": {
                "solar_irradiance": sample.solar_irradiance,
                "wind_speed": sample.wind_speed,
                "elevation": sample.elevation,
                "water_availability": sample.water_availability,
                "temperature": sample.temperature,
                "pressure": sample.pressure,
            },
            "rankings": rankings,
        }
