import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { PoolPhase, PoolBout } from '../types'

export default function PoolsPage() {
  const { tournamentId, contestId, stageId } = useParams<{ tournamentId: string; contestId: string; stageId: string }>()
  const { tournaments, allocatePoolPhase, setPoolBoutScore, lockPoolPhase } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const stage = contest?.stages.find(s => s.id === stageId) as PoolPhase | undefined

  const [selectedPool, setSelectedPool] = useState(0)
  const [editingBout, setEditingBout] = useState<string | null>(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')

  if (!tournament || !contest || !stage || stage.type !== 'pool') return <div className="text-red-500">Phase introuvable</div>

  const fencerMap = Object.fromEntries(contest.fencers.map(f => [f.id, f]))
  const pool = stage.pools[selectedPool]

  async function handleAllocate() {
    const presentCount = contest!.fencers.filter(f => f.present).length
    const defaultCount = Math.ceil(presentCount / 6)
    const countStr = prompt(`Nombre de poules (${presentCount} tireurs présents)`, String(defaultCount))
    if (!countStr) return
    await allocatePoolPhase(tournamentId!, contestId!, stageId!, parseInt(countStr))
  }

  async function saveBout(boutId: string) {
    const sa = parseInt(scoreA)
    const sb = parseInt(scoreB)
    if (isNaN(sa) || isNaN(sb)) return
    await setPoolBoutScore(tournamentId!, contestId!, stageId!, pool.id, boutId, sa, sb)
    setEditingBout(null)
    setScoreA('')
    setScoreB('')
  }

  function startEdit(bout: PoolBout) {
    setEditingBout(bout.id)
    setScoreA(String(bout.scoreA ?? ''))
    setScoreB(String(bout.scoreB ?? ''))
  }

  function fencerName(id: string) {
    const f = fencerMap[id]
    if (!f) return '?'
    return `${f.lastName.toUpperCase()} ${f.firstName}`
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}`} className="hover:text-blue-600">{tournament.name}</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}/contest/${contestId}`} className="hover:text-blue-600">{contest.name}</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{stage.name}</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">{stage.name}</h1>
        <div className="flex gap-2">
          {stage.status === 'pending' && (
            <button className="btn-primary" onClick={handleAllocate}>⚙️ Allouer les poules</button>
          )}
          {stage.status === 'running' && (
            <button className="btn-primary bg-green-600 hover:bg-green-700"
              onClick={() => { if (confirm('Terminer ce tour de poules et calculer le classement ?')) lockPoolPhase(tournamentId!, contestId!, stageId!) }}>
              ✅ Terminer le tour
            </button>
          )}
        </div>
      </div>

      {stage.pools.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🤺</p>
          <p>Cliquez sur "Allouer les poules" pour distribuer les tireurs</p>
        </div>
      ) : (
        <>
          {/* Pool selector */}
          <div className="flex gap-2 flex-wrap">
            {stage.pools.map((p, idx) => (
              <button key={p.id}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${idx === selectedPool ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                onClick={() => setSelectedPool(idx)}>
                Poule {p.number}
              </button>
            ))}
          </div>

          {pool && (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Pool composition */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Poule {pool.number} — Tireurs</h2>
                <ol className="space-y-1">
                  {pool.fencerIds.map((fId, idx) => (
                    <li key={fId} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                      <span className="text-gray-800">{fencerName(fId)}</span>
                      {fencerMap[fId]?.club && <span className="text-gray-400 text-xs">({fencerMap[fId].club})</span>}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Bouts */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Matchs</h2>
                <div className="space-y-2">
                  {pool.bouts.map(bout => (
                    <BoutRow key={bout.id}
                      bout={bout}
                      nameA={fencerName(bout.fencerAId)}
                      nameB={fencerName(bout.fencerBId)}
                      maxScore={stage.maxScore}
                      isEditing={editingBout === bout.id}
                      scoreAInput={scoreA}
                      scoreBInput={scoreB}
                      onScoreAChange={setScoreA}
                      onScoreBChange={setScoreB}
                      onEdit={() => startEdit(bout)}
                      onSave={() => saveBout(bout.id)}
                      onCancel={() => setEditingBout(null)}
                      disabled={stage.status === 'done'}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Results table */}
      {stage.status === 'done' && stage.results.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-gray-700 mb-3">Classement de la phase</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Rang</th>
                <th className="px-3 py-2 text-left">Tireur</th>
                <th className="px-3 py-2 text-center">V</th>
                <th className="px-3 py-2 text-center">M</th>
                <th className="px-3 py-2 text-center">TD</th>
                <th className="px-3 py-2 text-center">TR</th>
                <th className="px-3 py-2 text-center">Ind.</th>
                <th className="px-3 py-2 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {stage.results.map(r => (
                <tr key={r.fencerId} className={`border-t border-gray-100 ${r.status === 'qualified' ? '' : 'opacity-60'}`}>
                  <td className="px-3 py-2 font-bold text-gray-700">{r.rank}</td>
                  <td className="px-3 py-2">{fencerName(r.fencerId)}</td>
                  <td className="px-3 py-2 text-center">{r.victories}</td>
                  <td className="px-3 py-2 text-center">{r.bouts}</td>
                  <td className="px-3 py-2 text-center">{r.touchesScored}</td>
                  <td className="px-3 py-2 text-center">{r.touchesReceived}</td>
                  <td className="px-3 py-2 text-center font-medium">{r.index > 0 ? `+${r.index}` : r.index}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'qualified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.status === 'qualified' ? 'Qualifié' : 'Éliminé'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function BoutRow({ bout, nameA, nameB, maxScore, isEditing, scoreAInput, scoreBInput, onScoreAChange, onScoreBChange, onEdit, onSave, onCancel, disabled }: {
  bout: PoolBout
  nameA: string
  nameB: string
  maxScore: number
  isEditing: boolean
  scoreAInput: string
  scoreBInput: string
  onScoreAChange: (v: string) => void
  onScoreBChange: (v: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  disabled: boolean
}) {
  const scored = bout.scoreA !== undefined && bout.scoreB !== undefined

  return (
    <div className={`rounded-lg border p-2 ${scored ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'} ${bout.resultA === 'A' ? 'opacity-50' : ''}`}>
      <div className="text-xs text-gray-400 mb-1">Match {bout.order}</div>
      {isEditing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium flex-1 text-right">{nameA}</span>
          <input type="number" min="0" max={maxScore} value={scoreAInput}
            onChange={e => onScoreAChange(e.target.value)}
            className="w-12 text-center border rounded px-1 py-0.5 text-sm"
            autoFocus />
          <span className="text-gray-400 font-bold">—</span>
          <input type="number" min="0" max={maxScore} value={scoreBInput}
            onChange={e => onScoreBChange(e.target.value)}
            className="w-12 text-center border rounded px-1 py-0.5 text-sm" />
          <span className="text-sm font-medium flex-1">{nameB}</span>
          <button className="btn-primary text-xs py-0.5 px-2" onClick={onSave}>✓</button>
          <button className="btn-secondary text-xs py-0.5 px-2" onClick={onCancel}>✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 cursor-pointer" onClick={disabled ? undefined : onEdit}>
          <span className={`text-sm flex-1 text-right ${bout.resultA === 'V' ? 'font-bold text-green-700' : 'text-gray-700'}`}>{nameA}</span>
          <span className="text-sm font-mono font-bold text-gray-800 w-12 text-center">
            {scored ? `${bout.scoreA} - ${bout.scoreB}` : '— —'}
          </span>
          <span className={`text-sm flex-1 ${bout.resultB === 'V' ? 'font-bold text-green-700' : 'text-gray-700'}`}>{nameB}</span>
          {!disabled && <span className="text-gray-300 text-xs">✏️</span>}
        </div>
      )}
    </div>
  )
}
