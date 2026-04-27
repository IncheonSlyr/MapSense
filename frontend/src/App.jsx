import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

const initialForm = {
  location_name: 'Jaisalmer, India',
  latitude: 26.9157,
  longitude: 70.9083,
  demand_kw: 180,
}

const presets = [
  { name: 'Jaisalmer, India', ...initialForm },
  { name: 'Copenhagen, Denmark', location_name: 'Copenhagen, Denmark', latitude: 55.6761, longitude: 12.5683, demand_kw: 220 },
  { name: 'Reykjavik, Iceland', location_name: 'Reykjavik, Iceland', latitude: 64.1466, longitude: -21.9426, demand_kw: 160 },
  { name: 'Nairobi, Kenya', location_name: 'Nairobi, Kenya', latitude: -1.2864, longitude: 36.8172, demand_kw: 200 },
]

const featureLabels = {
  solar_irradiance: 'Solar irradiance',
  wind_speed: 'Wind speed',
  elevation: 'Elevation',
  water_availability: 'Water availability',
  temperature: 'Temperature',
  pressure: 'Pressure',
}

const weatherLabels = {
  temperature_2m: 'Live temperature',
  wind_speed_10m: 'Live wind speed',
  surface_pressure: 'Surface pressure',
  shortwave_radiation_sum: 'Solar radiation',
  precipitation_sum: 'Precipitation',
  timezone: 'Timezone',
}

const weatherConfig = {
  temperature_2m: { label: 'Temperature', unit: 'deg C', tone: 'peach', icon: 'T' },
  wind_speed_10m: { label: 'Wind speed', unit: 'm/s', tone: 'sky', icon: 'W' },
  surface_pressure: { label: 'Pressure', unit: 'hPa', tone: 'slate', icon: 'P' },
  shortwave_radiation_sum: { label: 'Solar radiation', unit: 'MJ/m2', tone: 'butter', icon: 'S' },
  precipitation_sum: { label: 'Precipitation', unit: 'mm', tone: 'mint', icon: 'R' },
  timezone: { label: 'Timezone', unit: '', tone: 'lavender', icon: 'Z' },
}

const sourceClassName = {
  Solar: 'source-solar',
  Wind: 'source-wind',
  Hydro: 'source-hydro',
}

const siteGroups = [
  {
    key: 'Solar',
    tone: 'butter',
    title: 'Solar relevance',
    summary: 'Radiation, temperature, and elevation shape photovoltaic potential.',
    fields: ['solar_irradiance', 'temperature', 'elevation'],
  },
  {
    key: 'Wind',
    tone: 'sky',
    title: 'Wind relevance',
    summary: 'Wind speed, pressure, and terrain support turbine performance.',
    fields: ['wind_speed', 'pressure', 'elevation'],
  },
  {
    key: 'Hydro',
    tone: 'mint',
    title: 'Hydro relevance',
    summary: 'Water availability and elevation indicate useful hydraulic head.',
    fields: ['water_availability', 'elevation', 'pressure'],
  },
]

function buildSourceChartData(result) {
  if (!result) {
    return []
  }

  return result.rankings.map((item) => ({
    label: item.source,
    score: item.score,
    output: item.estimated_output_kw,
    efficiency: item.expected_efficiency,
  }))
}

function buildRoiChartData(result) {
  if (!result) {
    return []
  }

  return result.rankings.map((item) => ({
    label: item.source,
    roi: item.roi_years,
    score: item.score,
  }))
}

function formatMetric(value, suffix = '') {
  return `${Number(value).toFixed(1)}${suffix}`
}

function formatWeatherValue(key, value) {
  const config = weatherConfig[key]
  if (!config) {
    return String(value)
  }
  if (typeof value === 'string') {
    return value
  }
  return `${Number(value).toFixed(1)}${config.unit ? ` ${config.unit}` : ''}`
}

