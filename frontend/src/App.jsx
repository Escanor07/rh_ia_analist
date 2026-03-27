import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PipelineProvider } from './context/PipelineContext'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import MatchingPage from './pages/MatchingPage'
import VacancyDetailPage from './pages/VacancyDetailPage'
import StandardsPage from './pages/StandardsPage'

export default function App() {
  return (
    <BrowserRouter>
      <PipelineProvider>
        <Routes>
          <Route element={<Layout />}>
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
