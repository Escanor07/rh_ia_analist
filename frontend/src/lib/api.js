const API = '/api'

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API}${path}`, options)
  if (!response.ok) {
    const err = new Error(response.statusText || 'Error de red')
    err.status = response.status
    throw err
  }
  return response.json()
}

export function fetchVacancies() {
  return fetchJson('/vacancies/')
}

export function runMatching(sourceId, topN = 10, weights = null) {
  const body = { top_n: topN }
  if (weights) body.weights = weights

  return fetchJson(`/vacancies/${sourceId}/match/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function fetchDefaultWeights() {
  return fetchJson('/matching/weights/')
}

export function fetchDashboard() {
  return fetchJson('/dashboard/')
}

export function startIngest(batchSize) {
  return fetch(`${API}/pipeline/ingest/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchSize ? { batch_size: batchSize } : {}),
  }).then((r) => {
    if (!r.ok) throw new Error('Proceso corriendo')
    return r.json()
  })
}

export function startSyncVacancies() {
  return fetch(`${API}/pipeline/sync/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).then((r) => {
    if (!r.ok) throw new Error('Proceso corriendo')
    return r.json()
  })
}

export function fetchPipelineStatus() {
  return fetchJson('/pipeline/status/')
}

export function fetchVacancyDetail(sourceId) {
  return fetchJson(`/vacancies/${sourceId}/detail/`)
}
