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

function postJson(path, body = {}) {
  return fetchJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const fetchVacancies = () => fetchJson('/vacancies/')
export const fetchDefaultWeights = () => fetchJson('/matching/weights/')
export const fetchDashboard = () => fetchJson('/dashboard/')
export const fetchPipelineStatus = () => fetchJson('/pipeline/status/')
export const fetchVacancyDetail = (id) => fetchJson(`/vacancies/${id}/detail/`)
export const runMatching = (id, topN = 10, weights = null) => {
  const body = { top_n: topN }
  if (weights) body.weights = weights
  return postJson(`/vacancies/${id}/match/`, body)
}

function rethrowPipelineConflict(e) {
  if (e.status === 409) throw new Error('Proceso corriendo')
  throw e
}

export function startIngest(bs) {
  return postJson('/pipeline/ingest/', bs ? { batch_size: bs } : {}).catch(rethrowPipelineConflict)
}

export function startSyncVacancies() {
  return postJson('/pipeline/sync/', {}).catch(rethrowPipelineConflict)
}

export const fetchStandards = () => fetchJson('/standards/')
export const fetchAttributeCatalog = () => fetchJson('/standards/catalog/')
export const createStandard = (data) => postJson('/standards/create/', data)
export const updateStandard = (id, data) => postJson(`/standards/${id}/`, data)
export const deleteStandard = (id) => postJson(`/standards/${id}/delete/`)
