import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/Dashboard'
import { BugsPage } from './pages/Bugs'
import { RunsPage } from './pages/Runs'
import { RunDetailPage } from './pages/RunDetail'
import { BuildsPage } from './pages/Builds'
import { ReportsPage } from './pages/Reports'
import { Empty } from './components/ui'
import { PlaytestPage } from './pages/Playtest'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="bugs" element={<BugsPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="builds" element={<BuildsPage />} />
        <Route path="playtest" element={<PlaytestPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="*" element={<Empty title="Page not found" />} />
      </Route>
    </Routes>
  )
}
