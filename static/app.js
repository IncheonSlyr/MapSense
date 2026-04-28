const initialForm = {
  location_name: 'Jaisalmer, India',
  latitude: 26.9157,
  longitude: 70.9083,
  demand_kw: 180,
  budget_usd: 260000,
  land_acres: 5.2,
  strategy: 'balanced',
}

const presets = [
  { name: 'Jaisalmer, India', ...initialForm },
  {
    name: 'Copenhagen, Denmark',
    location_name: 'Copenhagen, Denmark',
    latitude: 55.6761,
    longitude: 12.5683,
    demand_kw: 220,
    budget_usd: 380000,
    land_acres: 8.2,
    strategy: 'resilience',
  },
  {
    name: 'Reykjavik, Iceland',
    location_name: 'Reykjavik, Iceland',
    latitude: 64.1466,
    longitude: -21.9426,
    demand_kw: 160,
    budget_usd: 420000,
    land_acres: 4.5,
    strategy: 'balanced',
  },
  {
    name: 'Nairobi, Kenya',
    location_name: 'Nairobi, Kenya',
    latitude: -1.2864,
    longitude: 36.8172,
    demand_kw: 200,
    budget_usd: 290000,
    land_acres: 6.5,
    strategy: 'roi',
  },
]

const featureLabels = {
  solar_irradiance: 'Solar irradiance',
  wind_speed: 'Wind speed',
  elevation: 'Elevation',
  water_availability: 'Water availability',
  temperature: 'Temperature',
  pressure: 'Pressure',
}

const weatherConfig = {
  temperature_2m: { label: 'Temperature', unit: 'deg C', tone: 'peach', icon: 'T' },
  wind_speed_10m: { label: 'Wind speed', unit: 'm/s', tone: 'sky', icon: 'W' },
  surface_pressure: { label: 'Pressure', unit: 'hPa', tone: 'slate', icon: 'P' },
  shortwave_radiation_sum: { label: 'Solar radiation', unit: 'MJ/m2', tone: 'butter', icon: 'S' },
  precipitation_sum: { label: 'Precipitation', unit: 'mm', tone: 'mint', icon: 'R' },
  timezone: { label: 'Timezone', unit: '', tone: 'lavender', icon: 'Z' },
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

const sourceStyles = {
  Solar: {
    solid: '#d9a441',
    soft: 'color-mix(in srgb, var(--accent-butter) 70%, white 30%)',
  },
  Wind: {
    solid: '#5a86b9',
    soft: 'color-mix(in srgb, var(--accent-sky) 76%, white 24%)',
  },
  Hydro: {
    solid: '#4f7d78',
    soft: 'color-mix(in srgb, var(--accent-mint) 76%, white 24%)',
  },
}

const strategyLabels = {
  balanced: 'Balanced',
  roi: 'Fast payback',
  resilience: 'Resilience',
  output: 'Maximum output',
}

const HISTORY_KEY = 'mapsense-history'

const state = {
  form: { ...initialForm },
  result: null,
  history: [],
  searchResults: [],
  searchTimer: null,
  searchRequest: null,
  reverseLookupId: 0,
  suppressSearch: false,
  detailView: 'source',
  inputsOpen: true,
  map: null,
  marker: null,
}

const elements = {
  workspaceGrid: document.getElementById('workspace-grid'),
  toggleParameters: document.getElementById('toggle-parameters'),
  openHistory: document.getElementById('open-history'),
  closeHistory: document.getElementById('close-history'),
  historyOverlay: document.getElementById('history-overlay'),
  historyDrawer: document.getElementById('history-drawer'),
  historyList: document.getElementById('history-list'),
  form: document.getElementById('recommendation-form'),
  presetRow: document.getElementById('preset-row'),
  searchInput: document.getElementById('search-input'),
  searchLoading: document.getElementById('search-loading'),
  searchResults: document.getElementById('search-results'),
  locationName: document.getElementById('location-name-input'),
  latitude: document.getElementById('latitude-input'),
  longitude: document.getElementById('longitude-input'),
  demand: document.getElementById('demand-input'),
  budget: document.getElementById('budget-input'),
  land: document.getElementById('land-input'),
  strategy: document.getElementById('strategy-input'),
  formError: document.getElementById('form-error'),
  loadingCopy: document.getElementById('loading-copy'),
  resultShell: document.getElementById('result-shell'),
  selectedLocationHeading: document.getElementById('selected-location-heading'),
  mapStatusCopy: document.getElementById('map-status-copy'),
  bestSourceName: document.getElementById('best-source-name'),
  recommendationSummary: document.getElementById('recommendation-summary'),
  summaryLocation: document.getElementById('summary-location'),
  summarySource: document.getElementById('summary-source'),
  summaryDemand: document.getElementById('summary-demand'),
  summaryConfidence: document.getElementById('summary-confidence'),
  summaryOutput: document.getElementById('summary-output'),
  summaryEfficiency: document.getElementById('summary-efficiency'),
  summaryCarbon: document.getElementById('summary-carbon'),
  plannerChipRow: document.getElementById('planner-chip-row'),
  plannerNoteList: document.getElementById('planner-note-list'),
  rankGrid: document.getElementById('rank-grid'),
  detailSource: document.getElementById('detail-source'),
  detailRoi: document.getElementById('detail-roi'),
  detailSeasonal: document.getElementById('detail-seasonal'),
  detailHybrid: document.getElementById('detail-hybrid'),
  detailWeather: document.getElementById('detail-weather'),
  detailSite: document.getElementById('detail-site'),
  segmentedButtons: Array.from(document.querySelectorAll('.segmented-control button')),
}

function readHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const items = raw ? JSON.parse(raw) : []
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

function writeHistory(items) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 10)))
}

