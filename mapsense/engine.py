from __future__ import annotations

from dataclasses import dataclass
from math import cos, pi, radians, sin
from typing import Any


ENERGY_SOURCES = ("Solar", "Wind", "Hydro")
MONTHS = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
)


@dataclass(frozen=True)
class FeatureSample:
    solar_irradiance: float
    wind_speed: float
    elevation: float
    water_availability: float
    temperature: float
    pressure: float


@dataclass(frozen=True)
class ScenarioInputs:
    budget_usd: float
    land_acres: float
    strategy: str


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


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


def _seasonal_variation(latitude: float, month_index: int) -> tuple[float, float]:
    seasonal_angle = ((month_index - 1) / 12.0) * 2.0 * pi
    hemisphere_bias = -1.0 if latitude >= 0 else 1.0
    return seasonal_angle, hemisphere_bias


def _seasonal_factor(source: str, sample: FeatureSample, latitude: float, month_index: int) -> float:
    seasonal_angle, hemisphere_bias = _seasonal_variation(latitude, month_index)
    latitude_scale = min(abs(latitude) / 60.0, 1.0)

    if source == "Solar":
        factor = 1.0 + hemisphere_bias * sin(seasonal_angle) * (0.30 + latitude_scale * 0.22)
        factor -= max(sample.temperature - 30.0, 0.0) * 0.003
        return _clamp(factor, 0.48, 1.42)
    if source == "Wind":
        factor = 1.0 + cos(seasonal_angle) * 0.12 + latitude_scale * 0.08
        return _clamp(factor, 0.72, 1.26)

    monsoon_bias = abs(sin(seasonal_angle - hemisphere_bias * 0.55))
    hydro_factor = 0.84 + monsoon_bias * 0.34 + (sample.water_availability / 100.0) * 0.10
    return _clamp(hydro_factor, 0.74, 1.34)


def _hybrid_mix(
    rankings: list[dict[str, float | str]],
    demand_kw: float,
) -> dict[str, Any]:
    top = rankings[:2]
    score_total = max(sum(float(item["score"]) for item in top), 1.0)
    weights = [round(float(item["score"]) / score_total * 100.0, 1) for item in top]

    primary_weight = weights[0]
    secondary_weight = round(100.0 - primary_weight, 1)
    weighted_output = sum(float(item["estimated_output_kw"]) * weight / 100.0 for item, weight in zip(top, (primary_weight, secondary_weight)))
    weighted_roi = sum(float(item["roi_years"]) * weight / 100.0 for item, weight in zip(top, (primary_weight, secondary_weight)))
    weighted_efficiency = sum(float(item["expected_efficiency"]) * weight / 100.0 for item, weight in zip(top, (primary_weight, secondary_weight)))
    weighted_carbon = sum(float(item["annual_carbon_offset_tons"]) * weight / 100.0 for item, weight in zip(top, (primary_weight, secondary_weight)))
    demand_coverage = _clamp(_safe_div(weighted_output, demand_kw) * 100.0, 0.0, 160.0)

    return {
        "label": f"{top[0]['source']} + {top[1]['source']}",
        "mix": [
            {"source": str(top[0]["source"]), "share_percent": primary_weight},
            {"source": str(top[1]["source"]), "share_percent": secondary_weight},
        ],
        "blended_output_kw": round(weighted_output, 1),
        "blended_efficiency": round(weighted_efficiency, 1),
        "blended_roi_years": round(weighted_roi, 1),
        "annual_carbon_offset_tons": round(weighted_carbon, 1),
        "demand_coverage_percent": round(demand_coverage, 1),
        "rationale": (
            f"Combining {top[0]['source']} and {top[1]['source']} balances site suitability with "
            "operational resilience when you want more than a single-source recommendation."
        ),
    }


