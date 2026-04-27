# MapSense

MapSense is a single-app renewable energy recommendation dashboard built with Flask and a Python recommendation model. It evaluates a location and suggests the best-fit source across Solar, Wind, and Hydro using live weather, terrain context, and a demand-aware scoring engine.

## Features

- Interactive map picker with reverse geocoding
- Python recommendation model
- Solar, Wind, and Hydro rankings with rationale
- Source comparison and ROI views
- Weather widget and grouped site-relevance panels
- Local saved-history drawer in the browser

## Stack

- Flask
- Python recommendation engine
- Leaflet
- Open-Meteo APIs
- OpenStreetMap / CARTO tiles
- Nominatim reverse geocoding
- Plain HTML, CSS, and JavaScript frontend

## Local development

```powershell
cd D:\RenewableEnergy
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m flask --app api.index run --port 8000
```

- App: `http://127.0.0.1:8000`

## API routes

- `POST /api/recommend`
- `GET /api/locations/search`
- `GET /api/locations/reverse`
- `GET /api/health`

## Notes

- The recommendation model is unchanged in Python.
- Live weather data comes from Open-Meteo.
- If the external weather APIs are unavailable, MapSense falls back to a local estimator.
- Saved history is stored in the browser for the current user session history experience.
