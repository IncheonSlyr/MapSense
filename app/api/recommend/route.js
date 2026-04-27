import { NextResponse } from 'next/server'
import { buildRecommendation } from '@/lib/engine'
import { fetchConditions } from '@/lib/services'

export async function POST(request) {
  try {
    const payload = await request.json()
    const latitude = Number(payload.latitude)
    const longitude = Number(payload.longitude)
    const demandKw = Number(payload.demand_kw)
    const locationName = payload.location_name || null

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return NextResponse.json({ error: 'Latitude must be between -90 and 90.' }, { status: 400 })
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Longitude must be between -180 and 180.' }, { status: 400 })
    }
    if (!Number.isFinite(demandKw) || demandKw <= 0 || demandKw > 10000) {
      return NextResponse.json({ error: 'Demand must be between 1 and 10000 kW.' }, { status: 400 })
    }

    const liveConditions = await fetchConditions(latitude, longitude)
    const recommendation = buildRecommendation({
      latitude,
      longitude,
      demandKw,
      locationName,
      dataSource: liveConditions.dataSource,
      fetchedAt: liveConditions.fetchedAt,
      weatherContext: liveConditions.weatherContext,
      sample: liveConditions.features,
    })

    return NextResponse.json(recommendation)
  } catch {
    return NextResponse.json({ error: 'Unable to compute recommendation right now.' }, { status: 500 })
  }
}