function mergeHistory(nextItem) {
  const current = readHistory()
  const deduped = [nextItem, ...current].filter((item, index, array) => {
    const fingerprint = [
      item.location_name,
      item.location.latitude,
      item.location.longitude,
      item.demand_kw,
      item.scenario?.budget_usd,
      item.scenario?.land_acres,
      item.scenario?.strategy,
      item.fetched_at,
    ].join('|')
    return array.findIndex((candidate) => {
      const candidateFingerprint = [
        candidate.location_name,
        candidate.location.latitude,
        candidate.location.longitude,
        candidate.demand_kw,
        candidate.scenario?.budget_usd,
        candidate.scenario?.land_acres,
        candidate.scenario?.strategy,
        candidate.fetched_at,
      ].join('|')
      return candidateFingerprint === fingerprint
    }) === index
  })
  writeHistory(deduped)
  return deduped
}

function setForm(form) {
  state.form = { ...state.form, ...form }
  elements.locationName.value = state.form.location_name
  elements.latitude.value = state.form.latitude
  elements.longitude.value = state.form.longitude
  elements.demand.value = state.form.demand_kw
  elements.budget.value = state.form.budget_usd
  elements.land.value = state.form.land_acres
  elements.strategy.value = state.form.strategy
  elements.selectedLocationHeading.textContent = state.form.location_name || 'Selected location'
  if (state.marker) {
    state.marker.setLatLng([state.form.latitude, state.form.longitude])
    state.marker.bindTooltip(state.form.location_name || 'Selected location', {
      direction: 'top',
      offset: [0, -10],
      opacity: 0.95,
    })
  }
  if (state.map) {
    state.map.setView([state.form.latitude, state.form.longitude], state.map.getZoom(), { animate: true })
  }
}

function formatMetric(value, suffix = '') {
  return `${Number(value).toFixed(1)}${suffix}`
}

