import { NextResponse } from 'next/server'
import { reverseLocation } from '@/lib/services'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const latitude = Number(searchParams.get('latitude'))
  const longitude = Number(searchParams.get('longitude'))

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return NextResponse.json({ error: 'Latitude must be between -90 and 90.' }, { status: 400 })
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Longitude must be between -180 and 180.' }, { status: 400 })
  }

  const item = await reverseLocation(latitude, longitude)
  return NextResponse.json(item)
}
