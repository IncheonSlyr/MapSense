# MapSense

MapSense is a single-app renewable energy recommendation dashboard built with Next.js. It evaluates a location and suggests the best-fit renewable source across Solar, Wind, and Hydro using live weather, terrain context, and a demand-aware scoring model.

## Features

- Interactive map picker with reverse geocoding
- Demand-aware recommendation model
- Solar, Wind, and Hydro rankings with rationale
- Source comparison and ROI views
- Weather widget and grouped site-relevance panels
- Local saved-history drawer

## Stack

- Next.js App Router
- React
- Leaflet
- Open-Meteo APIs
- OpenStreetMap / CARTO tiles
- Nominatim reverse geocoding

## Local development

```powershell
cd D:\RenewableEnergy
npm.cmd install
npm.cmd run dev
```

- App: `http://localhost:3000`

## API routes

- `POST /api/recommend`
- `GET /api/locations/search`
- `GET /api/locations/reverse`
- `GET /api/health`

## Notes

- Live weather data comes from Open-Meteo.
- If the external weather APIs are unavailable, MapSense falls back to a local estimator.
- Saved history is stored in the browser for the current user session history experience.