function formatInteger(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatWeatherValue(key, value) {
  const config = weatherConfig[key]
  if (!config) return String(value)
  if (typeof value === 'string') return value
  return `${Number(value).toFixed(1)}${config.unit ? ` ${config.unit}` : ''}`
}

function setLoading(loading) {
  elements.loadingCopy.classList.toggle('hidden', !loading)
}

function setError(message = '') {
  elements.formError.textContent = message
  elements.formError.classList.toggle('hidden', !message)
}

function renderHistory() {
  elements.historyList.innerHTML = ''
  if (state.history.length === 0) {
    elements.historyList.innerHTML = '<p class="helper-copy">No saved recommendations yet.</p>'
    return
  }

  state.history.forEach((item) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'history-item'
    wrapper.innerHTML = `
      <button type="button" class="history-item-toggle">
        <div>
          <strong>${item.location_name || 'Saved site'}</strong>
          <span>${item.best_source} / ${item.confidence}% confidence</span>
        </div>
        <span>${item.demand_kw} kW</span>
      </button>
      <div class="history-item-meta">
        <span>${formatCurrency(item.scenario?.budget_usd || 0)} budget</span>
        <span>${Number(item.scenario?.land_acres || 0).toFixed(1)} acres</span>
        <span>${strategyLabels[item.scenario?.strategy] || 'Balanced'}</span>
      </div>
    `
    wrapper.querySelector('button').addEventListener('click', () => {
      setForm({
        location_name: item.location_name || 'Saved site',
        latitude: Number(item.location.latitude),
        longitude: Number(item.location.longitude),
        demand_kw: Number(item.demand_kw),
        budget_usd: Number(item.scenario?.budget_usd || initialForm.budget_usd),
        land_acres: Number(item.scenario?.land_acres || initialForm.land_acres),
        strategy: item.scenario?.strategy || initialForm.strategy,
      })
      elements.searchInput.value = state.form.location_name
      state.result = item
      renderResult()
      closeHistoryDrawer()
    })
    elements.historyList.appendChild(wrapper)
  })
}

function renderRankings(rankings, bestSource) {
  elements.rankGrid.innerHTML = ''
  rankings.forEach((item) => {
    const article = document.createElement('article')
    article.className = `rank-row ${item.source === bestSource ? 'winner' : ''}`
    article.innerHTML = `
      <div class="rank-title">
        <h3>${item.source}</h3>
        <span>${item.rationale}</span>
      </div>
      <div class="rank-measure"><span>Score</span><strong>${item.score}%</strong></div>
      <div class="rank-measure"><span>Output</span><strong>${item.estimated_output_kw} kW</strong></div>
      <div class="rank-measure"><span>Payback</span><strong>${item.roi_years} yrs</strong></div>
      <div class="rank-measure"><span>Carbon</span><strong>${item.annual_carbon_offset_tons} t</strong></div>
    `
    elements.rankGrid.appendChild(article)
  })
}

