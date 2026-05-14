import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TournamentPage from './pages/TournamentPage'
import ContestPage from './pages/ContestPage'
import CheckinPage from './pages/CheckinPage'
import PoolsPage from './pages/PoolsPage'
import TableauPage from './pages/TableauPage'
import ClassificationPage from './pages/ClassificationPage'
import BarragePage from './pages/BarragePage'

const base = import.meta.env.BASE_URL

export default function App() {
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="tournament/:tournamentId" element={<TournamentPage />} />
          <Route path="tournament/:tournamentId/contest/:contestId" element={<ContestPage />} />
          <Route path="tournament/:tournamentId/contest/:contestId/checkin" element={<CheckinPage />} />
          <Route path="tournament/:tournamentId/contest/:contestId/pools/:stageId" element={<PoolsPage />} />
          <Route path="tournament/:tournamentId/contest/:contestId/tableau/:stageId" element={<TableauPage />} />
          <Route path="tournament/:tournamentId/contest/:contestId/barrage/:stageId" element={<BarragePage />} />
          <Route path="tournament/:tournamentId/contest/:contestId/classification" element={<ClassificationPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
