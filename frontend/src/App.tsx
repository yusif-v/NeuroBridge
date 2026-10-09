import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LandingPage } from './pages/Landing'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/Dashboard'
import { BugsPage } from './pages/Bugs'
import { RunsPage } from './pages/Runs'
import { RunDetailPage } from './pages/RunDetail'
import { BuildsPage } from './pages/Builds'
import { ReportsPage } from './pages/Reports'
import { ScorecardPage } from './pages/Scorecard'
import { UsagePage } from './pages/Usage'
import { IntegrationsPage } from './pages/Integrations'
import { Empty } from './components/ui'
import { PlaytestPage } from './pages/Playtest'

function LegacyRoute() {
  const location = useLocation()
  return <Navigate to={'/app' + location.pathname + location.search} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="app" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="bugs" element={<BugsPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="builds" element={<BuildsPage />} />
        <Route path="playtest" element={<PlaytestPage />} />
        <Route path="scorecard" element={<ScorecardPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="integrations" element={<IntegrationsPage />} />
        <Route path="*" element={<Empty title="Page not found" />} />
      </Route>
      {["playtest", "bugs", "runs", "runs/:id", "builds", "reports"].map(path => <Route key={path} path={path} element={<LegacyRoute />} />)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
