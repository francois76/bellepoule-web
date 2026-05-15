import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import { exportTournamentJSON } from '../logic/importExport'
import type { TableauSize, PoolPhase, FencedPlaces, DisplayConfig, DisplayFieldConfig } from '../types'
import { DEFAULT_DISPLAY_CONFIG, FENCING_CATEGORIES } from '../types'

const stageLabel: Record<string, string> = {
  checkin: 'Checkin',
  pool: 'Tour de poules',
  tableau: 'Tableau',
  classification: 'Classement',
  barrage: 'Barrage',
}

const TABLEAU_SIZES: TableauSize[] = [4, 8, 16, 32, 64, 128]

const FENCED_PLACES_OPTIONS: { value: FencedPlaces; label: string; hint: string }[] = [
  {
    value: 'none',
    label: 'Aucune petite finale',
    hint: 'Le 3e et 4e place sont ex-æquo (les deux demi-finalistes perdants se partagent la 3e place).',
  },
  {
    value: 'third_place',
    label: 'Match pour la 3e place',
    hint: 'Les deux demi-finalistes perdants s\'affrontent pour le bronze. C\'est le format le plus courant.',
  },
  {
    value: 'all_places',
    label: 'Toutes les places tirées',
    hint: 'Les perdants de chaque tour s\'affrontent entre eux pour déterminer les places exactes : 5e-8e, 9e-16e, etc. Nécessite des phases de barrage supplémentaires.',
  },
]

