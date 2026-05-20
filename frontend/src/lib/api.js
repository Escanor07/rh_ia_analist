const API = '/api'

async function fetchJson(path, options = {}) {
  const token = localStorage.getItem('auth_token')
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API}${path}`, { ...options, headers })
  if (response.status === 401) {
    window.dispatchEvent(new Event('auth:logout'))
    const err = new Error('Sesión expirada')
    err.status = 401
    throw err
  }
  if (!response.ok) {
    const err = new Error(response.statusText || 'Error de red')
    err.status = response.status
    throw err
  }
  return response.json()
}

export async function loginUser(username, password) {
  const response = await fetch(`${API}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Error de autenticación')
  return data
}

function postJson(path, body = {}) {
  return fetchJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function rethrowConflict(e) {
  if (e.status === 409) throw new Error('Proceso corriendo')
  throw e
}

export const fetchVacancies = () => fetchJson('/vacancies/')
export const fetchDefaultWeights = () => fetchJson('/matching/weights/')
export const fetchDashboard = () => fetchJson('/dashboard/')
export const fetchPipelineStatus = () => fetchJson('/pipeline/status/')
export const fetchVacancyDetail = (id) => fetchJson(`/vacancies/${id}/detail/`)
export const fetchStandards = () => fetchJson('/standards/')
export const fetchAttributeCatalog = () => fetchJson('/standards/catalog/')

export const runMatching = (id, topN = 10, weights = null, sameSucursal = false) => {
  const body = { top_n: topN }
  if (weights) body.weights = weights
  if (sameSucursal) body.same_sucursal = true
  return postJson(`/vacancies/${id}/match/`, body)
}

export const startIngest = (bs) => postJson('/pipeline/ingest/', bs ? { batch_size: bs } : {}).catch(rethrowConflict)
export const startSyncVacancies = () => postJson('/pipeline/sync/', {}).catch(rethrowConflict)
export const createStandard = (d) => postJson('/standards/create/', d)
export const updateStandard = (id, d) => postJson(`/standards/${id}/`, d)
export const deleteStandard = (id) => postJson(`/standards/${id}/delete/`)