def _seasonal_outlook(
    sample: FeatureSample,
    latitude: float,
    rankings: list[dict[str, float | str]],
) -> list[dict[str, Any]]:
    baseline_output = {str(item["source"]): float(item["estimated_output_kw"]) for item in rankings}
    baseline_efficiency = {str(item["source"]): float(item["expected_efficiency"]) for item in rankings}
    outlook: list[dict[str, Any]] = []

    for month_index, month in enumerate(MONTHS, start=1):
        monthly_sources = []
        for source in ENERGY_SOURCES:
            factor = _seasonal_factor(source, sample, latitude, month_index)
            monthly_sources.append(
                {
                    "source": source,
                    "output_kw": round(baseline_output[source] * factor, 1),
                    "efficiency": round(_clamp(baseline_efficiency[source] * factor, 8.0, 95.0), 1),
                }
            )
        winner = max(monthly_sources, key=lambda item: float(item["output_kw"]))
        outlook.append(
            {
                "month": month,
                "winner": winner["source"],
                "sources": monthly_sources,
            }
        )
    return outlook


def _scenario_story(
    best_source: str,
    scenario: ScenarioInputs,
    top_item: dict[str, float | str],
) -> list[str]:
    notes = [
        f"{best_source} leads the current scenario with a {top_item['score']}% suitability score.",
    ]
    if scenario.strategy == "roi":
        notes.append("ROI priority increases the weight of faster payback and lower capital intensity.")
    elif scenario.strategy == "resilience":
        notes.append("Resilience priority rewards more stable output and dependable annual delivery.")
    elif scenario.strategy == "output":
        notes.append("Output priority favors technologies that maximize delivered generation for this site.")
    if scenario.budget_usd > 0:
        notes.append(f"Budget guardrails were checked against an available capex budget of ${scenario.budget_usd:,.0f}.")
    if scenario.land_acres > 0:
        notes.append(f"Land availability was constrained to {scenario.land_acres:.1f} acres in the planner.")
    return notes


