from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from mapsense.engine import RecommendationEngine, ScenarioInputs
from mapsense.services import OpenMeteoService


app = Flask(__name__, template_folder="../templates", static_folder="../static")
engine = RecommendationEngine()
weather_service = OpenMeteoService()


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/recommend")
def recommend():
    payload = request.get_json(silent=True) or {}
    latitude = float(payload.get("latitude", 0))
    longitude = float(payload.get("longitude", 0))
    demand_kw = float(payload.get("demand_kw", 0))
    location_name = payload.get("location_name")
    budget_usd = float(payload.get("budget_usd", max(demand_kw * 1450.0, 150000.0)))
    land_acres = float(payload.get("land_acres", max(demand_kw * 0.015, 3.0)))
    strategy = str(payload.get("strategy", "balanced")).strip().lower() or "balanced"

    if not -90 <= latitude <= 90:
        return jsonify({"error": "Latitude must be between -90 and 90."}), 400
    if not -180 <= longitude <= 180:
        return jsonify({"error": "Longitude must be between -180 and 180."}), 400
    if not 0 < demand_kw <= 10000:
        return jsonify({"error": "Demand must be between 1 and 10000 kW."}), 400
    if not 0 < budget_usd <= 1000000000:
        return jsonify({"error": "Budget must be between 1 and 1,000,000,000 USD."}), 400
    if not 0.1 <= land_acres <= 100000:
        return jsonify({"error": "Land must be between 0.1 and 100,000 acres."}), 400
    if strategy not in {"balanced", "roi", "resilience", "output"}:
        return jsonify({"error": "Strategy must be one of balanced, roi, resilience, or output."}), 400

    live_conditions = weather_service.fetch_conditions(latitude, longitude)
    recommendation = engine.recommend(
        latitude,
        longitude,
        demand_kw,
        sample=live_conditions.features,
        location_name=location_name,
        data_source=live_conditions.data_source,
        fetched_at=live_conditions.fetched_at,
        weather_context=live_conditions.weather_context,
        scenario=ScenarioInputs(
            budget_usd=budget_usd,
            land_acres=land_acres,
            strategy=strategy,
        ),
    )
    return jsonify(recommendation)


@app.get("/api/locations/search")
def location_search():
    query = request.args.get("q", "").strip()
    count = max(1, min(int(request.args.get("count", 5)), 10))
    return jsonify(weather_service.search_locations(query, count))


@app.get("/api/locations/reverse")
def location_reverse():
    latitude = float(request.args.get("latitude", 0))
    longitude = float(request.args.get("longitude", 0))

    if not -90 <= latitude <= 90:
        return jsonify({"error": "Latitude must be between -90 and 90."}), 400
    if not -180 <= longitude <= 180:
        return jsonify({"error": "Longitude must be between -180 and 180."}), 400

    return jsonify(weather_service.reverse_location(latitude, longitude))
