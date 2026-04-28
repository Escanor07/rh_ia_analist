import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const SESSION_DURATION_MS = 2 * 60 * 60 * 1000 // 2 horas

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function loadSession() {
  try {
    const token = localStorage.getItem('auth_token')
    const loginTime = parseInt(localStorage.getItem('auth_login_time') || '0', 10)
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null')
    if (!token || !user) return null
    if (Date.now() - loginTime > SESSION_DURATION_MS) return null
    return user
  } catch {
    return null
  }
}

function clearSession() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_login_time')
  localStorage.removeItem('auth_user')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadSession())

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const login = useCallback((token, userData) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_login_time', String(Date.now()))
    localStorage.setItem('auth_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  // 401 desde cualquier llamada API cierra la sesión
  useEffect(() => {
    window.addEventListener('auth:logout', logout)
    return () => window.removeEventListener('auth:logout', logout)
  }, [logout])

  // Expiración de sesión cada minuto
  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      const loginTime = parseInt(localStorage.getItem('auth_login_time') || '0', 10)
      if (Date.now() - loginTime > SESSION_DURATION_MS) logout()
    }, 60_000)
    return () => clearInterval(id)
  }, [user, logout])

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}
