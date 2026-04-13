import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PipelineProvider } from './context/PipelineContext'
import AppShell from './layout/AppShell'
import DashboardPage from './pages/dashboard'
import MatchingPage from './pages/matching'
import VacancyDetailPage from './pages/vacancy-detail'
import StandardsPage from './pages/standards'

export default function App() {
  return (
    <BrowserRouter>
      <PipelineProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/matching" element={<MatchingPage />} />
            <Route path="/vacancy/:sourceId" element={<VacancyDetailPage />} />
            <Route path="/standards" element={<StandardsPage />} />
          </Route>
        </Routes>
      </PipelineProvider>
    </BrowserRouter>
  )
}