function renderSourceChart(rankings) {
  elements.detailSource.innerHTML = `
    <section class="data-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Source</p>
          <h3>Source comparison</h3>
        </div>
        <p class="panel-copy">Suitability score, annual value, and planner fit for each source.</p>
      </div>
      <div class="stat-chart">
        <div class="stat-axis">${[100, 75, 50, 25, 0].map((tick) => `<span>${tick}%</span>`).join('')}</div>
        <div class="stat-plot">
          ${[0, 25, 50, 75, 100].map((tick) => `<div class="stat-gridline" style="bottom:${tick}%"></div>`).join('')}
          <div class="stat-bars">
            ${rankings.map((item) => `
              <div class="stat-bar-group">
                <div class="stat-bar-head"><span>${item.source}</span><strong>${item.score}%</strong></div>
                <div class="stat-bar-shell">
                  <div class="stat-bar-fill" style="height:${item.score}%;background:${sourceStyles[item.source].solid}"></div>
                </div>
                <div class="stat-bar-foot">
                  <span>${formatCurrency(item.annual_value_usd)}/yr</span>
                  <span>${item.budget_fit}% budget fit</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  `
}

function renderRoiChart(rankings) {
  const maxRoi = Math.max(...rankings.map((item) => item.roi_years), 1)
  elements.detailRoi.innerHTML = `
    <section class="data-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Economics</p>
          <h3>ROI comparison</h3>
        </div>
        <p class="panel-copy">Lower payback years are stronger. Capital and carbon are shown side by side.</p>
      </div>
      <div class="roi-chart">
        ${rankings.map((item) => `
          <div class="roi-row">
            <div class="roi-meta"><strong>${item.source}</strong><span>${formatCurrency(item.estimated_capex_usd)} capex</span></div>
            <div class="roi-track"><div class="roi-fill" style="width:${(item.roi_years / maxRoi) * 100}%;background:${sourceStyles[item.source].solid}"></div></div>
            <strong class="roi-value">${item.roi_years} yrs</strong>
          </div>
        `).join('')}
      </div>
      <div class="impact-grid">
        ${rankings.map((item) => `
          <article class="impact-card tone-${item.source === 'Solar' ? 'butter' : item.source === 'Wind' ? 'sky' : 'mint'}">
            <span>${item.source}</span>
            <strong>${formatInteger(item.annual_energy_kwh)} kWh</strong>
            <p>${item.annual_carbon_offset_tons} t CO2 avoided per year</p>
          </article>
        `).join('')}
      </div>
    </section>
  `
}

function renderSeasonalOutlook(seasonalOutlook) {
  const monthRows = seasonalOutlook.map((entry) => `
    <article class="season-row">
      <div class="season-month">
        <strong>${entry.month}</strong>
        <span>${entry.winner} leads</span>
      </div>
      <div class="season-tracks">
        ${entry.sources.map((source) => `
          <div class="season-track-row">
            <span>${source.source}</span>
            <div class="season-track">
              <div class="season-track-fill" style="width:${Math.min(source.efficiency, 100)}%;background:${sourceStyles[source.source].solid}"></div>
            </div>
            <strong>${source.output_kw} kW</strong>
          </div>
        `).join('')}
      </div>
    </article>
  `).join('')

  elements.detailSeasonal.innerHTML = `
    <section class="data-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Seasonal</p>
          <h3>Year-round performance</h3>
        </div>
        <p class="panel-copy">Monthly output shifts by source so you can spot seasonal handoffs.</p>
      </div>
      <div class="seasonal-grid">
        ${monthRows}
      </div>
    </section>
  `
}

function renderHybridPlan(hybridPlan) {
  elements.detailHybrid.innerHTML = `
    <section class="data-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Hybrid</p>
          <h3>${hybridPlan.label}</h3>
        </div>
        <p class="panel-copy">${hybridPlan.rationale}</p>
      </div>
      <div class="hybrid-layout">
        <article class="hybrid-hero tone-lavender">
          <div>
            <span class="weather-overline">Blended system recommendation</span>
            <strong>${hybridPlan.blended_output_kw} kW</strong>
            <p class="panel-copy">${hybridPlan.demand_coverage_percent}% of the modeled demand can be covered in this blended plan.</p>
          </div>
          <div class="hybrid-share-list">
            ${hybridPlan.mix.map((item) => `
              <div class="hybrid-share-pill" style="background:${sourceStyles[item.source].soft}">
                <span>${item.source}</span>
                <strong>${item.share_percent}%</strong>
              </div>
            `).join('')}
          </div>
        </article>
        <div class="hybrid-metrics">
          <article class="impact-card tone-butter"><span>Efficiency</span><strong>${hybridPlan.blended_efficiency}%</strong><p>Blended operating efficiency</p></article>
          <article class="impact-card tone-sky"><span>Payback</span><strong>${hybridPlan.blended_roi_years} yrs</strong><p>Modeled blended payback</p></article>
          <article class="impact-card tone-mint"><span>Carbon</span><strong>${hybridPlan.annual_carbon_offset_tons} t</strong><p>Annual avoided emissions</p></article>
        </div>
      </div>
    </section>
  `
}

function renderWeather(weatherContext, locationName) {
  const weatherStats = Object.entries(weatherContext).map(([key, value]) => {
    const config = weatherConfig[key] || { label: key, tone: 'slate', icon: '*' }
    return `
      <article class="weather-stat tone-${config.tone}">
        <span class="weather-icon">${config.icon}</span>
        <div>
          <span>${config.label}</span>
          <strong>${formatWeatherValue(key, value)}</strong>
        </div>
      </article>
    `
  }).join('')

  elements.detailWeather.innerHTML = `
    <section class="data-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Weather</p>
          <h3>Live conditions</h3>
        </div>
        <p class="panel-copy">Latest weather context used by the model.</p>
      </div>
      <div class="weather-widget">
        <div class="weather-widget-main tone-sky">
          <div class="weather-widget-top">
            <span class="weather-chip">Live weather</span>
            <span class="weather-chip">${weatherContext.timezone || 'Local timezone'}</span>
          </div>
          <div class="weather-widget-body">
            <div>
              <span class="weather-overline">${locationName || 'Selected site'}</span>
              <strong>${formatWeatherValue('temperature_2m', weatherContext.temperature_2m || 0)}</strong>
            </div>
            <div class="weather-widget-mini">
              <article class="weather-mini-card tone-mint">
                <span>Wind</span>
                <strong>${formatWeatherValue('wind_speed_10m', weatherContext.wind_speed_10m || 0)}</strong>
              </article>
              <article class="weather-mini-card tone-butter">
                <span>Radiation</span>
                <strong>${formatWeatherValue('shortwave_radiation_sum', weatherContext.shortwave_radiation_sum || 0)}</strong>
              </article>
            </div>
          </div>
        </div>
        <div class="weather-widget-stats">${weatherStats}</div>
      </div>
    </section>
  `
}

function renderSite(estimatedFeatures, locationName, scenario) {
  elements.detailSite.innerHTML = `
    <section class="data-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Site</p>
          <h3>Estimated parameters</h3>
        </div>
        <p class="panel-copy">Features passed into the recommendation model plus the active planning scenario.</p>
      </div>
      <div class="site-profile">
        <div class="site-profile-hero tone-lavender">
          <div>
            <span class="weather-overline">Model input profile</span>
            <strong>${locationName || 'Selected site'}</strong>
            <p class="panel-copy">Budget ${formatInteger(scenario.budget_usd)}, ${Number(scenario.land_acres).toFixed(1)} acres, ${strategyLabels[scenario.strategy] || 'Balanced'} priority.</p>
          </div>
          <div class="site-profile-badges">
            <span class="site-badge tone-butter">${formatMetric(estimatedFeatures.solar_irradiance)} solar</span>
            <span class="site-badge tone-sky">${formatMetric(estimatedFeatures.wind_speed)} wind</span>
            <span class="site-badge tone-mint">${formatMetric(estimatedFeatures.water_availability)} water</span>
          </div>
        </div>
        <div class="site-group-grid">
          ${siteGroups.map((group) => `
            <article class="site-group-card tone-${group.tone}">
              <div class="site-group-head">
                <h4>${group.title}</h4>
                <p>${group.summary}</p>
              </div>
              <div class="site-group-list">
                ${group.fields.map((field) => `
                  <div class="site-group-row">
                    <span>${featureLabels[field] || field}</span>
                    <strong>${formatMetric(estimatedFeatures[field])}</strong>
                  </div>
                `).join('')}
              </div>
            </article>
          `).join('')}
        </div>
        <div class="site-parameter-board">
          ${Object.entries(estimatedFeatures).map(([key, value]) => `
            <article class="site-parameter-row">
              <span>${featureLabels[key] || key}</span>
              <strong>${formatMetric(value)}</strong>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `
}

function renderPlannerHighlights(result) {
  const highlights = result.planner_highlights || {}
  const scenario = result.scenario || {}
  elements.plannerChipRow.innerHTML = `
    <span class="planner-chip tone-lavender">${strategyLabels[scenario.strategy] || 'Balanced'} mode</span>
    <span class="planner-chip tone-butter">${formatCurrency(scenario.budget_usd || 0)} budget</span>
    <span class="planner-chip tone-sky">${Number(scenario.land_acres || 0).toFixed(1)} acres</span>
    <span class="planner-chip tone-mint">${highlights.land_required_acres || 0} acres needed</span>
    <span class="planner-chip tone-peach">${highlights.annual_carbon_offset_tons || 0} t CO2/yr</span>
  `
  elements.plannerNoteList.innerHTML = (result.planner_notes || [])
    .map((note) => `<p class="planner-note">${note}</p>`)
    .join('')
}

function renderResult() {
  if (!state.result) {
    return
  }

  const { rankings } = state.result
  const lead = rankings[0]

  elements.loadingCopy.classList.add('hidden')
  elements.resultShell.classList.remove('hidden')
  elements.bestSourceName.textContent = state.result.best_source
  elements.recommendationSummary.textContent = state.result.summary
  elements.summaryLocation.textContent = state.result.location_name || 'Unnamed site'
  elements.summarySource.textContent = state.result.data_source
  elements.summaryDemand.textContent = `${state.result.demand_kw} kW demand`
  elements.summaryConfidence.textContent = `${state.result.confidence}%`
  elements.summaryOutput.textContent = `${lead.estimated_output_kw} kW`
  elements.summaryEfficiency.textContent = `${lead.expected_efficiency}%`
  elements.summaryCarbon.textContent = `${lead.annual_carbon_offset_tons} t`

  renderPlannerHighlights(state.result)
  renderRankings(rankings, state.result.best_source)
  renderSourceChart(rankings)
  renderRoiChart(rankings)
  renderSeasonalOutlook(state.result.seasonal_outlook || [])
  renderHybridPlan(state.result.hybrid_plan)
  renderWeather(state.result.weather_context || {}, state.result.location_name)
  renderSite(state.result.estimated_features, state.result.location_name, state.result.scenario || state.form)
}

function setDetailView(view) {
  state.detailView = view
  elements.segmentedButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view)
  })
  elements.detailSource.classList.toggle('hidden', view !== 'source')
  elements.detailRoi.classList.toggle('hidden', view !== 'roi')
  elements.detailSeasonal.classList.toggle('hidden', view !== 'seasonal')
  elements.detailHybrid.classList.toggle('hidden', view !== 'hybrid')
  elements.detailWeather.classList.toggle('hidden', view !== 'weather')
  elements.detailSite.classList.toggle('hidden', view !== 'site')
}