function SourceComparisonChart({ items }) {
  if (items.length === 0) {
    return <p className="helper-copy">Run an analysis to compare sources.</p>
  }

  const chartHeight = 220
  const yAxisTicks = [0, 25, 50, 75, 100]

  return (
    <section className="data-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Source</p>
          <h3>Source Comparison</h3>
        </div>
        <p className="panel-copy">Score, output, and efficiency for the current site.</p>
      </div>
      <div className="stat-chart" role="img" aria-label="Source comparison chart">
        <div className="stat-axis">
          {yAxisTicks.slice().reverse().map((tick) => (
            <span key={tick}>{tick}%</span>
          ))}
        </div>
        <div className="stat-plot" style={{ height: chartHeight }}>
          {yAxisTicks.map((tick) => (
            <div key={tick} className="stat-gridline" style={{ bottom: `${tick}%` }} />
          ))}
          <div className="stat-bars">
            {items.map((item) => (
              <div key={item.label} className={`stat-bar-group ${sourceClassName[item.label] || ''}`}>
                <div className="stat-bar-head">
                  <span>{item.label}</span>
                  <strong>{item.score}%</strong>
                </div>
                <div className="stat-bar-shell">
                  <div className="stat-bar-fill" style={{ height: `${item.score}%` }} />
                </div>
                <div className="stat-bar-foot">
                  <span>{item.output} kW</span>
                  <span>{item.efficiency}% eff.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RoiComparisonChart({ items }) {
  if (items.length === 0) {
    return <p className="helper-copy">Run an analysis to compare ROI across sources.</p>
  }

  const maxRoi = Math.max(...items.map((item) => item.roi), 1)

  return (
    <section className="data-panel">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Economics</p>
          <h3>ROI Comparison</h3>
        </div>
        <p className="panel-copy">Lower payback years are generally a stronger financial fit.</p>
      </div>
      <div className="roi-chart" role="img" aria-label="ROI comparison chart">
        {items.map((item) => (
          <div key={item.label} className={`roi-row ${sourceClassName[item.label] || ''}`}>
            <div className="roi-meta">
              <strong>{item.label}</strong>
              <span>{item.score}% score</span>
            </div>
            <div className="roi-track">
              <div className="roi-fill" style={{ width: `${(item.roi / maxRoi) * 100}%` }} />
            </div>
            <strong className="roi-value">{item.roi} yrs</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function ActualMap({ latitude, longitude, label, onSelectLocation }) {
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
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map)

    const marker = L.marker([latitude, longitude]).addTo(map)
    marker.bindPopup(label)

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
    markerRef.current.bindPopup(label)
  }, [label, latitude, longitude])

  return <div ref={mapRef} className="actual-map" aria-label="Location map" />
}

function HistorySidebar({ history, historyLoading, onSelect }) {
  const [openId, setOpenId] = useState(null)

  return (
    <aside className="history-sidebar">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Saved Runs</p>
          <h3>History</h3>
        </div>
        <p className="panel-copy">Open any saved recommendation to inspect its inputs.</p>
      </div>

      {historyLoading ? <p className="helper-copy">Loading history...</p> : null}
      {!historyLoading && history.length === 0 ? <p className="helper-copy">No saved recommendations yet.</p> : null}

      <div className="history-list">
        {history.map((item) => {
          const isOpen = openId === item.id
          return (
            <div key={item.id} className="history-item">
              <button
                type="button"
                className="history-item-toggle"
                onClick={() => setOpenId(isOpen ? null : item.id)}
              >
                <div>
                  <strong>{item.location_name || `Saved site #${item.id}`}</strong>
                  <span>{item.best_source} / {item.confidence}% confidence</span>
                </div>
                <span>{isOpen ? '-' : '+'}</span>
              </button>

              {isOpen ? (
                <div className="history-item-body">
                  <button type="button" className="inline-button" onClick={() => onSelect(item)}>
                    Load recommendation
                  </button>
                  <div className="parameter-grid">
                    <div>
                      <span>Latitude</span>
                      <strong>{item.location.latitude}</strong>
                    </div>
                    <div>
                      <span>Longitude</span>
                      <strong>{item.location.longitude}</strong>
                    </div>
                    <div>
                      <span>Demand</span>
                      <strong>{item.demand_kw} kW</strong>
                    </div>
                    <div>
                      <span>Source</span>
                      <strong>{item.data_source}</strong>
                    </div>
                  </div>
                  <div className="parameter-grid">
                    {Object.entries(item.estimated_features || {}).slice(0, 4).map(([key, value]) => (
                      <div key={key}>
                        <span>{featureLabels[key] || key}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [searchText, setSearchText] = useState(initialForm.location_name)
  const [searchResults, setSearchResults] = useState([])
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inputsOpen, setInputsOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [resolvingLocation, setResolvingLocation] = useState(false)
  const [error, setError] = useState('')
  const [detailView, setDetailView] = useState('source')
  const reverseLookupIdRef = useRef(0)
  const suppressSearchRef = useRef(false)

  async function fetchHistory() {
    setHistoryLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/history?limit=8`)
      if (!response.ok) {
        throw new Error('Unable to load saved history.')
      }
      const data = await response.json()
      setHistory(data.items)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function requestRecommendation(nextForm) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextForm),
      })
      if (!response.ok) {
        throw new Error('Unable to fetch recommendation right now.')
      }
      const data = await response.json()
      setResult(data)
      await fetchHistory()
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.body.style.overflow = historyOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [historyOpen])

  useEffect(() => {
    let isActive = true

    async function bootstrap() {
      try {
        const [recommendationResponse, historyResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(initialForm),
          }),
          fetch(`${apiBaseUrl}/api/history?limit=8`),
        ])

        if (!recommendationResponse.ok) {
          throw new Error('Unable to fetch recommendation right now.')
        }

        const recommendationData = await recommendationResponse.json()
        const historyData = historyResponse.ok ? await historyResponse.json() : { items: [] }

        if (isActive) {
          setResult(recommendationData)
          setHistory(historyData.items)
        }
      } catch (fetchError) {
        if (isActive) {
          setError(fetchError.message)
        }
      } finally {
        if (isActive) {
          setLoading(false)
          setHistoryLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const trimmed = searchText.trim()
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false
      return
    }

    if (trimmed.length < 2 || trimmed.startsWith('Selected point (')) {
      return
    }

    const controller = new AbortController()
    const timerId = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/locations/search?q=${encodeURIComponent(trimmed)}&count=5`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error('Unable to search locations.')
        }
        const data = await response.json()
        setSearchResults(data)
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') {
          setSearchResults([])
        }
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timerId)
    }
  }, [searchText])

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === 'location_name' ? value : Number(value),
    }))
  }

  function applyPreset(preset) {
    const nextForm = {
      location_name: preset.location_name,
      latitude: preset.latitude,
      longitude: preset.longitude,
      demand_kw: preset.demand_kw,
    }
    suppressSearchRef.current = true
    setForm(nextForm)
    setSearchText(preset.location_name)
    setSearchResults([])
    requestRecommendation(nextForm)
  }

  function applySearchResult(item) {
    const locationLabel = [item.name, item.admin1, item.country].filter(Boolean).join(', ')
    const nextForm = {
      ...form,
      location_name: locationLabel,
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    }
    setForm(nextForm)
    setSearchText(locationLabel)
    setSearchResults([])
  }

  function loadHistoryItem(item) {
    const nextForm = {
      location_name: item.location_name || `Saved site #${item.id}`,
      latitude: Number(item.location.latitude),
      longitude: Number(item.location.longitude),
      demand_kw: Number(item.demand_kw),
    }
    suppressSearchRef.current = true
    setForm(nextForm)
    setSearchText(nextForm.location_name)
    setResult(item)
    setHistoryOpen(false)
  }

  async function handleMapSelect({ latitude, longitude }) {
    const requestId = reverseLookupIdRef.current + 1
    reverseLookupIdRef.current = requestId
    setResolvingLocation(true)

    const fallbackName = `Selected point (${latitude}, ${longitude})`
    suppressSearchRef.current = true
    setForm((current) => ({
      ...current,
      latitude,
      longitude,
      location_name: fallbackName,
    }))
    setSearchText(fallbackName)
    setSearchResults([])

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/locations/reverse?latitude=${latitude}&longitude=${longitude}`,
      )
      if (!response.ok) {
        throw new Error('Unable to resolve location name.')
      }

      const data = await response.json()
      if (reverseLookupIdRef.current !== requestId) {
        return
      }

      setForm((current) => ({
        ...current,
        latitude,
        longitude,
        location_name: data.name || fallbackName,
      }))
      suppressSearchRef.current = true
      setSearchText(data.name || fallbackName)
    } catch {
      if (reverseLookupIdRef.current === requestId) {
        suppressSearchRef.current = true
        setSearchText(fallbackName)
      }
    } finally {
      if (reverseLookupIdRef.current === requestId) {
        setResolvingLocation(false)
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    requestRecommendation(form)
  }

  const sourceChartData = buildSourceChartData(result)
  const roiChartData = buildRoiChartData(result)

  return (
    <main className="app-shell">
      <header className="hero-strip">
        <div>
          <p className="hero-kicker">Renewable Energy System</p>
          <h1>MapSense</h1>
          <p className="hero-copy">
            Click the map or search a place, adjust the core inputs, and compare the best-fit renewable source with supporting data.
          </p>
        </div>
        <div className="top-toolbar">
          <button
            type="button"
            className={`toolbar-button ${inputsOpen ? 'active' : ''}`}
            onClick={() => setInputsOpen((current) => !current)}
          >
            {inputsOpen ? 'Hide parameters' : 'Show parameters'}
          </button>
          <button type="button" className="toolbar-button" onClick={() => setHistoryOpen(true)}>
            Saved history
          </button>
        </div>
      </header>

      <div
        className={`sidebar-overlay ${historyOpen ? 'visible' : ''}`}
        onClick={() => setHistoryOpen(false)}
        aria-hidden={historyOpen ? 'false' : 'true'}
      />

      <aside className={`sidebar-drawer ${historyOpen ? 'open' : ''}`}>
        <div className="sidebar-drawer-header">
          <div>
            <p className="section-kicker">Saved Runs</p>
            <h2>Recommendation History</h2>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close history sidebar"
          >
            x
          </button>
        </div>
        <HistorySidebar history={history} historyLoading={historyLoading} onSelect={loadHistoryItem} />
      </aside>

      <section className={`workspace-grid ${inputsOpen ? '' : 'map-only'}`}>
        <section className="map-stage">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">Map</p>
              <h2>{form.location_name || 'Selected location'}</h2>
            </div>
            <p className="panel-copy">
              {resolvingLocation ? 'Resolving place name...' : 'Click anywhere on the map to update the location.'}
            </p>
          </div>
          <ActualMap
            latitude={form.latitude}
            longitude={form.longitude}
            label={form.location_name || 'Selected location'}
            onSelectLocation={handleMapSelect}
          />
        </section>

        {inputsOpen ? (
          <form className="parameter-panel" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Parameters</p>
                <h2>Input controls</h2>
              </div>
              <p className="panel-copy">Map on the left, input controls on the right.</p>
            </div>

            <div className="preset-row">
              {presets.map((preset) => (
                <button key={preset.name} type="button" className="preset-chip" onClick={() => applyPreset(preset)}>
                  {preset.name}
                </button>
              ))}
            </div>

            <label>
              Search by city
              <input
                type="text"
                value={searchText}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setSearchText(nextValue)
                  updateField('location_name', nextValue)
                  if (nextValue.trim().length < 2) {
                    setSearchResults([])
                  }
                }}
                placeholder="Search city or region"
              />
            </label>

            {searchLoading ? <p className="helper-copy">Searching locations...</p> : null}
            {searchResults.length > 0 ? (
              <div className="search-results">
                {searchResults.map((item) => (
                  <button
                    key={`${item.name}-${item.latitude}-${item.longitude}`}
                    type="button"
                    className="search-result"
                    onClick={() => applySearchResult(item)}
                  >
                    <strong>{item.name}</strong>
                    <span>{[item.admin1, item.country].filter(Boolean).join(', ')}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <label>
              Location label
              <input
                type="text"
                value={form.location_name}
                onChange={(event) => updateField('location_name', event.target.value)}
                placeholder="Project site name"
              />
            </label>

            <div className="input-row">
              <label>
                Latitude
                <input
                  type="number"
                  step="0.0001"
                  min="-90"
                  max="90"
                  value={form.latitude}
                  onChange={(event) => updateField('latitude', event.target.value)}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="0.0001"
                  min="-180"
                  max="180"
                  value={form.longitude}
                  onChange={(event) => updateField('longitude', event.target.value)}
                />
              </label>
            </div>

            <label>
              Estimated demand (kW)
              <input
                type="number"
                step="1"
                min="1"
                max="10000"
                value={form.demand_kw}
                onChange={(event) => updateField('demand_kw', event.target.value)}
              />
            </label>

            <button type="submit" className="inline-button action-button">
              Analyze site
            </button>
            {error ? <p className="error-copy">{error}</p> : null}
          </form>
        ) : null}
      </section>

      <section className="results-section">
        {loading ? <p className="status-copy">Analyzing location conditions...</p> : null}
        {!loading && result ? (
          <>
            <section className="summary-strip">
              <div className="summary-intro">
                <p className="section-kicker">Best Recommendation</p>
                <h2>{result.best_source}</h2>
                <p className="hero-copy">{result.summary}</p>
                <div className="summary-meta">
                  <span>{result.location_name || 'Unnamed site'}</span>
                  <span>{result.data_source}</span>
                  <span>{result.demand_kw} kW demand</span>
                </div>
              </div>
              <div className="summary-stats">
                <div>
                  <span>Confidence</span>
                  <strong>{result.confidence}%</strong>
                </div>
                <div>
                  <span>Output</span>
                  <strong>{result.rankings[0]?.estimated_output_kw} kW</strong>
                </div>
                <div>
                  <span>Efficiency</span>
                  <strong>{result.rankings[0]?.expected_efficiency}%</strong>
                </div>
              </div>
            </section>

            <section className="rank-grid">
              {result.rankings.map((item) => (
                <article key={item.source} className={`rank-row ${item.source === result.best_source ? 'winner' : ''}`}>
                  <div className="rank-title">
                    <h3>{item.source}</h3>
                    <span>{item.rationale}</span>
                  </div>
                  <div className="rank-measure">
                    <span>Score</span>
                    <strong>{item.score}%</strong>
                  </div>
                  <div className="rank-measure">
                    <span>Output</span>
                    <strong>{item.estimated_output_kw} kW</strong>
                  </div>
                  <div className="rank-measure">
                    <span>Efficiency</span>
                    <strong>{item.expected_efficiency}%</strong>
                  </div>
                  <div className="rank-measure">
                    <span>ROI</span>
                    <strong>{item.roi_years} yrs</strong>
                  </div>
                </article>
              ))}
            </section>

            <section className="details-shell">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">Support Data</p>
                  <h2>Supporting views</h2>
                </div>
                <div className="segmented-control" role="tablist" aria-label="Detail views">
                  <button type="button" className={detailView === 'source' ? 'active' : ''} onClick={() => setDetailView('source')}>
                    Source
                  </button>
                  <button type="button" className={detailView === 'history' ? 'active' : ''} onClick={() => setDetailView('history')}>
                    ROI
                  </button>
                  <button type="button" className={detailView === 'weather' ? 'active' : ''} onClick={() => setDetailView('weather')}>
                    Weather
                  </button>
                  <button type="button" className={detailView === 'features' ? 'active' : ''} onClick={() => setDetailView('features')}>
                    Site
                  </button>
                </div>
              </div>

              {detailView === 'source' ? <SourceComparisonChart items={sourceChartData} /> : null}
              {detailView === 'history' ? <RoiComparisonChart items={roiChartData} /> : null}
              {detailView === 'weather' ? (
                <section className="data-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="section-kicker">Weather</p>
                      <h3>Live conditions</h3>
                    </div>
                    <p className="panel-copy">Latest weather context used by the engine.</p>
                  </div>
                  <div className="weather-widget">
                    <div className="weather-widget-main tone-sky">
                      <div className="weather-widget-top">
                        <span className="weather-chip">Live weather</span>
                        <span className="weather-chip subtle">{result.weather_context.timezone || 'Local timezone'}</span>
                      </div>
                      <div className="weather-widget-body">
                        <div>
                          <span className="weather-overline">{result.location_name || 'Selected site'}</span>
                          <strong>{formatWeatherValue('temperature_2m', result.weather_context.temperature_2m ?? 0)}</strong>
                        </div>
                        <div className="weather-widget-mini">
                          <article className="weather-mini-card tone-mint">
                            <span>Wind</span>
                            <strong>{formatWeatherValue('wind_speed_10m', result.weather_context.wind_speed_10m ?? 0)}</strong>
                          </article>
                          <article className="weather-mini-card tone-butter">
                            <span>Radiation</span>
                            <strong>{formatWeatherValue('shortwave_radiation_sum', result.weather_context.shortwave_radiation_sum ?? 0)}</strong>
                          </article>
                        </div>
                      </div>
                    </div>
                    <div className="weather-widget-stats">
                      {Object.entries(result.weather_context).map(([key, value]) => {
                        const config = weatherConfig[key] || { label: weatherLabels[key] || key, tone: 'slate', icon: '*' }
                        return (
                          <article key={key} className={`weather-stat tone-${config.tone}`}>
                            <span className="weather-icon">{config.icon}</span>
                            <div>
                              <span>{config.label}</span>
                              <strong>{formatWeatherValue(key, value)}</strong>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                </section>
              ) : null}
              {detailView === 'features' ? (
                <section className="data-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="section-kicker">Site</p>
                      <h3>Estimated parameters</h3>
                    </div>
                    <p className="panel-copy">Normalized features passed into the recommendation engine.</p>
                  </div>
                  <div className="site-profile">
                    <div className="site-profile-hero tone-lavender">
                      <div>
                        <span className="weather-overline">Model input profile</span>
                        <strong>{result.location_name || 'Selected site'}</strong>
                        <p className="panel-copy">Key geographic and environmental parameters driving the recommendation.</p>
                      </div>
                      <div className="site-profile-badges">
                        <span className="site-badge tone-butter">{formatMetric(result.estimated_features.solar_irradiance)} solar</span>
                        <span className="site-badge tone-sky">{formatMetric(result.estimated_features.wind_speed)} wind</span>
                        <span className="site-badge tone-mint">{formatMetric(result.estimated_features.water_availability)} water</span>
                      </div>
                    </div>
                    <div className="site-group-grid">
                      {siteGroups.map((group) => (
                        <article key={group.key} className={`site-group-card tone-${group.tone}`}>
                          <div className="site-group-head">
                            <h4>{group.title}</h4>
                            <p>{group.summary}</p>
                          </div>
                          <div className="site-group-list">
                            {group.fields.map((field) => (
                              <div key={`${group.key}-${field}`} className="site-group-row">
                                <span>{featureLabels[field] || field}</span>
                                <strong>{formatMetric(result.estimated_features[field])}</strong>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="site-parameter-board">
                      {Object.entries(result.estimated_features).map(([key, value]) => (
                        <article key={key} className="site-parameter-row">
                          <span>{featureLabels[key] || key}</span>
                          <strong>{formatMetric(value)}</strong>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default App
