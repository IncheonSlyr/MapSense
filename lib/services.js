import { estimateFeatures } from '@/lib/engine'

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast'
const ELEVATION_API_URL = 'https://api.open-meteo.com/v1/elevation'
const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REVERSE_GEOCODING_API_URL = 'https://nominatim.openstreetmap.org/reverse'

function firstValue(values, fallback) {
  return Array.isArray(values) && values.length ? Number(values[0]) : Number(fallback)
}

export async function fetchConditions(latitude, longitude) {
  const fallback = estimateFeatures(latitude, longitude)
  const fallbackContext = {
    temperature_2m: fallback.temperature,
    wind_speed_10m: fallback.wind_speed,
    surface_pressure: fallback.pressure,
    shortwave_radiation_sum: Number((fallback.solar_irradiance * 3.6).toFixed(2)),
    precipitation_sum: Math.max(Number((fallback.water_availability * 0.15).toFixed(2)), 0),
    timezone: 'UTC',
  }

  try {
    const [weatherResponse, elevationResponse] = await Promise.all([
      fetch(
        `${WEATHER_API_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,surface_pressure,wind_speed_10m&daily=shortwave_radiation_sum,precipitation_sum&timezone=auto&forecast_days=1&wind_speed_unit=ms`,
        { next: { revalidate: 1800 } },
      ),
      fetch(`${ELEVATION_API_URL}?latitude=${latitude}&longitude=${longitude}`, {
        next: { revalidate: 86400 },
      }),
    ])

    if (!weatherResponse.ok || !elevationResponse.ok) {
      throw new Error('External weather service unavailable')
    }

    const weatherPayload = await weatherResponse.json()
    const elevationPayload = await elevationResponse.json()
    const current = weatherPayload.current || {}
    const daily = weatherPayload.daily || {}
    const elevationValues = elevationPayload.elevation || [fallback.elevation]
    const elevation = Number(elevationValues[0] ?? fallback.elevation)
    const shortwaveSumMj = firstValue(daily.shortwave_radiation_sum, fallback.solar_irradiance * 3.6)
    const precipitationSumMm = firstValue(daily.precipitation_sum, Math.max(fallback.water_availability * 0.15, 0))
    const solarIrradiance = Number((shortwaveSumMj / 3.6).toFixed(2))
    const windSpeed = Number(Number(current.wind_speed_10m ?? fallback.wind_speed).toFixed(2))
    const temperature = Number(Number(current.temperature_2m ?? fallback.temperature).toFixed(2))
    const pressure = Number(Number(current.surface_pressure ?? fallback.pressure).toFixed(2))

    const latitudeRadians = latitude * Math.PI / 180
    const longitudeRadians = longitude * Math.PI / 180
    const hydroIndex = Math.min(
      100,
      Math.max(
        5,
        precipitationSumMm * 6 +
          Math.max(elevation, 0) / 120 +
          15 * Math.abs(Math.sin(latitudeRadians * 0.7 - longitudeRadians * 0.25)),
      ),
    )

    return {
      features: {
        solar_irradiance: solarIrradiance,
        wind_speed: windSpeed,
        elevation: Number(elevation.toFixed(2)),
        water_availability: Number(hydroIndex.toFixed(2)),
        temperature,
        pressure,
      },
      fetchedAt: new Date().toISOString(),
      dataSource: 'open-meteo-live',
      weatherContext: {
        temperature_2m: temperature,
        wind_speed_10m: windSpeed,
        surface_pressure: pressure,
        shortwave_radiation_sum: Number(shortwaveSumMj.toFixed(2)),
        precipitation_sum: Number(precipitationSumMm.toFixed(2)),
        timezone: weatherPayload.timezone || 'UTC',
      },
    }
  } catch {
    return {
      features: fallback,
      fetchedAt: new Date().toISOString(),
      dataSource: 'synthetic-fallback',
      weatherContext: fallbackContext,
    }
  }
}

export async function searchLocations(query, count = 5) {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return []
  }

  try {
    const response = await fetch(
      `${GEOCODING_API_URL}?name=${encodeURIComponent(trimmed)}&count=${count}&language=en&format=json`,
      { next: { revalidate: 3600 } },
    )
    if (!response.ok) {
      throw new Error('Location search failed')
    }
    const payload = await response.json()
    return (payload.results || []).map((item) => ({
      name: item.name ?? null,
      country: item.country ?? null,
      admin1: item.admin1 ?? null,
      latitude: item.latitude,
      longitude: item.longitude,
      elevation: item.elevation ?? null,
      timezone: item.timezone ?? null,
    }))
  } catch {
    return []
  }
}

export async function reverseLocation(latitude, longitude) {
  const fallbackName = `Selected point (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`

  try {
    const response = await fetch(
      `${REVERSE_GEOCODING_API_URL}?lat=${latitude}&lon=${longitude}&format=jsonv2&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'MapSense/1.0',
        },
        next: { revalidate: 3600 },
      },
    )

    if (!response.ok) {
      throw new Error('Reverse geocoding failed')
    }

    const payload = await response.json()
    const address = payload.address || {}
    const locality =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      address.state_district
    const admin1 = address.state || address.region || null
    const country = address.country || null
    const name = [locality, admin1, country].filter(Boolean).filter((item, index, array) => array.indexOf(item) === index).join(', ')

    return {
      name: name || fallbackName,
      country,
      admin1,
      latitude,
      longitude,
    }
  } catch {
    return {
      name: fallbackName,
      country: null,
      admin1: null,
      latitude,
      longitude,
    }
  }
}
