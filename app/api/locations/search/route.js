import { NextResponse } from 'next/server'
import { searchLocations } from '@/lib/services'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const count = Number(searchParams.get('count') || '5')
  const items = await searchLocations(query, count)
  return NextResponse.json(items)
}
