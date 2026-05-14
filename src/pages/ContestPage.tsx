import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import { exportTournamentJSON } from '../logic/importExport'
import type { TableauSize, PoolPhase } from '../types'

const stageLabel: Record<string, string> = {
  checkin: 'Checkin',
  pool: 'Tour de poules',
  tableau: 'Tableau',
  classification: 'Classement',
  barrage: 'Barrage',
}

const TABLEAU_SIZES: TableauSize[] = [4, 8, 16, 32, 64, 128]

/** Score max suggéré selon la catégorie d'âge (règlement fédéral jeunes) */
function suggestedMaxScore(category: string | undefined, phase: 'pool' | 'tableau'): string {
  if (!category) return phase === 'pool' ? '5' : '15'
  const cat = category.toUpperCase()
  if (/M9|M11|M13/.test(cat)) return phase === 'pool' ? '4' : '8'
  return phase === 'pool' ? '5' : '15'
}

function scoreHint(category: string | undefined, phase: 'pool' | 'tableau'): string | null {
  if (!category) return null
  const cat = category.toUpperCase()
  if (/M9|M11|M13/.test(cat)) return phase === 'pool' ? 'M13 et moins : 4 touches (rèf. regt. jeunes)' : 'M13 et moins : 8 touches (rèf. regt. jeunes)'
  return null
}

