const ENERGY_SOURCES = ['Solar', 'Wind', 'Hydro']

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value))
}

export function estimateFeatures(latitude, longitude) {
  const lat = (latitude * Math.PI) / 180
  const lon = (longitude * Math.PI) / 180

  const solarIrradiance = clamp(
    4 + 1.8 * Math.cos(lat) + 0.45 * Math.sin(lon * 1.7) - 0.25 * Math.abs(latitude) / 90,
    2.4,
    7.2,
  )
  const windSpeed = clamp(
    3.2 + 2.5 * Math.abs(Math.sin(lat * 1.4)) + 1.1 * Math.abs(Math.cos(lon * 1.8)),
    1.5,
    9.8,
  )
  const elevation = clamp(
    250 + 1950 * Math.abs(Math.sin(lat) * Math.cos(lon * 0.6)),
    0,
    3200,
  )
  const waterAvailability = clamp(
    35 + 42 * Math.abs(Math.sin(lat * 0.9 - lon * 0.2)) + 18 * Math.abs(Math.cos(lon * 1.3)),
    10,
    100,
  )
  const temperature = clamp(
    30 - (Math.abs(latitude) / 90) * 24 + 4 * Math.sin(lon),
    -5,
    38,
  )
  const pressure = clamp(1013.25 - elevation * 0.09, 700, 1015)

  return {
    solar_irradiance: Number(solarIrradiance.toFixed(2)),
    wind_speed: Number(windSpeed.toFixed(2)),
    elevation: Number(elevation.toFixed(2)),
    water_availability: Number(waterAvailability.toFixed(2)),
    temperature: Number(temperature.toFixed(2)),
    pressure: Number(pressure.toFixed(2)),
  }
}

