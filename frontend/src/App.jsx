import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PipelineProvider } from './context/PipelineContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppShell from './layout/AppShell'
import LoginPage from './pages/login'
import DashboardPage from './pages/dashboard'
import MatchingPage from './pages/matching'
import VacancyDetailPage from './pages/vacancy-detail'
import StandardsPage from './pages/standards'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PipelineProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/matching" element={<MatchingPage />} />
                <Route path="/vacancy/:sourceId" element={<VacancyDetailPage />} />
                <Route path="/standards" element={<StandardsPage />} />
              </Route>
            </Route>
          </Routes>
        </PipelineProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
