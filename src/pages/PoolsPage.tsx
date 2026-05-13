import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { PoolPhase, PoolBout, Pool, Fencer } from '../types'

export default function PoolsPage() {
  const { tournamentId, contestId, stageId } = useParams<{ tournamentId: string; contestId: string; stageId: string }>()
  const { tournaments, allocatePoolPhase, setPoolBoutScore, lockPoolPhase, unlockPoolPhase, fillRandomPoolBouts } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const stage = contest?.stages.find(s => s.id === stageId) as PoolPhase | undefined

  const [selectedPool, setSelectedPool] = useState(0)
  const [editingBout, setEditingBout] = useState<string | null>(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [allocateModal, setAllocateModal] = useState(false)
  const [poolCountInput, setPoolCountInput] = useState('')
  const [showSheets, setShowSheets] = useState(false)

  if (!tournament || !contest || !stage || stage.type !== 'pool') return <div className="text-red-500">Phase introuvable</div>

  const fencerMap = Object.fromEntries(contest.fencers.map(f => [f.id, f]))
  const pool = stage.pools[selectedPool]

  const presentCount = contest.fencers.filter(f => f.present).length

  function openAllocateModal() {
    setPoolCountInput(String(Math.ceil(presentCount / 6)))
    setAllocateModal(true)
  }

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault()
    const count = parseInt(poolCountInput)
    if (!count || count < 1) return
    await allocatePoolPhase(tournamentId!, contestId!, stageId!, count)
    setAllocateModal(false)
  }

  async function saveBout(boutId: string) {
    if (!stage) return
    const sa = parseInt(scoreA)
    const sb = parseInt(scoreB)
    if (isNaN(sa) || isNaN(sb)) return
    if (sa > stage.maxScore || sb > stage.maxScore) return
    if (sa === sb) return
    if (sa !== stage.maxScore && sb !== stage.maxScore) return
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
      <div className="print:hidden flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}`} className="hover:text-blue-600">{tournament.name}</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}/contest/${contestId}`} className="hover:text-blue-600">{contest.name}</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{stage.name}</span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{stage.name}</h1>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span>Score max : <strong className="text-gray-700">{stage.maxScore}</strong></span>
            <span>Qualification : <strong className="text-gray-700">{stage.promotionPercent} %</strong></span>
            {stage.pools.length > 0 && <span>{stage.pools.length} poule{stage.pools.length > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="print:hidden flex gap-2 flex-wrap">
          {stage.status === 'pending' && (
            <button className="btn-primary" onClick={openAllocateModal}>⚙️ Allouer les poules</button>
          )}
          {stage.status === 'running' && (
            <button className="btn-primary bg-green-600 hover:bg-green-700"
              onClick={() => lockPoolPhase(tournamentId!, contestId!, stageId!)}>
              ✅ Terminer le tour
            </button>
          )}
          {stage.pools.length > 0 && stage.status === 'running' && import.meta.env.DEV && (
            <button className="btn-secondary border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => fillRandomPoolBouts(tournamentId!, contestId!, stageId!)}>
              🎲 Scores aléatoires
            </button>
          )}
          {stage.pools.length > 0 && (
            <>
              <button className="btn-secondary" onClick={() => setShowSheets(s => !s)}>
                📋 {showSheets ? 'Masquer feuilles' : 'Feuilles de poule'}
              </button>
              <button className="btn-secondary" onClick={() => window.print()}>
                🖨️ Imprimer
              </button>
            </>
          )}
          {stage.status === 'done' && (
            <button className="btn-secondary" onClick={() => unlockPoolPhase(tournamentId!, contestId!, stageId!)}>
              🔓 Rouvrir pour correction
            </button>
          )}
        </div>
      </div>

      {/* Modal — Allocation des poules */}
      {allocateModal && (
        <div className="print:hidden fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Allouer les poules</h2>
            <p className="text-sm text-gray-500">{presentCount} tireurs présents</p>
            <form onSubmit={handleAllocate} className="space-y-3">
              <div>
                <label className="label">Nombre de poules</label>
                <input className="input" type="number" min={1} max={presentCount}
                  value={poolCountInput}
                  onChange={e => setPoolCountInput(e.target.value)}
                  required autoFocus />
                {poolCountInput && parseInt(poolCountInput) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    ~{Math.ceil(presentCount / parseInt(poolCountInput))} tireurs par poule
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => setAllocateModal(false)}>Annuler</button>
                <button type="submit" className="btn-primary flex-1">Allouer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {stage.pools.length === 0 ? (
        <div className="print:hidden text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🤺</p>
          <p>Cliquez sur "Allouer les poules" pour distribuer les tireurs</p>
        </div>
      ) : (
        <>
          {/* Pool selector tabs - screen only */}
          <div className="print:hidden flex gap-2 flex-wrap">
            {stage.pools.map((p, idx) => (
              <button key={p.id}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${idx === selectedPool ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                onClick={() => setSelectedPool(idx)}>
                Poule {p.number}
              </button>
            ))}
          </div>

          {/* Bout scoring - screen only */}
          {pool && (
            <div className="print:hidden grid gap-5 lg:grid-cols-2">
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

      {/* Pool score sheets — toggle on screen, always in print */}
      {stage.pools.length > 0 && (
        <div className="pool-sheets-wrapper" style={showSheets ? {} : { display: 'none' }}>
          <h2 className="print:hidden font-semibold text-gray-700 mb-3">Feuilles de poule</h2>
          {stage.pools.map(p => (
            <PoolScoreSheet key={p.id} pool={p} stage={stage} fencerMap={fencerMap} contestName={contest.name} />
          ))}
        </div>
      )}
    </div>
  )
}

function PoolScoreSheet({ pool, stage, fencerMap, contestName }: {
  pool: Pool
  stage: PoolPhase
  fencerMap: Record<string, Fencer>
  contestName: string
}) {
  const fencers = pool.fencerIds.map((id, idx) => {
    const f = fencerMap[id]
    return {
      id,
      num: idx + 1,
      name: f ? `${f.lastName.toUpperCase()} ${f.firstName}` : '?',
      club: f?.club ?? '',
    }
  })

  const resultsMap = Object.fromEntries(
    stage.results
      .filter(r => pool.fencerIds.includes(r.fencerId))
      .map(r => [r.fencerId, r])
  )

  function getCellContent(rowId: string, colId: string): string {
    const bout = pool.bouts.find(b =>
      (b.fencerAId === rowId && b.fencerBId === colId) ||
      (b.fencerBId === rowId && b.fencerAId === colId)
    )
    if (!bout || bout.scoreA === undefined) return ''
    if (bout.fencerAId === rowId) {
      return `${bout.resultA === 'V' ? 'V' : 'D'}${bout.scoreA}`
    }
    return `${bout.resultB === 'V' ? 'V' : 'D'}${bout.scoreB}`
  }

  return (
    <div className="pool-sheet">
      <div className="pool-sheet-title">
        <h3>Poule {pool.number} — {stage.name}</h3>
        <p>{contestName}</p>
      </div>
      <div className="pool-grid-scroll">
        <table className="pool-grid">
          <thead>
            <tr>
              <th>N°</th>
              <th className="pg-name">Nom</th>
              {fencers.map(f => <th key={f.id}>{f.num}</th>)}
              <th>V</th>
              <th>M</th>
              <th>TD</th>
              <th>TR</th>
              <th>Ind.</th>
              <th>Rang</th>
            </tr>
          </thead>
          <tbody>
            {fencers.map((rowF, rowIdx) => {
              const result = resultsMap[rowF.id]
              return (
                <tr key={rowF.id}>
                  <td>{rowF.num}</td>
                  <td className="pg-name" style={{ textAlign: 'left' }}>
                    {rowF.name}{rowF.club ? ` (${rowF.club})` : ''}
                  </td>
                  {fencers.map((colF, colIdx) => (
                    rowIdx === colIdx
                      ? <td key={colF.id} className="pg-x">&nbsp;</td>
                      : <td key={colF.id}>{getCellContent(rowF.id, colF.id)}</td>
                  ))}
                  <td>{result?.victories ?? ''}</td>
                  <td>{result?.bouts ?? ''}</td>
                  <td>{result?.touchesScored ?? ''}</td>
                  <td>{result?.touchesReceived ?? ''}</td>
                  <td>{result ? (result.index >= 0 ? `+${result.index}` : String(result.index)) : ''}</td>
                  <td>{result?.rank ?? ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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

  const inputError = (() => {
    if (!isEditing) return null
    const sa = parseInt(scoreAInput)
    const sb = parseInt(scoreBInput)
    if (isNaN(sa) || isNaN(sb)) return null
    if (sa < 0 || sb < 0) return 'Score négatif impossible'
    if (sa > maxScore || sb > maxScore) return `Score max\u00a0: ${maxScore}`
    if (sa === sb) return 'Égalité impossible en poule'
    if (sa !== maxScore && sb !== maxScore) return `Un des scores doit être ${maxScore}\u00a0(V)`
    return null
  })()

  return (
    <div className={`rounded-lg border p-2 ${scored ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'} ${bout.resultA === 'A' ? 'opacity-50' : ''}`}>
      <div className="text-xs text-gray-400 mb-1">Match {bout.order}</div>
      {isEditing ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium flex-1 text-right">{nameA}</span>
            <input type="number" min="0" max={maxScore} value={scoreAInput}
              onChange={e => onScoreAChange(e.target.value)}
              className={`w-12 text-center border rounded px-1 py-0.5 text-sm ${inputError ? 'border-red-400 bg-red-50' : ''}`}
              autoFocus />
            <span className="text-gray-400 font-bold">—</span>
            <input type="number" min="0" max={maxScore} value={scoreBInput}
              onChange={e => onScoreBChange(e.target.value)}
              className={`w-12 text-center border rounded px-1 py-0.5 text-sm ${inputError ? 'border-red-400 bg-red-50' : ''}`} />
            <span className="text-sm font-medium flex-1">{nameB}</span>
            <button className="btn-primary text-xs py-0.5 px-2 disabled:opacity-40" onClick={onSave} disabled={!!inputError}>✓</button>
            <button className="btn-secondary text-xs py-0.5 px-2" onClick={onCancel}>✕</button>
          </div>
          {inputError && (
            <p className="text-xs text-red-600 text-center">{inputError}</p>
          )}
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
