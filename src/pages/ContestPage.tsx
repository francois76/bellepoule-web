import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import { exportTournamentJSON } from '../logic/importExport'

const stageLabel: Record<string, string> = {
  checkin: 'Checkin',
  pool: 'Tour de poules',
  tableau: 'Tableau',
  classification: 'Classement',
  barrage: 'Barrage',
}

export default function ContestPage() {
  const { tournamentId, contestId } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, addPoolPhase, addTableauPhase, updateTournament: _ut } = useStore()
  const navigate = useNavigate()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)

  if (!tournament || !contest) return <div className="text-red-500">Compétition introuvable</div>

  const presentCount = (contest?.fencers ?? []).filter(f => f.present).length

  async function handleAddPools() {
    const name = prompt('Nom du tour de poules', `Tour de poules ${contest!.stages.filter(s => s.type === 'pool').length + 1}`)
    if (!name) return
    const maxScore = parseInt(prompt('Score maximum par match', '5') ?? '5')
    const pct = parseInt(prompt('Pourcentage de qualifiés (%)', '75') ?? '75')
    await addPoolPhase(tournamentId!, contestId!, name, maxScore, pct)
  }

  async function handleAddTableau() {
    const sizeInput = prompt('Taille du tableau (ex: 32, 64, 128)', '64')
    if (!sizeInput) return
    const size = parseInt(sizeInput) as import('../types').TableauSize
    if (!size) return
    const maxScore = parseInt(prompt('Score maximum', '15') ?? '15')
    const thirdPlace = confirm('Match pour la 3ème place ?')
    await addTableauPhase(tournamentId!, contestId!, `Tableau de ${size}`, size, maxScore, thirdPlace)
  }

  function navigateToStage(stage: { id: string; type: string }) {
    const base = `/tournament/${tournamentId}/contest/${contestId}`
    if (stage.type === 'pool') navigate(`${base}/pools/${stage.id}`)
    else if (stage.type === 'tableau') navigate(`${base}/tableau/${stage.id}`)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}`} className="hover:text-blue-600">{tournament.name}</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{contest.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{contest.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {contest.fencers.length} tireur{contest.fencers.length !== 1 ? 's' : ''} inscrits
            {' · '}{presentCount} présent{presentCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => exportTournamentJSON(tournament)}>
          💾 Exporter
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ActionCard
          icon="📋"
          label="Checkin"
          sub={`${presentCount}/${contest.fencers.length}`}
          onClick={() => navigate(`/tournament/${tournamentId}/contest/${contestId}/checkin`)}
        />
        <ActionCard
          icon="🏅"
          label="Classement"
          sub="Résultats finaux"
          onClick={() => navigate(`/tournament/${tournamentId}/contest/${contestId}/classification`)}
        />
        <ActionCard icon="🤺" label="+ Tour de poules" sub="Ajouter phase" onClick={handleAddPools} />
        <ActionCard icon="🏆" label="+ Tableau" sub="Élimination directe" onClick={handleAddTableau} />
      </div>

      {/* Stages */}
      {contest.stages.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">Phases</h2>
          <div className="space-y-2">
            {contest.stages.map(stage => (
              <div key={stage.id}
                className="card flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigateToStage(stage)}>
                <div>
                  <span className="font-medium text-gray-800">{stage.name}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {stageLabel[stage.type] ?? stage.type}
                  </span>
                </div>
                <StatusBadge status={stage.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionCard({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="card text-left hover:shadow-md transition-shadow hover:border-blue-300 border border-gray-200">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-medium text-gray-800 text-sm">{label}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    running: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
  }
  const labels: Record<string, string> = { pending: 'En attente', running: 'En cours', done: 'Terminé' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}