function renderSearchResults() {
  elements.searchResults.innerHTML = ''
  state.searchResults.forEach((item) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'search-result'
    button.innerHTML = `<strong>${item.name}</strong><span>${[item.admin1, item.country].filter(Boolean).join(', ')}</span>`
    button.addEventListener('click', () => {
      const locationLabel = [item.name, item.admin1, item.country].filter(Boolean).join(', ')
      setForm({
        location_name: locationLabel,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
      })
      state.suppressSearch = true
      elements.searchInput.value = locationLabel
      state.searchResults = []
      renderSearchResults()
    })
    elements.searchResults.appendChild(button)
  })
}

async function requestRecommendation() {
  setLoading(true)
  setError('')
  try {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.form),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Unable to fetch recommendation right now.')
    }
    state.result = data
    state.history = mergeHistory(data)
    renderHistory()
    renderResult()
  } catch (error) {
    setError(error.message)
    setLoading(false)
  } finally {
    setLoading(false)
  }
}

async function handleSearchInput() {
  const query = elements.searchInput.value.trim()
  if (state.suppressSearch) {
    state.suppressSearch = false
    return
  }
  if (query.length < 2 || query.startsWith('Selected point (')) {
    state.searchResults = []
    renderSearchResults()
    return
  }

  if (state.searchRequest) {
    state.searchRequest.abort()
  }
  const controller = new AbortController()
  state.searchRequest = controller
  elements.searchLoading.classList.remove('hidden')

  try {
    const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}&count=5`, { signal: controller.signal })
    if (!response.ok) {
      throw new Error('Search failed')
    }
    state.searchResults = await response.json()
    renderSearchResults()
  } catch (error) {
    if (error.name !== 'AbortError') {
      state.searchResults = []
      renderSearchResults()
    }
  } finally {
    elements.searchLoading.classList.add('hidden')
  }
}

function openHistoryDrawer() {
  document.body.style.overflow = 'hidden'
  elements.historyOverlay.classList.add('visible')
  elements.historyDrawer.classList.add('open')
}

function closeHistoryDrawer() {
  document.body.style.overflow = ''
  elements.historyOverlay.classList.remove('visible')
  elements.historyDrawer.classList.remove('open')
}

function initMap() {
  state.map = L.map('actual-map', {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true,
  }).setView([state.form.latitude, state.form.longitude], 4)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(state.map)

  state.marker = L.marker([state.form.latitude, state.form.longitude], {
    icon: L.divIcon({
      className: 'mapsense-pin-wrapper',
      html: '<div class="mapsense-pin"><span></span></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    }),
  }).addTo(state.map)

  state.marker.bindTooltip(state.form.location_name, {
    direction: 'top',
    offset: [0, -10],
    opacity: 0.95,
  })

  state.map.on('click', async (event) => {
    const latitude = Number(event.latlng.lat.toFixed(4))
    const longitude = Number(event.latlng.lng.toFixed(4))
    const lookupId = ++state.reverseLookupId
    const fallbackName = `Selected point (${latitude}, ${longitude})`
    elements.mapStatusCopy.textContent = 'Resolving place name...'
    state.suppressSearch = true
    setForm({ latitude, longitude, location_name: fallbackName })
    elements.searchInput.value = fallbackName

    try {
      const response = await fetch(`/api/locations/reverse?latitude=${latitude}&longitude=${longitude}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Reverse lookup failed')
      }
      if (lookupId !== state.reverseLookupId) {
        return
      }
      state.suppressSearch = true
      setForm({ latitude, longitude, location_name: data.name || fallbackName })
      elements.searchInput.value = data.name || fallbackName
    } catch {
      state.suppressSearch = true
      elements.searchInput.value = fallbackName
    } finally {
      elements.mapStatusCopy.textContent = 'Click anywhere on the map to update the location.'
    }
  })
}