function sourceMetrics(sample, demandKw) {
  const boundedDemand = clamp(demandKw, 1, 10000)
  const normalizedDemand = clamp((boundedDemand - 50) / 950, 0, 1)

  const resourceScores = {
    Solar: clamp(
      0.58 * (sample.solar_irradiance / 7.2) +
        0.16 * (1 - Math.abs(sample.temperature - 24) / 24) +
        0.12 * (sample.elevation / 3200) +
        0.14 * (1 - sample.water_availability / 100),
      0.05,
      0.99,
    ),
    Wind: clamp(
      0.62 * (sample.wind_speed / 9.8) +
        0.12 * (sample.pressure / 1015) +
        0.1 * (1 - Math.abs(sample.temperature - 18) / 30) +
        0.16 * (sample.elevation / 3200),
      0.05,
      0.99,
    ),
    Hydro: clamp(
      0.52 * (sample.water_availability / 100) +
        0.3 * (sample.elevation / 3200) +
        0.1 * (sample.pressure / 1015) +
        0.08 * (1 - Math.abs(sample.temperature - 16) / 28),
      0.05,
      0.99,
    ),
  }

  const capacityFactors = {
    Solar: clamp(
      0.13 + 0.19 * (sample.solar_irradiance - 2.4) / 4.8 - 0.02 * Math.abs(sample.temperature - 24) / 20,
      0.12,
      0.32,
    ),
    Wind: clamp(
      0.16 + 0.24 * (sample.wind_speed - 1.5) / 8.3 + 0.03 * (sample.pressure - 700) / 315,
      0.15,
      0.46,
    ),
    Hydro: clamp(
      0.26 + 0.28 * (sample.water_availability / 100) + 0.06 * (sample.elevation / 3200),
      0.28,
      0.64,
    ),
  }

  const resourceOutputKw = {
    Solar:
      45 +
      22 * sample.solar_irradiance +
      0.05 * sample.elevation -
      0.25 * Math.max(sample.temperature - 32, 0),
    Wind:
      25 +
      17.5 * sample.wind_speed +
      0.02 * sample.elevation +
      0.04 * Math.max(sample.pressure - 850, 0),
    Hydro: 18 + 0.9 * sample.water_availability + 0.06 * sample.elevation,
  }

  const scalability = {
    Solar: clamp(0.96 - 0.12 * normalizedDemand, 0.74, 0.98),
    Wind: clamp(0.72 + 0.18 * normalizedDemand, 0.7, 0.92),
    Hydro: clamp(0.58 + 0.3 * normalizedDemand, 0.55, 0.91),
  }

  const reliability = {
    Solar: clamp(0.54 + 0.22 * resourceScores.Solar, 0.52, 0.82),
    Wind: clamp(0.57 + 0.22 * resourceScores.Wind, 0.55, 0.85),
    Hydro: clamp(0.66 + 0.2 * resourceScores.Hydro, 0.64, 0.92),
  }

  const capexPerKw = { Solar: 920, Wind: 1480, Hydro: 2180 }
  const omRate = { Solar: 0.018, Wind: 0.026, Hydro: 0.034 }
  const electricityValuePerKwh = 0.082
  const rationale = {
    Solar: 'Solar resource, moderate temperature, and modular deployment make photovoltaics a strong fit here.',
    Wind: 'Wind speed and pressure support turbine performance with good scalability for higher demand.',
    Hydro: 'Water availability and elevation create usable hydraulic head, but economics depend on site conditions.',
  }

  return Object.fromEntries(
    ENERGY_SOURCES.map((source) => {
      const rawOutput = Math.max(18, resourceOutputKw[source])
      const usableOutput = Math.min(rawOutput, boundedDemand * 1.35)
      const demandFit = clamp(1 - Math.abs(rawOutput - boundedDemand) / Math.max(boundedDemand * 1.15, 80), 0.2, 1)
      const annualEnergyKwh = usableOutput * capacityFactors[source] * 8760
      const annualValue = annualEnergyKwh * electricityValuePerKwh
      const totalCapex = usableOutput * capexPerKw[source]
      const annualOm = totalCapex * omRate[source]
      const roiYears = totalCapex / Math.max(annualValue - annualOm, 1)
      const roiScore = clamp(1 - (roiYears - 4) / 18, 0, 1)
      const finalScore = clamp(
        0.5 * resourceScores[source] +
          0.24 * demandFit +
          0.14 * scalability[source] +
          0.08 * reliability[source] +
          0.04 * roiScore,
        0.05,
        0.99,
      )

      return [
        source,
        {
          score: finalScore,
          expected_efficiency: capacityFactors[source],
          estimated_output_kw: usableOutput,
          roi_years: roiYears,
          rationale: rationale[source],
        },
      ]
    }),
  )
}

export function buildRecommendation({
  latitude,
  longitude,
  demandKw,
  locationName,
  dataSource = 'synthetic-estimate',
  fetchedAt = null,
  weatherContext = {},
  sample,
}) {
  const features = sample || estimateFeatures(latitude, longitude)
  const metrics = sourceMetrics(features, demandKw)

  const rankings = Object.entries(metrics)
    .sort((left, right) => right[1].score - left[1].score)
    .map(([source, values]) => ({
      source,
      score: Number((values.score * 100).toFixed(1)),
      expected_efficiency: Number((values.expected_efficiency * 100).toFixed(1)),
      estimated_output_kw: Number(values.estimated_output_kw.toFixed(1)),
      roi_years: Number(values.roi_years.toFixed(1)),
      rationale: values.rationale,
    }))

  const bestItem = rankings[0]
  const secondScore = rankings[1] ? rankings[1].score : bestItem.score
  const margin = (bestItem.score - secondScore) / 100
  const confidence = clamp(0.46 + bestItem.score / 100 * 0.28 + margin * 0.7, 0.35, 0.97)

  return {
    id: Date.now(),
    location: { latitude, longitude },
    location_name: locationName,
    demand_kw: demandKw,
    best_source: bestItem.source,
    confidence: Number((confidence * 100).toFixed(1)),
    summary: `${bestItem.source} is the strongest fit here with an estimated ${bestItem.expected_efficiency}% efficiency and ${bestItem.estimated_output_kw} kW output potential.`,
    data_source: dataSource,
    fetched_at: fetchedAt,
    weather_context: weatherContext,
    estimated_features: features,
    rankings,
  }
}