export default function ContestPage() {
  const { tournamentId, contestId } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, addPoolPhase, addTableauPhase, addBarragePhase, updateTournament: _ut } = useStore()
  const navigate = useNavigate()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)

  const [poolModal, setPoolModal] = useState(false)
  const [poolForm, setPoolForm] = useState({ name: '', maxScore: '5', promotionPercent: '75' })

  const [tableauModal, setTableauModal] = useState(false)
  const [tableauForm, setTableauForm] = useState({ size: '64', maxScore: '15', hasThirdPlace: true })
  const [tableauAutoSize, setTableauAutoSize] = useState<number | null>(null)

  const [barrageModal, setBarrageModal] = useState(false)
  const [barrageForm, setBarrageForm] = useState({ name: '', maxScore: '5' })

  if (!tournament || !contest) return <div className="text-red-500">Compétition introuvable</div>

  const presentCount = contest.isTeamEvent
    ? (contest.teams ?? []).filter(t => t.present !== false).length
    : (contest?.fencers ?? []).filter(f => f.present).length

  function openPoolModal() {
    const n = contest!.stages.filter(s => s.type === 'pool').length + 1
    setPoolForm({ name: `Tour de poules ${n}`, maxScore: suggestedMaxScore(contest?.category, 'pool'), promotionPercent: '75' })
    setPoolModal(true)
  }

  async function handleCreatePool(e: React.FormEvent) {
    e.preventDefault()
    await addPoolPhase(
      tournamentId!, contestId!,
      poolForm.name.trim(),
      parseInt(poolForm.maxScore) || 5,
      parseInt(poolForm.promotionPercent) || 75,
    )
    setPoolModal(false)
  }

  function openTableauModal() {
    const lastPool = [...(contest!.stages ?? [])].reverse().find(s => s.type === 'pool') as PoolPhase | undefined
    // Count only qualified participants who are still present (haven't declared forfait)
    const qualifiedIds = lastPool?.results?.filter(r => r.status === 'qualified').map(r => r.fencerId) ?? []
    const qualifiedCount = contest!.isTeamEvent
      ? qualifiedIds.filter(id => (contest!.teams ?? []).find(t => t.id === id)?.present !== false).length
      : qualifiedIds.filter(id => contest!.fencers.find(f => f.id === id)?.present !== false).length
    let autoSize: number = qualifiedCount > 0 ? 4 : 64
    if (qualifiedCount > 0) { while (autoSize < qualifiedCount) autoSize *= 2 }
    setTableauAutoSize(qualifiedCount > 0 ? autoSize : null)
    setTableauForm({ size: String(autoSize), maxScore: suggestedMaxScore(contest?.category, 'tableau'), hasThirdPlace: true })
    setTableauModal(true)
  }

  async function handleCreateTableau(e: React.FormEvent) {
    e.preventDefault()
    const size = parseInt(tableauForm.size) as TableauSize
    await addTableauPhase(
      tournamentId!, contestId!,
      `Tableau de ${size}`,
      size,
      parseInt(tableauForm.maxScore) || 15,
      tableauForm.hasThirdPlace,
    )
    setTableauModal(false)
  }

  function openBarrageModal() {
    const n = contest!.stages.filter(s => s.type === 'barrage').length + 1
    setBarrageForm({ name: `Barrage ${n}`, maxScore: suggestedMaxScore(contest?.category, 'pool') })
    setBarrageModal(true)
  }

  async function handleCreateBarrage(e: React.FormEvent) {
    e.preventDefault()
    await addBarragePhase(
      tournamentId!, contestId!,
      barrageForm.name.trim(),
      parseInt(barrageForm.maxScore) || 5,
    )
    setBarrageModal(false)
  }

  function navigateToStage(stage: { id: string; type: string }) {
    const base = `/tournament/${tournamentId}/contest/${contestId}`
    if (stage.type === 'pool') navigate(`${base}/pools/${stage.id}`)
    else if (stage.type === 'tableau') navigate(`${base}/tableau/${stage.id}`)
    else if (stage.type === 'barrage') navigate(`${base}/barrage/${stage.id}`)
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
            {contest.isTeamEvent
              ? `${contest.teams.length} équipe${contest.teams.length !== 1 ? 's' : ''}`
              : `${contest.fencers.length} tireur${contest.fencers.length !== 1 ? 's' : ''} inscrits · ${presentCount} présent${presentCount !== 1 ? 's' : ''}`}
          </p>
          {(contest.organizer || contest.location || contest.date) && (
            <p className="text-xs text-gray-400 mt-1">
              {[contest.organizer, contest.location, contest.date].filter(Boolean).join(' · ')}
            </p>
          )}
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
          sub={contest.isTeamEvent
            ? `${presentCount}/${(contest.teams ?? []).length} éq.`
            : `${presentCount}/${contest.fencers.length}`}
          onClick={() => navigate(`/tournament/${tournamentId}/contest/${contestId}/checkin`)}
        />
        <ActionCard
          icon="🏅"
          label="Classement"
          sub="Résultats finaux"
          onClick={() => navigate(`/tournament/${tournamentId}/contest/${contestId}/classification`)}
        />
        <ActionCard icon="🤺" label="+ Tour de poules" sub="Ajouter phase" onClick={openPoolModal} />
        <ActionCard icon="🏆" label="+ Tableau" sub="Élimination directe" onClick={openTableauModal} />
        <ActionCard icon="⚔️" label="+ Barrage" sub="Départage" onClick={openBarrageModal} />
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

      {/* Modal — Nouveau tour de poules */}
      {poolModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Nouveau tour de poules</h2>
            <form onSubmit={handleCreatePool} className="space-y-3">
              <div>
                <label className="label">Nom</label>
                <input className="input" value={poolForm.name}
                  onChange={e => setPoolForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Score maximum par match</label>
                <input className="input" type="number" min={1} max={99} value={poolForm.maxScore}
                  onChange={e => setPoolForm(f => ({ ...f, maxScore: e.target.value }))} required />
                {scoreHint(contest.category, 'pool') && (
                  <p className="text-xs text-blue-500 mt-1">{scoreHint(contest.category, 'pool')}</p>
                )}
              </div>
              <div>
                <label className="label">Pourcentage de qualifiés (%)</label>
                <input className="input" type="number" min={1} max={100} value={poolForm.promotionPercent}
                  onChange={e => setPoolForm(f => ({ ...f, promotionPercent: e.target.value }))} required />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setPoolModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary flex-1">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Nouveau tableau */}
      {tableauModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Nouveau tableau</h2>
            <form onSubmit={handleCreateTableau} className="space-y-3">
              <div>
                <label className="label">Taille du tableau</label>
                <select className="input" value={tableauForm.size}
                  onChange={e => setTableauForm(f => ({ ...f, size: e.target.value }))}>
                  {TABLEAU_SIZES.map(s => (
                    <option key={s} value={String(s)}>{s}{tableauAutoSize === s ? ' (suggéré)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Score maximum</label>
                <input className="input" type="number" min={1} max={99} value={tableauForm.maxScore}
                  onChange={e => setTableauForm(f => ({ ...f, maxScore: e.target.value }))} required />
                {scoreHint(contest.category, 'tableau') && (
                  <p className="text-xs text-blue-500 mt-1">{scoreHint(contest.category, 'tableau')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="thirdPlace" checked={tableauForm.hasThirdPlace}
                  onChange={e => setTableauForm(f => ({ ...f, hasThirdPlace: e.target.checked }))} />
                <label htmlFor="thirdPlace" className="text-sm text-gray-700">Match pour la 3ème place</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setTableauModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary flex-1">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal — Nouveau barrage */}
      {barrageModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Nouveau barrage</h2>
            <p className="text-sm text-gray-500">Département entre tireurs ex-æquo</p>
            <form onSubmit={handleCreateBarrage} className="space-y-3">
              <div>
                <label className="label">Nom</label>
                <input className="input" value={barrageForm.name}
                  onChange={e => setBarrageForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div>
                <label className="label">Score maximum</label>
                <input className="input" type="number" min={1} max={99} value={barrageForm.maxScore}
                  onChange={e => setBarrageForm(f => ({ ...f, maxScore: e.target.value }))} required />
                {scoreHint(contest.category, 'pool') && (
                  <p className="text-xs text-blue-500 mt-1">{scoreHint(contest.category, 'pool')}</p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setBarrageModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary flex-1">Créer</button>
              </div>
            </form>
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