const DISPLAY_FIELD_LABELS: Record<keyof DisplayConfig, string> = {
  dateOfBirth:  'Date de naissance',
  gender:       'Genre',
  club:         'Club',
  country:      'Pays',
  licence:      'N° licence',
  initialRank:  'Classement initial',
}

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
  const { tournaments, addPoolPhase, addTableauPhase, addBarragePhase, updateContest, removeStage } = useStore()
  const navigate = useNavigate()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)

  const [poolModal, setPoolModal] = useState(false)
  const [poolForm, setPoolForm] = useState({ name: '', maxScore: '5', promotionPercent: '75' })

  const [tableauModal, setTableauModal] = useState(false)
  const [tableauForm, setTableauForm] = useState({ size: '64', maxScore: '15', fencedPlaces: 'third_place' as FencedPlaces })
  const [tableauAutoSize, setTableauAutoSize] = useState<number | null>(null)

  const [barrageModal, setBarrageModal] = useState(false)
  const [barrageForm, setBarrageForm] = useState({ name: '', maxScore: '5' })

  // ── Paramètres de compétition ──────────────────────────────────────────────
  const [settingsModal, setSettingsModal] = useState(false)

  if (!tournament || !contest) return <div className="text-red-500">Compétition introuvable</div>

  const displayConfig = contest.displayConfig ?? DEFAULT_DISPLAY_CONFIG
  const autoScoreStuffing = contest.autoScoreStuffing !== false // default true

  const presentCount = contest.isTeamEvent
    ? (contest.teams ?? []).filter(t => t.present !== false).length
    : (contest?.fencers ?? []).filter(f => f.present).length

  function openPoolModal() {
    const n = contest!.stages.filter(s => s.type === 'pool').length + 1
    setPoolForm({ name: `Tour de poules ${n}`, maxScore: suggestedMaxScore(contest?.category, 'pool'), promotionPercent: '100' })
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
    const { tournaments: updated } = useStore.getState()
    const c = updated.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
    const stage = c?.stages.at(-1)
    if (stage) navigateToStage(stage)
  }

  function openTableauModal() {
    const lastPool = [...(contest!.stages ?? [])].reverse().find(s => s.type === 'pool') as PoolPhase | undefined
    const qualifiedIds = lastPool?.results?.filter(r => r.status === 'qualified').map(r => r.fencerId) ?? []
    const qualifiedCount = contest!.isTeamEvent
      ? qualifiedIds.filter(id => (contest!.teams ?? []).find(t => t.id === id)?.present !== false).length
      : qualifiedIds.filter(id => contest!.fencers.find(f => f.id === id)?.present !== false).length
    let autoSize: number = qualifiedCount > 0 ? 4 : 64
    if (qualifiedCount > 0) { while (autoSize < qualifiedCount) autoSize *= 2 }
    setTableauAutoSize(qualifiedCount > 0 ? autoSize : null)
    setTableauForm({ size: String(autoSize), maxScore: suggestedMaxScore(contest?.category, 'tableau'), fencedPlaces: 'third_place' })
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
      tableauForm.fencedPlaces,
    )
    setTableauModal(false)
    const { tournaments: updated } = useStore.getState()
    const c = updated.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
    const stage = c?.stages.at(-1)
    if (stage) navigateToStage(stage)
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
    const { tournaments: updated } = useStore.getState()
    const c = updated.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
    const stage = c?.stages.at(-1)
    if (stage) navigateToStage(stage)
  }

  function navigateToStage(stage: { id: string; type: string }) {
    const base = `/tournament/${tournamentId}/contest/${contestId}`
    if (stage.type === 'pool') navigate(`${base}/pools/${stage.id}`)
    else if (stage.type === 'tableau') navigate(`${base}/tableau/${stage.id}`)
    else if (stage.type === 'barrage') navigate(`${base}/barrage/${stage.id}`)
  }

  async function handleToggleStuffing() {
    await updateContest(tournamentId!, { ...contest!, autoScoreStuffing: !autoScoreStuffing })
  }

  async function handleDisplayFieldChange(field: keyof DisplayConfig, key: keyof DisplayFieldConfig, val: boolean) {
    const newConfig: DisplayConfig = {
      ...displayConfig,
      [field]: { ...displayConfig[field], [key]: val },
    }
    await updateContest(tournamentId!, { ...contest!, displayConfig: newConfig })
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

      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{contest.name}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {contest.isTeamEvent
              ? `${contest.teams.length} équipe${contest.teams.length !== 1 ? 's' : ''}`
              : `${contest.fencers.length} tireur${contest.fencers.length !== 1 ? 's' : ''} inscrits · ${presentCount} présent${presentCount !== 1 ? 's' : ''}`}
            {contest.category && ` · ${contest.category}`}
          </p>
          {(contest.organizer || contest.location || contest.date) && (
            <p className="text-xs text-gray-400 mt-1">
              {[contest.organizer, contest.location, contest.date].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary" onClick={() => setSettingsModal(true)}>⚙️ Paramètres</button>
          <button className="btn-secondary" onClick={() => exportTournamentJSON(tournament)}>
            💾 Exporter
          </button>
        </div>
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
                className="card flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 flex-1 cursor-pointer"
                  onClick={() => navigateToStage(stage)}>
                  <span className="font-medium text-gray-800">{stage.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {stageLabel[stage.type] ?? stage.type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={stage.status} />
                  {stage.status !== 'done' && (
                    <button
                      className="text-gray-300 hover:text-red-500 transition-colors ml-2 text-lg leading-none"
                      title="Supprimer cette phase"
                      onClick={e => {
                        e.stopPropagation()
                        if (confirm(`Supprimer la phase « ${stage.name} » ? Cette action est irréversible.`)) {
                          removeStage(tournamentId!, contestId!, stage.id)
                        }
                      }}
                    >✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal — Paramètres de compétition */}
      {settingsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-6 my-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Paramètres de la compétition</h2>
              <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={() => setSettingsModal(false)}>✕</button>
            </div>

            {/* Score stuffing automatique */}
            <section className="space-y-2">
              <h3 className="font-semibold text-gray-700">Score stuffing automatique</h3>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <input type="checkbox" id="stuffing" checked={autoScoreStuffing}
                  onChange={handleToggleStuffing} className="mt-1 w-4 h-4 flex-shrink-0" />
                <div>
                  <label htmlFor="stuffing" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Remplissage automatique des assauts
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Quand un tireur est déclaré en <strong>forfait</strong> ou <strong>exclu</strong> lors des poules,
                    tous ses assauts non encore joués sont automatiquement remplis :
                    ses adversaires reçoivent une victoire au score maximum, le tireur reçoit D+0.
                    Cela évite de remplir manuellement chaque assaut.
                  </p>
                </div>
              </div>
            </section>

            {/* Taille minimale d'équipe */}
            {contest.isTeamEvent && (
              <section className="space-y-2">
                <h3 className="font-semibold text-gray-700">Taille minimale d'équipe</h3>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                  <p className="text-xs text-gray-500">
                    Une équipe ayant moins de N membres présents (cochés en checkin) est automatiquement
                    considérée comme absente et ne peut pas participer aux poules.
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-700">Minimum de membres :</label>
                    <input type="number" min={1} max={10}
                      className="input w-24"
                      defaultValue={contest.minTeamSize ?? 3}
                      onBlur={e => updateContest(tournamentId!, { ...contest!, minTeamSize: parseInt(e.target.value) || 3 })} />
                  </div>
                  <p className="text-xs text-gray-400">
                    Actuellement : {contest.minTeamSize ?? 3} membre{(contest.minTeamSize ?? 3) > 1 ? 's' : ''} minimum
                  </p>
                </div>
              </section>
            )}

            {/* Données à afficher */}
            <section className="space-y-2">
              <h3 className="font-semibold text-gray-700">Données à afficher</h3>
              <p className="text-xs text-gray-500">
                Configurez quelles informations sont affichées dans l'application et imprimées sur les documents.
                Cochez les colonnes souhaitées pour chaque champ.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 text-gray-600 font-medium">Champ</th>
                      <th className="text-center py-2 px-2 text-gray-600 font-medium text-xs">Visible dans l'app</th>
                      <th className="text-center py-2 px-2 text-gray-600 font-medium text-xs">Feuille de présence</th>
                      <th className="text-center py-2 px-2 text-gray-600 font-medium text-xs">Feuille de poule</th>
                      <th className="text-center py-2 px-2 text-gray-600 font-medium text-xs">Classement final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(displayConfig) as (keyof DisplayConfig)[]).map(field => (
                      <tr key={field} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-800">{DISPLAY_FIELD_LABELS[field]}</td>
                        {(['visible', 'onCheckin', 'onPool', 'onResults'] as const).map(key => (
                          <td key={key} className="text-center py-2 px-2">
                            <input type="checkbox"
                              checked={displayConfig[field][key]}
                              onChange={e => handleDisplayFieldChange(field, key, e.target.checked)}
                              className="w-4 h-4" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Catégorie */}
            <section className="space-y-2">
              <h3 className="font-semibold text-gray-700">Catégorie</h3>
              <div className="flex gap-2 items-center">
                <select className="input flex-1"
                  value={FENCING_CATEGORIES.some(c => c.value === contest.category) ? contest.category : '__other'}
                  onChange={e => {
                    if (e.target.value !== '__other') {
                      updateContest(tournamentId!, { ...contest!, category: e.target.value || undefined })
                    }
                  }}>
                  {FENCING_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                  <option value="__other">Autre / libre</option>
                </select>
              </div>
              <p className="text-xs text-gray-400">
                La catégorie influe sur le score maximum suggéré (ex : M13 et moins → 4 touches).
              </p>
            </section>

            <div className="flex justify-end pt-2">
              <button className="btn-primary" onClick={() => setSettingsModal(false)}>Fermer</button>
            </div>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
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
              <div>
                <label className="label">Places tirées</label>
                <div className="space-y-2">
                  {FENCED_PLACES_OPTIONS.map(opt => (
                    <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tableauForm.fencedPlaces === opt.value ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="fencedPlaces" value={opt.value}
                        checked={tableauForm.fencedPlaces === opt.value}
                        onChange={() => setTableauForm(f => ({ ...f, fencedPlaces: opt.value }))}
                        className="mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{opt.hint}</div>
                      </div>
                    </label>
                  ))}
                </div>
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
            <p className="text-sm text-gray-500">Départage entre tireurs ex-æquo à l'issue des poules.</p>
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

