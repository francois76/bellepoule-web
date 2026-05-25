import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { BarragePhase } from '../types'
import { ContestBreadcrumb } from '../components/ContestBreadcrumb'
import { BackArrow } from '../components/BackArrow'

export default function BarragePage() {
  const { tournamentId = '', contestId = '', stageId = '' } = useParams<{ tournamentId: string; contestId: string; stageId: string }>()
  const { tournaments, addBarrageBout, setBarrageBoutScore, lockBarragePhase, unlockBarragePhase } = useStore()

  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const stage = contest?.stages.find(s => s.id === stageId) as BarragePhase | undefined

  const [editingBout, setEditingBout] = useState<string | null>(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')

  // Modal pour ajouter un match de barrage
  const [addBoutModal, setAddBoutModal] = useState(false)
  const [boutFencerA, setBoutFencerA] = useState('')
  const [boutFencerB, setBoutFencerB] = useState('')

  if (!tournament || !contest || !stage || stage.type !== 'barrage') {
    return <div className="text-red-500">Phase introuvable</div>
  }

  const fencerMap = Object.fromEntries(contest.fencers.map(f => [f.id, f]))

  function fencerName(id: string) {
    const f = fencerMap[id]
    if (!f) return '?'
    return `${f.lastName.toUpperCase()} ${f.firstName}`
  }

  function startEdit(boutId: string, sa?: number, sb?: number) {
    setEditingBout(boutId)
    setScoreA(sa !== undefined ? String(sa) : '')
    setScoreB(sb !== undefined ? String(sb) : '')
  }

  async function saveBout(boutId: string) {
    if (!stage) return
    const sa = parseInt(scoreA)
    const sb = parseInt(scoreB)
    if (isNaN(sa) || isNaN(sb)) return
    if (sa > stage.maxScore || sb > stage.maxScore) return
    if (sa === sb) return
    await setBarrageBoutScore(tournamentId, contestId, stageId, boutId, sa, sb)
    setEditingBout(null)
    setScoreA('')
    setScoreB('')
  }

  async function handleAddBout(e: React.FormEvent) {
    e.preventDefault()
    if (!boutFencerA || !boutFencerB || boutFencerA === boutFencerB) return
    await addBarrageBout(tournamentId, contestId, stageId, boutFencerA, boutFencerB)
    setBoutFencerA('')
    setBoutFencerB('')
    setAddBoutModal(false)
  }

  const presentFencers = contest.fencers.filter(f => f.present)
  const allScored = stage.bouts.length > 0 && stage.bouts.every(b => b.scoreA !== undefined && b.scoreB !== undefined)

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <BackArrow />
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}`} className="hover:text-blue-600">{tournament.name}</Link>
        <span>/</span>
        <ContestBreadcrumb tournament={tournament} contest={contest} tournamentId={tournamentId} />
        <span>/</span>
        <span className="text-gray-800 font-medium">{stage.name}</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{stage.name}</h1>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span>Score max : <strong className="text-gray-700">{stage.maxScore}</strong></span>
            <span>{stage.bouts.length} match{stage.bouts.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {stage.status === 'running' && (
            <>
              <button className="btn-secondary" onClick={() => setAddBoutModal(true)}>
                + Ajouter un match
              </button>
              <button className="btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => lockBarragePhase(tournamentId, contestId, stageId)}
                disabled={!allScored}
                title={!allScored ? 'Tous les scores doivent être saisis avant de clôturer' : undefined}>
                ✅ Terminer le barrage
              </button>
            </>
          )}
          {stage.status === 'done' && (
            <button className="btn-secondary"
              onClick={() => unlockBarragePhase(tournamentId, contestId, stageId)}>
              🔓 Rouvrir le barrage
            </button>
          )}
        </div>
      </div>

      {/* Liste des matchs */}
      {stage.bouts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">⚔️</p>
          <p>Aucun match de barrage pour l'instant.</p>
          <p className="text-sm mt-1">Cliquez sur "+ Ajouter un match" pour saisir les tireurs ex-æquo.</p>
        </div>
      ) : (
        <div className="card space-y-2">
          <h2 className="font-semibold text-gray-700 mb-3">Matchs de barrage</h2>
          {stage.bouts.map(bout => {
            const scored = bout.scoreA !== undefined && bout.scoreB !== undefined
            const isEditing = editingBout === bout.id
            const inputError = (() => {
              if (!isEditing) return null
              const sa = parseInt(scoreA)
              const sb = parseInt(scoreB)
              if (isNaN(sa) || isNaN(sb)) return null
              if (sa < 0 || sb < 0) return 'Score négatif impossible'
              if (sa > stage.maxScore || sb > stage.maxScore) return `Score max : ${stage.maxScore}`
              if (sa === sb) return 'Égalité non autorisée en barrage'
              return null
            })()
            return (
              <div key={bout.id}
                className={`rounded-lg border p-3 ${scored ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
                <div className="text-xs text-gray-400 mb-1">Match {bout.order}</div>
                {isEditing ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium flex-1 text-right">{fencerName(bout.fencerAId)}</span>
                      <input type="number" min="0" max={stage.maxScore} value={scoreA}
                        onChange={e => setScoreA(e.target.value)}
                        className={`w-12 text-center border rounded px-1 py-0.5 text-sm ${inputError ? 'border-red-400 bg-red-50' : ''}`}
                        />
                      <span className="text-gray-400 font-bold">—</span>
                      <input type="number" min="0" max={stage.maxScore} value={scoreB}
                        onChange={e => setScoreB(e.target.value)}
                        className={`w-12 text-center border rounded px-1 py-0.5 text-sm ${inputError ? 'border-red-400 bg-red-50' : ''}`} />
                      <span className="text-sm font-medium flex-1">{fencerName(bout.fencerBId)}</span>
                      <button className="btn-primary text-xs py-0.5 px-2 disabled:opacity-40"
                        onClick={() => saveBout(bout.id)} disabled={!!inputError}>✓</button>
                      <button className="btn-secondary text-xs py-0.5 px-2"
                        onClick={() => setEditingBout(null)}>✕</button>
                    </div>
                    {inputError && <p className="text-xs text-red-600 text-center">{inputError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 cursor-pointer"
                    role="button"
                    tabIndex={stage.status === 'done' ? -1 : 0}
                    onClick={stage.status === 'done' ? undefined : () => startEdit(bout.id, bout.scoreA, bout.scoreB)}
                    onKeyDown={stage.status === 'done' ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') startEdit(bout.id, bout.scoreA, bout.scoreB) }}>
                    <span className={`text-sm flex-1 text-right ${bout.resultA === 'V' ? 'font-bold text-green-700' : 'text-gray-700'}`}>
                      {fencerName(bout.fencerAId)}
                    </span>
                    <span className="text-sm font-mono font-bold text-gray-800 w-16 text-center">
                      {scored ? `${bout.scoreA} — ${bout.scoreB}` : '— —'}
                    </span>
                    <span className={`text-sm flex-1 ${bout.resultB === 'V' ? 'font-bold text-green-700' : 'text-gray-700'}`}>
                      {fencerName(bout.fencerBId)}
                    </span>
                    {stage.status !== 'done' && <span className="text-gray-300 text-xs">✏️</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal — Ajouter un match */}
      {addBoutModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Ajouter un match de barrage</h2>
            <form onSubmit={handleAddBout} className="space-y-3">
              <div>
                <label className="label" htmlFor="barrage-fencer-a">Tireur A</label>
                <select id="barrage-fencer-a" className="input" value={boutFencerA} onChange={e => setBoutFencerA(e.target.value)} required>
                  <option value="">— Sélectionner —</option>
                  {presentFencers.map(f => (
                    <option key={f.id} value={f.id}>{f.lastName.toUpperCase()} {f.firstName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="barrage-fencer-b">Tireur B</label>
                <select id="barrage-fencer-b" className="input" value={boutFencerB} onChange={e => setBoutFencerB(e.target.value)} required>
                  <option value="">— Sélectionner —</option>
                  {presentFencers.filter(f => f.id !== boutFencerA).map(f => (
                    <option key={f.id} value={f.id}>{f.lastName.toUpperCase()} {f.firstName}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setAddBoutModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary flex-1" disabled={!boutFencerA || !boutFencerB || boutFencerA === boutFencerB}>
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
