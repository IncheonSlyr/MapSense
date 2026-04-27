# MapSense

MapSense is a full-stack renewable energy recommendation app that evaluates a location and suggests the best-fit energy source across Solar, Wind, and Hydro.

It combines live weather and terrain data, a demand-aware recommendation engine, interactive map selection, persistent history, and a polished React dashboard.

## Features

- Interactive location picker with reverse geocoding
- Demand-aware recommendation engine
- Solar, Wind, and Hydro ranking with rationale
- Source comparison and ROI visualizations
- Weather widget and grouped site-relevance panels
- SQLite-backed saved history
- FastAPI backend with React + Vite frontend

## Stack

- Backend: FastAPI, httpx, SQLite
- Frontend: React, Vite, Leaflet
- External data: Open-Meteo APIs, OpenStreetMap / CARTO tiles, Nominatim reverse geocoding

## Local development

### Backend

```powershell
cd D:\RenewableEnergy
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
.\.venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000
```

### Frontend

```powershell
cd D:\RenewableEnergy\frontend
npm.cmd install
npm.cmd run dev
```

- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`

## API endpoints

- `POST /api/recommend`
- `GET /api/history`
- `GET /api/locations/search`
- `GET /api/locations/reverse`
- `GET /api/health`

## Deployment notes

This repo can be deployed as:

1. A Vercel FastAPI backend project using the `backend/` directory
2. A Vercel Vite frontend project using the `frontend/` directory

The frontend should be configured with:

- `VITE_API_BASE_URL=<deployed backend url>`

## Notes

- Live weather data comes from Open-Meteo.
- If the external weather API is unavailable, the backend falls back to a local estimator.
- Saved history is stored in `backend/data/recommendations.db`.
