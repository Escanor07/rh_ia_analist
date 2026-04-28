import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { loginUser } from '../../lib/api'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { token, user } = await loginUser(form.username, form.password)
      login(token, user)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-steel-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-steel-100 p-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-steel-900">Iniciar sesión</h1>
          <p className="text-sm text-steel-400 mt-1">Sistema de reclutamiento Lubtrac</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-steel-700 mb-1">
              Usuario
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="w-full border border-steel-200 rounded-lg px-3 py-2 text-sm text-steel-900 placeholder-steel-300 focus:outline-none focus:ring-2 focus:ring-steel-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-steel-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-steel-200 rounded-lg px-3 py-2 text-sm text-steel-900 placeholder-steel-300 focus:outline-none focus:ring-2 focus:ring-steel-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-steel-800 hover:bg-steel-900 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