function initEvents() {
  elements.toggleParameters.addEventListener('click', () => {
    state.inputsOpen = !state.inputsOpen
    elements.workspaceGrid.classList.toggle('map-only', !state.inputsOpen)
    elements.form.classList.toggle('hidden', !state.inputsOpen)
    elements.toggleParameters.classList.toggle('active', state.inputsOpen)
    elements.toggleParameters.textContent = state.inputsOpen ? 'Hide parameters' : 'Show parameters'
  })

  elements.openHistory.addEventListener('click', openHistoryDrawer)
  elements.closeHistory.addEventListener('click', closeHistoryDrawer)
  elements.historyOverlay.addEventListener('click', closeHistoryDrawer)

  presets.forEach((preset) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'preset-chip'
    button.textContent = preset.name
    button.addEventListener('click', () => {
      state.suppressSearch = true
      setForm({
        location_name: preset.location_name,
        latitude: preset.latitude,
        longitude: preset.longitude,
        demand_kw: preset.demand_kw,
        budget_usd: preset.budget_usd,
        land_acres: preset.land_acres,
        strategy: preset.strategy,
      })
      elements.searchInput.value = preset.location_name
      void requestRecommendation()
    })
    elements.presetRow.appendChild(button)
  })

  elements.searchInput.addEventListener('input', () => {
    state.form.location_name = elements.searchInput.value
    clearTimeout(state.searchTimer)
    state.searchTimer = window.setTimeout(handleSearchInput, 280)
  })

  elements.locationName.addEventListener('input', () => setForm({ location_name: elements.locationName.value }))
  elements.latitude.addEventListener('input', () => setForm({ latitude: Number(elements.latitude.value) }))
  elements.longitude.addEventListener('input', () => setForm({ longitude: Number(elements.longitude.value) }))
  elements.demand.addEventListener('input', () => setForm({ demand_kw: Number(elements.demand.value) }))
  elements.budget.addEventListener('input', () => setForm({ budget_usd: Number(elements.budget.value) }))
  elements.land.addEventListener('input', () => setForm({ land_acres: Number(elements.land.value) }))
  elements.strategy.addEventListener('change', () => setForm({ strategy: elements.strategy.value }))

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault()
    void requestRecommendation()
  })

  elements.segmentedButtons.forEach((button) => {
    button.addEventListener('click', () => setDetailView(button.dataset.view))
  })
}

async function bootstrap() {
  state.history = readHistory()
  renderHistory()
  elements.searchInput.value = state.form.location_name
  setForm(state.form)
  initMap()
  initEvents()
  await requestRecommendation()
}

bootstrap()
