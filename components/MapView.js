'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MapView({ latitude, longitude, label, onSelectLocation }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) {
      return undefined
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([latitude, longitude], 4)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution:
        '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map)

    const marker = L.marker([latitude, longitude], {
      icon: L.divIcon({
        className: 'mapsense-pin-wrapper',
        html: '<div class="mapsense-pin"><span></span></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    }).addTo(map)

    marker.bindTooltip(label, {
      direction: 'top',
      offset: [0, -10],
      opacity: 0.95,
    })

    map.on('click', (event) => {
      onSelectLocation({
        latitude: Number(event.latlng.lat.toFixed(4)),
        longitude: Number(event.latlng.lng.toFixed(4)),
      })
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [label, latitude, longitude, onSelectLocation])

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) {
      return
    }

    mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom(), {
      animate: true,
    })
    markerRef.current.setLatLng([latitude, longitude])
    markerRef.current.bindTooltip(label, {
      direction: 'top',
      offset: [0, -10],
      opacity: 0.95,
    })
  }, [label, latitude, longitude])

  return <div ref={mapRef} className="actual-map" aria-label="Location map" />
}