def _source_metrics(
    sample: FeatureSample,
    demand_kw: float,
    scenario: ScenarioInputs,
) -> dict[str, dict[str, float | str]]:
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
    land_use_per_kw = {
        "Solar": 0.0065,
        "Wind": 0.028,
        "Hydro": 0.010,
    }
    om_rate = {
        "Solar": 0.018,
        "Wind": 0.026,
        "Hydro": 0.034,
    }
    electricity_value_per_kwh = 0.082
    carbon_intensity_offset = {
        "Solar": 0.00058,
        "Wind": 0.00051,
        "Hydro": 0.00047,
    }
    strategy_weights = {
        "balanced": {"output": 0.08, "roi": 0.10, "reliability": 0.12},
        "roi": {"output": 0.05, "roi": 0.16, "reliability": 0.11},
        "resilience": {"output": 0.05, "roi": 0.07, "reliability": 0.18},
        "output": {"output": 0.15, "roi": 0.07, "reliability": 0.10},
    }
    selected_strategy = strategy_weights.get(scenario.strategy, strategy_weights["balanced"])

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
        annual_carbon_offset = annual_energy_kwh * carbon_intensity_offset[source]
        land_required = usable_output * land_use_per_kw[source]
        budget_fit = 1.0 if scenario.budget_usd <= 0 else _clamp(scenario.budget_usd / max(total_capex, 1.0), 0.28, 1.0)
        land_fit = 1.0 if scenario.land_acres <= 0 else _clamp(scenario.land_acres / max(land_required, 0.05), 0.18, 1.0)
        output_fit = _clamp(_safe_div(usable_output, demand_kw), 0.22, 1.0)

        final_score = _clamp(
            0.31 * resource_scores[source]
            + 0.18 * demand_fit
            + 0.08 * scalability[source]
            + selected_strategy["reliability"] * reliability[source]
            + selected_strategy["roi"] * roi_score
            + selected_strategy["output"] * output_fit
            + 0.03 * budget_fit
            + 0.03 * land_fit,
            0.05,
            0.99,
        )

        results[source] = {
            "score": round(final_score, 4),
            "expected_efficiency": round(capacity_factors[source], 4),
            "estimated_output_kw": round(usable_output, 2),
            "roi_years": round(roi_years, 1),
            "annual_energy_kwh": round(annual_energy_kwh, 1),
            "annual_value_usd": round(annual_value, 1),
            "estimated_capex_usd": round(total_capex, 1),
            "annual_carbon_offset_tons": round(annual_carbon_offset, 1),
            "land_required_acres": round(land_required, 2),
            "budget_fit": round(budget_fit, 4),
            "land_fit": round(land_fit, 4),
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
        scenario: ScenarioInputs | None = None,
    ) -> dict[str, object]:
        sample = sample or estimate_features(latitude, longitude)
        scenario = scenario or ScenarioInputs(
            budget_usd=max(demand_kw * 1450.0, 150000.0),
            land_acres=max(demand_kw * 0.015, 3.0),
            strategy="balanced",
        )
        raw_scores = _source_metrics(sample, demand_kw, scenario)

        rankings = [
            {
                "source": source,
                "score": round(float(values["score"]) * 100.0, 1),
                "expected_efficiency": round(float(values["expected_efficiency"]) * 100.0, 1),
                "estimated_output_kw": round(float(values["estimated_output_kw"]), 1),
                "roi_years": float(values["roi_years"]),
                "annual_energy_kwh": round(float(values["annual_energy_kwh"]), 1),
                "annual_value_usd": round(float(values["annual_value_usd"]), 1),
                "estimated_capex_usd": round(float(values["estimated_capex_usd"]), 1),
                "annual_carbon_offset_tons": round(float(values["annual_carbon_offset_tons"]), 1),
                "land_required_acres": round(float(values["land_required_acres"]), 2),
                "budget_fit": round(float(values["budget_fit"]) * 100.0, 1),
                "land_fit": round(float(values["land_fit"]) * 100.0, 1),
                "rationale": str(values["rationale"]),
            }
            for source, values in sorted(raw_scores.items(), key=lambda item: float(item[1]["score"]), reverse=True)
        ]

        best_item = rankings[0]
        second_score = rankings[1]["score"] if len(rankings) > 1 else rankings[0]["score"]
        margin = (best_item["score"] - second_score) / 100.0
        confidence = _clamp(
            0.46 + (best_item["score"] / 100.0) * 0.28 + margin * 0.70,
            0.35,
            0.97,
        )
        hybrid_plan = _hybrid_mix(rankings, demand_kw)
        seasonal_outlook = _seasonal_outlook(sample, latitude, rankings)
        annual_carbon_total = round(float(best_item["annual_carbon_offset_tons"]), 1)

        return {
            "id": None,
            "location": {"latitude": latitude, "longitude": longitude},
            "location_name": location_name,
            "demand_kw": demand_kw,
            "scenario": {
                "budget_usd": round(scenario.budget_usd, 1),
                "land_acres": round(scenario.land_acres, 2),
                "strategy": scenario.strategy,
            },
            "best_source": best_item["source"],
            "confidence": round(confidence * 100.0, 1),
            "summary": (
                f"{best_item['source']} is the strongest fit here with an estimated "
                f"{best_item['expected_efficiency']}% efficiency and "
                f"{best_item['estimated_output_kw']} kW output potential."
            ),
            "planner_highlights": {
                "annual_carbon_offset_tons": annual_carbon_total,
                "estimated_capex_usd": round(float(best_item["estimated_capex_usd"]), 1),
                "annual_value_usd": round(float(best_item["annual_value_usd"]), 1),
                "land_required_acres": round(float(best_item["land_required_acres"]), 2),
            },
            "planner_notes": _scenario_story(best_item["source"], scenario, best_item),
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
            "hybrid_plan": hybrid_plan,
            "seasonal_outlook": seasonal_outlook,
        }
