import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { PoolPhase, PoolBout, Pool, Referee } from '../types'

export default function PoolsPage() {
  const { tournamentId, contestId, stageId } = useParams<{ tournamentId: string; contestId: string; stageId: string }>()
  const { tournaments, allocatePoolPhase, setPoolBoutScore, setPoolBoutAbsent, lockPoolPhase, unlockPoolPhase, fillRandomPoolBouts } = useStore()
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

  // Unified participant map: for team events, maps team IDs to display info;
  // for individual events, maps fencer IDs to display info.
  type ParticipantInfo = { name: string; club?: string }
  const participantMap: Record<string, ParticipantInfo> = contest.isTeamEvent
    ? Object.fromEntries(contest.teams.map(t => [t.id, { name: t.name, club: t.club }]))
    : Object.fromEntries(contest.fencers.map(f => [f.id, { name: `${f.lastName.toUpperCase()} ${f.firstName}`, club: f.club }]))

  const pool = stage.pools[selectedPool]

  const presentCount = contest.isTeamEvent
    ? contest.teams.filter(t => t.present).length
    : contest.fencers.filter(f => f.present).length

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
    await setPoolBoutScore(tournamentId!, contestId!, stageId!, pool.id, boutId, sa, sb)
    setEditingBout(null)
    setScoreA('')
    setScoreB('')
  }

  async function quickSaveBout(boutId: string, sa: number, sb: number) {
    if (!stage) return
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

  function participantName(id: string) {
    return participantMap[id]?.name ?? '?'
  }

  const participantLabel = contest.isTeamEvent ? 'équipes' : 'tireurs'

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

      <div className={`flex items-center justify-between flex-wrap gap-2${stage.status !== 'pending' ? ' print:hidden' : ''}`}>
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
            <p className="text-sm text-gray-500">{presentCount} {participantLabel} présent{contest.isTeamEvent ? 'es' : 's'}</p>
            <form onSubmit={handleAllocate} className="space-y-3">
              <div>
                <label className="label">Nombre de poules</label>
                <input className="input" type="number" min={1} max={presentCount}
                  value={poolCountInput}
                  onChange={e => setPoolCountInput(e.target.value)}
                  required autoFocus />
                {poolCountInput && parseInt(poolCountInput) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    ~{Math.ceil(presentCount / parseInt(poolCountInput))} {participantLabel} par poule
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
          <p>Cliquez sur "Allouer les poules" pour distribuer les {participantLabel}</p>
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
                <h2 className="font-semibold text-gray-700 mb-3">Poule {pool.number} — {contest.isTeamEvent ? 'Équipes' : 'Tireurs'}</h2>
                <ol className="space-y-1">
                  {pool.fencerIds.map((fId, idx) => (
                    <li key={fId} className="flex items-center gap-2 text-sm">
                      <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                      <span className="text-gray-800">{participantName(fId)}</span>
                      {participantMap[fId]?.club && <span className="text-gray-400 text-xs">({participantMap[fId].club})</span>}
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
                      nameA={participantName(bout.fencerAId)}
                      nameB={participantName(bout.fencerBId)}
                      maxScore={stage.maxScore}
                      isEditing={editingBout === bout.id}
                      scoreAInput={scoreA}
                      scoreBInput={scoreB}
                      onScoreAChange={setScoreA}
                      onScoreBChange={setScoreB}
                      onEdit={() => startEdit(bout)}
                      onSave={() => saveBout(bout.id)}
                      onCancel={() => setEditingBout(null)}
                      onAbsent={(side) => setPoolBoutAbsent(tournamentId!, contestId!, stageId!, pool.id, bout.id, side)}
                      onQuickScore={(sa, sb) => quickSaveBout(bout.id, sa, sb)}
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
        <div>
          {/* Print-only recap header before the classification */}
          <div className="hidden print:block mb-3">
            <h2 className="text-base font-bold text-gray-800">{stage.name}</h2>
            <p className="text-xs text-gray-600">
              {[WEAPON_LABEL[contest.weapon] ?? contest.weapon,
                GENDER_LABEL[contest.gender] ?? contest.gender,
                contest.category].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-gray-500">
              {[contest.date
                  ? new Date(contest.date).toLocaleDateString('fr-FR')
                  : tournament.startDate
                    ? new Date(tournament.startDate).toLocaleDateString('fr-FR')
                    : '',
                contest.location ?? tournament.location ?? ''].filter(Boolean).join(' — ')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Score max&nbsp;: {stage.maxScore} · Qualification&nbsp;: {stage.promotionPercent}&nbsp;% · {stage.pools.length} poule{stage.pools.length > 1 ? 's' : ''}
            </p>
          </div>
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
                  <td className="px-3 py-2">{participantName(r.fencerId)}</td>
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
        </div>
      )}

      {/* Pool score sheets — toggle on screen, always in print */}
      {stage.pools.length > 0 && (
        <div className="pool-sheets-wrapper" style={showSheets ? {} : { display: 'none' }}>
          <h2 className="print:hidden font-semibold text-gray-700 mb-3">Feuilles de poule</h2>
          {stage.pools.map(p => (
            <PoolScoreSheet
              key={p.id}
              pool={p}
              stage={stage}
              participantMap={participantMap}
              contest={contest}
              tournament={tournament}
              referees={contest.referees}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const WEAPON_LABEL: Record<string, string> = { epee: 'Épée', foil: 'Fleuret', sabre: 'Sabre' }
const GENDER_LABEL: Record<string, string> = { men: 'Messieurs', women: 'Dames', mixed: 'Mixte' }

function PoolScoreSheet({ pool, stage, participantMap, contest, tournament, referees }: {
  pool: Pool
  stage: PoolPhase
  participantMap: Record<string, { name: string; club?: string }>
  contest: import('../types').Contest
  tournament: import('../types').Tournament
  referees: Referee[]
}) {
  const referee = pool.refereeId ? referees.find(r => r.id === pool.refereeId) : undefined
  const refName = referee ? `${referee.lastName.toUpperCase()} ${referee.firstName}` : ''

  const weaponLabel = WEAPON_LABEL[contest.weapon] ?? contest.weapon
  const genderLabel = GENDER_LABEL[contest.gender] ?? contest.gender
  const categoryLabel = contest.category ? ` ${contest.category}` : ''
  const fullLabel = `${weaponLabel} ${genderLabel}${categoryLabel}`

  const dateLabel = contest.date
    ? new Date(contest.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : tournament.startDate
      ? new Date(tournament.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : ''
  const locationLabel = contest.location ?? tournament.location ?? ''

  const fencers = pool.fencerIds.map((id, idx) => {
    const p = participantMap[id]
    return {
      id,
      num: idx + 1,
      name: p?.name ?? '?',
      club: p?.club ?? '',
    }
  })


  // ── Poule fermée : grille de résultats complète ──────────────
  if (stage.status === 'done') {
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
        <div className="pool-sheet-header">
          <div className="pool-sheet-title">
            <h3>Poule {pool.number} — {stage.name}</h3>
            <p className="pool-sheet-competition">{contest.name} · {fullLabel}</p>
            {(dateLabel || locationLabel) && (
              <p className="pool-sheet-meta">{[dateLabel, locationLabel].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="pool-sheet-meta-right">
            {pool.piste && <span>Piste {pool.piste}</span>}
            <span className="pool-sheet-referee">Arbitre : <span className="pool-sheet-referee-name">{refName || '________________________'}</span></span>
          </div>
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

  // ── Poule ouverte : format liste (à remplir à la main) ───────
  return (
    <div className="pool-sheet">
      {/* En-tête */}
      <div className="pool-sheet-header">
        <div className="pool-sheet-title">
          <h3>Poule {pool.number} — {stage.name}</h3>
          <p className="pool-sheet-competition">{contest.name} · {fullLabel}</p>
          {(dateLabel || locationLabel) && (
            <p className="pool-sheet-meta">{[dateLabel, locationLabel].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="pool-sheet-meta-right">
          {pool.piste && <span>Piste {pool.piste}</span>}
          <span className="pool-sheet-referee">Arbitre : <span className="pool-sheet-referee-name">{refName || '________________________'}</span></span>
        </div>
      </div>

      {/* Ligne du haut : liste des tireurs (gauche) + signatures (droite) */}
      <div className="pool-sheet-top">
        <table className="pool-fencer-list">
          <thead>
            <tr>
              <th>N°</th>
              <th>{contest.isTeamEvent ? 'Équipe' : 'Tireur'}</th>
              <th>Club / Nation</th>
            </tr>
          </thead>
          <tbody>
            {fencers.map(f => (
              <tr key={f.id}>
                <td className="pfl-num">{f.num}</td>
                <td className="pfl-name">{f.name}</td>
                <td className="pfl-club">{f.club}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pool-sheet-signatures">
          <p className="pool-sheet-signatures-title">Signatures des tireurs et de l’arbitre :</p>
          <table>
            <tbody>
              <tr className="sig-ref">
                <td className="sig-num">Arb.</td>
                <td className="sig-name">{refName || '________________________'}</td>
                <td className="sig-line"></td>
              </tr>
              {fencers.map(f => (
                <tr key={f.id}>
                  <td className="sig-num">{f.num}</td>
                  <td className="sig-name">{f.name}</td>
                  <td className="sig-line"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Liste des matchs */}
      <table className="pool-bout-list">
        <thead>
          <tr>
            <th className="pbl-num">Match</th>
            <th className="pbl-fencer">{contest.isTeamEvent ? 'Équipe' : 'Tireur'}</th>
            <th className="pbl-score">Score</th>
            <th className="pbl-fencer">{contest.isTeamEvent ? 'Équipe' : 'Tireur'}</th>
          </tr>
        </thead>
        <tbody>
          {pool.bouts.map((bout, idx) => {
            const fA = fencers.find(f => f.id === bout.fencerAId)
            const fB = fencers.find(f => f.id === bout.fencerBId)
            return (
              <tr key={idx}>
                <td className="pbl-num">{idx + 1}</td>
                <td className="pbl-fencer pbl-fencer-a">
                  <span className="pbl-n">{fA?.num}</span>{' '}{fA?.name}
                </td>
                <td className="pbl-score">
                  <span className="score-box"></span>
                  <span className="score-sep">–</span>
                  <span className="score-box"></span>
                </td>
                <td className="pbl-fencer pbl-fencer-b">
                  <span className="pbl-n">{fB?.num}</span>{' '}{fB?.name}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BoutRow({ bout, nameA, nameB, maxScore, isEditing, scoreAInput, scoreBInput, onScoreAChange, onScoreBChange, onEdit, onSave, onCancel, onAbsent, onQuickScore, disabled }: {
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
  onAbsent: (side: 'A' | 'B') => void
  onQuickScore: (sa: number, sb: number) => void
  disabled: boolean
}) {
  const [openSide, setOpenSide] = useState<'A' | 'B' | null>(null)

  const scored = bout.scoreA !== undefined && bout.scoreB !== undefined

  const quickScoresA = Array.from({ length: maxScore }, (_, i) => ({ sa: maxScore, sb: i }))
  const quickScoresB = Array.from({ length: maxScore }, (_, i) => ({ sa: i, sb: maxScore }))

  function handleQuick(sa: number, sb: number) {
    onQuickScore(sa, sb)
    setOpenSide(null)
  }

  function toggleSide(side: 'A' | 'B') {
    setOpenSide(prev => prev === side ? null : side)
  }

  const inputError = (() => {
    if (!isEditing) return null
    const sa = parseInt(scoreAInput)
    const sb = parseInt(scoreBInput)
    if (isNaN(sa) || isNaN(sb)) return null
    if (sa < 0 || sb < 0) return 'Score négatif impossible'
    if (sa > maxScore || sb > maxScore) return `Score max\u00a0: ${maxScore}`
    if (sa === sb) return 'Égalité impossible en poule'
    return null
  })()

  const QuickPopup = ({ scores, colorClass }: { scores: { sa: number; sb: number }[]; colorClass: string }) => (
    <div className="absolute top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-xl p-1.5 flex flex-wrap gap-1" style={{ minWidth: '6rem' }}>
      {scores.map(({ sa, sb }) => (
        <button key={`${sa}-${sb}`}
          className={`text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap transition-colors ${colorClass}`}
          onClick={() => handleQuick(sa, sb)}>
          {sa}-{sb}
        </button>
      ))}
    </div>
  )

  return (
    <div className={`rounded-lg border p-2 ${scored ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'} ${bout.resultA === 'A' || bout.resultB === 'A' ? 'opacity-60' : ''}`}>
      {/* Backdrop to close popup on outside click */}
      {openSide && <div className="fixed inset-0 z-10" onClick={() => setOpenSide(null)} />}
      <div className="text-xs text-gray-400 mb-1">Match {bout.order}</div>
      {isEditing ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Trigger bulle : A gagne */}
            {!disabled && (
              <div className="relative shrink-0">
                <button
                  className="text-xs px-1.5 py-0.5 rounded border font-medium bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                  onClick={() => toggleSide('A')}
                  title="Scores rapides — gauche gagne">
                  V ▾
                </button>
                {openSide === 'A' && <QuickPopup scores={quickScoresA} colorClass="bg-green-100 text-green-800 hover:bg-green-200" />}
              </div>
            )}
            <span className="text-sm font-medium flex-1 text-right truncate min-w-0">{nameA}</span>
            <input type="number" min="0" max={maxScore} value={scoreAInput}
              onChange={e => onScoreAChange(e.target.value)}
              className={`w-12 text-center border rounded px-1 py-0.5 text-sm shrink-0 ${inputError ? 'border-red-400 bg-red-50' : ''}`}
              autoFocus />
            <span className="text-gray-400 font-bold shrink-0">—</span>
            <input type="number" min="0" max={maxScore} value={scoreBInput}
              onChange={e => onScoreBChange(e.target.value)}
              className={`w-12 text-center border rounded px-1 py-0.5 text-sm shrink-0 ${inputError ? 'border-red-400 bg-red-50' : ''}`} />
            <span className="text-sm font-medium flex-1 truncate min-w-0">{nameB}</span>
            <button className="btn-primary text-xs py-0.5 px-2 disabled:opacity-40 shrink-0" onClick={onSave} disabled={!!inputError}>✓</button>
            <button className="btn-secondary text-xs py-0.5 px-2 shrink-0" onClick={onCancel}>✕</button>
            {/* Trigger bulle : B gagne */}
            {!disabled && (
              <div className="relative shrink-0">
                <button
                  className="text-xs px-1.5 py-0.5 rounded border font-medium bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  onClick={() => toggleSide('B')}
                  title="Scores rapides — droite gagne">
                  ▾ V
                </button>
                {openSide === 'B' && <QuickPopup scores={quickScoresB} colorClass="bg-blue-100 text-blue-800 hover:bg-blue-200" />}
              </div>
            )}
          </div>
          {inputError && (
            <p className="text-xs text-red-600 text-center">{inputError}</p>
          )}
          <div className="flex justify-center gap-2 pt-1">
            <button className="text-xs text-red-500 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50" onClick={() => { onAbsent('A'); onCancel() }}>Absent ← {nameA}</button>
            <button className="text-xs text-red-500 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50" onClick={() => { onAbsent('B'); onCancel() }}>Absent → {nameB}</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {/* Trigger bulle : A gagne */}
          {!disabled && (
            <div className="relative shrink-0">
              <button
                className="text-xs px-1.5 py-0.5 rounded border font-medium bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                onClick={() => toggleSide('A')}
                title="Scores rapides — gauche gagne">
                V ▾
              </button>
              {openSide === 'A' && <QuickPopup scores={quickScoresA} colorClass="bg-green-100 text-green-800 hover:bg-green-200" />}
            </div>
          )}
          <span className={`text-sm flex-1 text-right truncate min-w-0 ${bout.resultA === 'V' ? 'font-bold text-green-700' : bout.resultA === 'A' ? 'text-red-500 italic' : 'text-gray-700'}`}>{nameA}{bout.resultA === 'A' ? ' (ABS)' : ''}</span>
          <span className="text-sm font-mono font-bold text-gray-800 w-16 text-center shrink-0">
            {scored ? `${bout.scoreA} — ${bout.scoreB}` : '— —'}
          </span>
          <span className={`text-sm flex-1 truncate min-w-0 ${bout.resultB === 'V' ? 'font-bold text-green-700' : bout.resultB === 'A' ? 'text-red-500 italic' : 'text-gray-700'}`}>{nameB}{bout.resultB === 'A' ? ' (ABS)' : ''}</span>
          {/* Trigger bulle : B gagne */}
          {!disabled && (
            <div className="relative shrink-0">
              <button
                className="text-xs px-1.5 py-0.5 rounded border font-medium bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                onClick={() => toggleSide('B')}
                title="Scores rapides — droite gagne">
                ▾ V
              </button>
              {openSide === 'B' && <QuickPopup scores={quickScoresB} colorClass="bg-blue-100 text-blue-800 hover:bg-blue-200" />}
            </div>
          )}
          {!disabled && <span className="text-gray-300 text-xs cursor-pointer shrink-0 ml-1" onClick={onEdit}>✏️</span>}
        </div>
      )}
    </div>
  )
}
