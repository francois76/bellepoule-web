import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { TableauPhase, TableauBout } from '../types'

const WEAPON_LABEL: Record<string, string> = { epee: 'Épée', foil: 'Fleuret', sabre: 'Sabre' }
const GENDER_LABEL: Record<string, string> = { men: 'Messieurs', women: 'Dames', mixed: 'Mixte' }

function roundLabelFull(round: number): string {
  if (round === 2) return 'Finale'
  if (round === 4) return 'Demi-finales'
  if (round === 8) return 'Quarts de finale'
  return `Tableau de ${round}`
}

function roundLabelShort(round: number): string {
  if (round === 2) return 'Finale'
  if (round === 4) return '½ Finales'
  if (round === 8) return '¼ Finales'
  return `T${round}`
}

export default function TableauPage() {
  const { tournamentId, contestId, stageId } = useParams<{ tournamentId: string; contestId: string; stageId: string }>()
  const { tournaments, setTableauBoutScore, lockTableauPhase, unlockTableauPhase, lockTableauRound, unlockTableauRound, fillRandomTableauBouts } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const stage = contest?.stages.find(s => s.id === stageId) as TableauPhase | undefined

  const [editingBout, setEditingBout] = useState<string | null>(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [printingRound, setPrintingRound] = useState<number | null>(null)
  const [expandedRounds, setExpandedRounds] = useState<Set<number> | null>(null)

  if (!tournament || !contest || !stage || stage.type !== 'tableau') return <div className="text-red-500">Tableau introuvable</div>

  // Build participant name map — handles both individual and team events
  const participantMap: Record<string, string> = contest.isTeamEvent
    ? Object.fromEntries(contest.teams.map(t => [t.id, t.name]))
    : Object.fromEntries(contest.fencers.map(f => [f.id, `${f.lastName.toUpperCase()} ${f.firstName}`]))

  function fencerName(id?: string) {
    if (!id) return '—'
    return participantMap[id] ?? '?'
  }

  const lockedRounds = stage.lockedRounds ?? []
  // last locked = smallest round number (most recently locked in T32→T16→... progression)
  const lastLockedRound = lockedRounds.length > 0 ? Math.min(...lockedRounds) : null

  // Compute current active round: first non-locked round with real (non-BYE) bouts
  const rounds = Array.from(new Set(stage.bouts.map(b => b.round))).sort((a, b) => b - a)
  const activeRound = rounds.find(round =>
    !lockedRounds.includes(round) &&
    stage.bouts.some(b => b.round === round && b.fencerAId && b.fencerBId)
  )

  // All non-BYE bouts in the active round, and whether they are all done
  const activeBouts = activeRound ? stage.bouts.filter(b => b.round === activeRound && b.fencerAId && b.fencerBId) : []
  const activeAllScored = activeBouts.length > 0 && activeBouts.every(b => b.winnerId)

  // Overall: all non-BYE bouts have a winner → tableau complete

  function startEdit(bout: TableauBout) {
    setEditingBout(bout.id)
    setScoreA(String(bout.scoreA ?? ''))
    setScoreB(String(bout.scoreB ?? ''))
  }

  async function saveBout(boutId: string) {
    if (!stage) return
    const sa = parseInt(scoreA)
    const sb = parseInt(scoreB)
    if (isNaN(sa) || isNaN(sb)) return
    if (sa === sb) return
    if (sa < 0 || sb < 0) return
    if (sa > stage.maxScore || sb > stage.maxScore) return
    await setTableauBoutScore(tournamentId!, contestId!, stageId!, boutId, sa, sb)
    setEditingBout(null)
    setScoreA('')
    setScoreB('')
  }

  async function quickSaveBout(boutId: string, sa: number, sb: number) {
    await setTableauBoutScore(tournamentId!, contestId!, stageId!, boutId, sa, sb)
    setEditingBout(null)
    setScoreA('')
    setScoreB('')
  }

  function printRound(round: number) {
    setPrintingRound(round)
    setTimeout(() => { window.print(); setPrintingRound(null) }, 80)
  }

  // null = default: only active round expanded
  const effectiveExpanded: Set<number> = expandedRounds ?? new Set(activeRound ? [activeRound] : [])

  function toggleRound(round: number) {
    const next = new Set(effectiveExpanded)
    if (next.has(round)) next.delete(round); else next.add(round)
    setExpandedRounds(next)
  }

  async function handleLockRound(round: number) {
    const finalRound = Math.min(...rounds)
    if (round === finalRound) {
      // Locking the finale closes the whole phase
      await lockTableauPhase(tournamentId!, contestId!, stageId!)
    } else {
      await lockTableauRound(tournamentId!, contestId!, stageId!, round)
      // collapse all, expand the next round (round / 2)
      const nextRound = round / 2
      setExpandedRounds(new Set(rounds.includes(nextRound) ? [nextRound] : []))
    }
  }

  return (
    <div className="space-y-5">
      {/* Override @page to landscape for tableau printing, with extra bottom margin for browser footer */}
      {/* @page must NOT be inside @media print — that's invalid CSS and Chrome ignores it */}
      <style>{`@page { size: A4 landscape; margin: 1.5cm 1cm 2.5cm 1cm; }`}</style>
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

      <div className="print:hidden flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{stage.name}</h1>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span>Score max : <strong className="text-gray-700">{stage.maxScore}</strong></span>
            <span>Tableau de <strong className="text-gray-700">{stage.size}</strong></span>
            {stage.hasThirdPlace && <span className="text-gray-700">· 3e place</span>}
          </div>
        </div>
        <div className="print:hidden flex gap-2 flex-wrap">
          {stage.status === 'done' && (
            <>
              <button className="btn-secondary" onClick={() => window.print()}>🖨️ Imprimer le tableau</button>
              <button className="btn-secondary"
                onClick={() => unlockTableauPhase(tournamentId!, contestId!, stageId!)}>
                🔓 Rouvrir pour correction
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active round progress indicator */}
      {stage.status === 'running' && activeRound && (
        <div className="print:hidden bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-semibold text-blue-800">Round en cours : {roundLabelFull(activeRound)}</span>
            <span className="text-blue-600 ml-3">
              {activeBouts.filter(b => b.winnerId).length}/{activeBouts.length} matchs joués
            </span>
          </div>
          {activeAllScored && (
            <span className="text-xs text-green-700 font-medium bg-green-100 px-2 py-1 rounded">
              ✓ Tous les matchs de ce round sont saisis
            </span>
          )}
        </div>
      )}

      <div className="space-y-8 overflow-x-auto print:hidden">
        {rounds.map(round => {
          // 3rd place bout lives at round=4 boutIndex=2 but is displayed in the "Finales" section
          const isFinalesSection = round === 2
          const thirdPlaceBout = isFinalesSection && stage.hasThirdPlace
            ? stage.bouts.find(b => b.round === 4 && b.boutIndex === 2)
            : undefined

          // For demi-finales (round=4): exclude the 3rd place bout from display
          const roundBouts = stage.bouts
            .filter(b => b.round === round && !(round === 4 && b.boutIndex === 2))
            .sort((a, b) => a.boutIndex - b.boutIndex)

          const label = round === 2
            ? (stage.hasThirdPlace ? 'Finales' : 'Finale')
            : round === 4 ? 'Demi-finales'
            : round === 8 ? 'Quarts de finale'
            : `Tableau de ${round}`
          const isActive = round === activeRound
          const isLocked = lockedRounds.includes(round)
          const prevRoundOpen = rounds.includes(round * 2) && !lockedRounds.includes(round * 2)
          const isLastLocked = round === lastLockedRound

          const realBouts = roundBouts.filter(b => b.fencerAId && b.fencerBId)
          // allRoundScored must include 3rd place bout in the Finales section
          const finalesExtra = thirdPlaceBout && thirdPlaceBout.fencerAId && thirdPlaceBout.fencerBId ? [thirdPlaceBout] : []
          const allScoredBouts = [...realBouts, ...finalesExtra]
          const allRoundScored = allScoredBouts.length > 0 && allScoredBouts.every(b => b.winnerId)

          const isExpanded = effectiveExpanded.has(round)
          const boutRoundLocked = isLocked || prevRoundOpen || stage.status === 'done'
          const stageMaxScore = stage.maxScore

          function renderBout(bout: import('../types').TableauBout) {
            return (
              <BracketBout key={bout.id}
                bout={bout}
                nameA={fencerName(bout.fencerAId)}
                nameB={fencerName(bout.fencerBId)}
                maxScore={stageMaxScore}
                isEditing={editingBout === bout.id}
                scoreAInput={scoreA}
                scoreBInput={scoreB}
                onScoreAChange={setScoreA}
                onScoreBChange={setScoreB}
                onEdit={() => startEdit(bout)}
                onSave={() => saveBout(bout.id)}
                onCancel={() => setEditingBout(null)}
                onQuickScore={(sa, sb) => quickSaveBout(bout.id, sa, sb)}
                roundLocked={boutRoundLocked}
              />
            )
          }

          return (
            <div key={round}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <button
                  className={`flex items-center gap-2 font-semibold text-lg text-left hover:opacity-80 transition-opacity ${isActive ? 'text-blue-700' : isLocked ? 'text-gray-400' : 'text-gray-600'}`}
                  onClick={() => toggleRound(round)}
                >
                  <span className="text-sm">{isExpanded ? '▾' : '▸'}</span>
                  {label}{isLocked && <span className="ml-1 text-xs font-normal">🔒</span>}
                </button>
                <div className="flex gap-2 ml-auto">
                  {import.meta.env.DEV && stage.status === 'running' && !isLocked && !prevRoundOpen && allScoredBouts.some(b => !b.winnerId) && (
                    <button className="text-xs py-1 px-2 rounded border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors"
                      onClick={() => fillRandomTableauBouts(tournamentId!, contestId!, stageId!, round)}>
                      🎲
                    </button>
                  )}
                  {realBouts.length > 0 && stage.status === 'running' && (
                    <button className="btn-secondary text-xs py-1 px-2"
                      onClick={() => printRound(round)}>
                      🖨️ Feuilles
                    </button>
                  )}
                  {stage.status === 'running' && !isLocked && allRoundScored && (
                    <button className="text-xs py-1 px-2 rounded border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
                      onClick={() => handleLockRound(round)}>
                      🔒 Clôturer ce round
                    </button>
                  )}
                  {stage.status === 'running' && isLastLocked && (
                    <button className="text-xs py-1 px-2 rounded border border-orange-300 text-orange-700 hover:bg-orange-50 transition-colors"
                      onClick={() => unlockTableauRound(tournamentId!, contestId!, stageId!, round)}>
                      🔓 Rouvrir
                    </button>
                  )}
                </div>
              </div>
              {isExpanded && (
                <>
                  {thirdPlaceBout ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Petite finale</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {renderBout(thirdPlaceBout)}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Finale</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {roundBouts.map(bout => renderBout(bout))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {roundBouts.map(bout => renderBout(bout))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── PRINT-ONLY: feuilles de match (tableau ouvert) ─── */}
      {stage.status === 'running' && (
        <div className="hidden print:block">
          <MatchSheetsPrint stage={stage} fencerName={fencerName} contest={contest} tournament={tournament} roundFilter={printingRound ?? undefined} />
        </div>
      )}

      {/* ─── PRINT-ONLY: arbre du tableau (tableau terminé) ─── */}
      {stage.status === 'done' && (
        <div className="hidden print:block">
          <BracketPrint stage={stage} fencerName={fencerName} contest={contest} tournament={tournament} />
        </div>
      )}
    </div>
  )
}

// ─── Print helpers ────────────────────────────────────────────────────────────

type PrintProps = {
  stage: TableauPhase
  fencerName: (id?: string) => string
  contest: import('../types').Contest
  tournament: import('../types').Tournament
}

function printHeader(stage: TableauPhase, contest: PrintProps['contest'], tournament: PrintProps['tournament']) {
  const weaponLabel = WEAPON_LABEL[contest.weapon] ?? contest.weapon
  const genderLabel = GENDER_LABEL[contest.gender] ?? contest.gender
  const dateLabel = contest.date
    ? new Date(contest.date).toLocaleDateString('fr-FR')
    : tournament.startDate
      ? new Date(tournament.startDate).toLocaleDateString('fr-FR')
      : ''
  const locationLabel = contest.location ?? tournament.location ?? ''
  const meta = [weaponLabel, genderLabel, contest.category].filter(Boolean).join(' · ')
  const detail = [dateLabel, locationLabel].filter(Boolean).join(' — ')
  return (
    <div className="bracket-print-header">
      <h1>{stage.name} — {contest.name}</h1>
      <p>
        {meta}
        {detail && ` · ${detail}`}
        {` · Score max : ${stage.maxScore} · Tableau de ${stage.size}`}
      </p>
    </div>
  )
}

// ─── Feuilles de match (tableau ouvert) ──────────────────────────────────────

function MatchSheetsPrint({ stage, fencerName, roundFilter }: PrintProps & { roundFilter?: number }) {
  // Real matches only (both fencers set = no BYEs), sorted first-round first
  let matchBouts = stage.bouts
    .filter(b => b.fencerAId && b.fencerBId)
    .sort((a, b) => b.round - a.round || a.boutIndex - b.boutIndex)

  if (roundFilter !== undefined) {
    matchBouts = matchBouts.filter(b => b.round === roundFilter)
  }

  const touchCount = Math.min(stage.maxScore, 15)

  // Group into pages of 6 (3 rows × 2 cols)
  const pages: typeof matchBouts[] = []
  for (let i = 0; i < matchBouts.length; i += 6) {
    pages.push(matchBouts.slice(i, i + 6))
  }

  return (
    <div>
      {pages.map((page, pageIdx) => {
        const rows = [page.slice(0, 2), page.slice(2, 4), page.slice(4, 6)].filter(r => r.length > 0)
        return (
          // Block container — break-after:page works on block but not on grid in Chrome
          <div key={pageIdx} className="match-print-page">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="match-sheets-row">
                {row.map(bout => {
                  const matchTotal = stage.bouts.filter(b => b.round === bout.round && b.fencerAId && b.fencerBId).length
                  return (
                    <div key={bout.id} className="match-sheet">
                      <div className="ms-header">
                        <span className="ms-round">{roundLabelFull(bout.round)}</span>
                        <span className="ms-num">Match {bout.boutIndex + 1}/{matchTotal}</span>
                      </div>
                      <div className="ms-info-row">
                        <span>Arbitre&#160;: ________________________________</span>
                        <span>Piste&#160;: ______</span>
                      </div>
                      <div className="ms-fencer-block">
                        <div className="ms-fencer">
                          <div className="ms-fencer-name">{fencerName(bout.fencerAId)}</div>
                          <div className="ms-score-box">{bout.scoreA !== undefined ? String(bout.scoreA) : ''}</div>
                        </div>
                        <div className="ms-touch-row">
                          {Array.from({ length: touchCount }, (_, j) => (
                            <div key={j} className="ms-touch">{j + 1}</div>
                          ))}
                        </div>
                      </div>
                      <div className="ms-sep" />
                      <div className="ms-fencer-block">
                        <div className="ms-fencer">
                          <div className="ms-fencer-name">{fencerName(bout.fencerBId)}</div>
                          <div className="ms-score-box">{bout.scoreB !== undefined ? String(bout.scoreB) : ''}</div>
                        </div>
                        <div className="ms-touch-row">
                          {Array.from({ length: touchCount }, (_, j) => (
                            <div key={j} className="ms-touch">{j + 1}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Arbre du tableau (tableau terminé) ──────────────────────────────────────

function BracketPrint({ stage, fencerName, contest, tournament }: PrintProps) {
  const rounds = Array.from(new Set(stage.bouts.map(b => b.round))).sort((a, b) => b - a)

  // slotH: height in px for one first-round match slot
  // Target: fits on A4 portrait (usable ≈ 1009px at 96dpi with 1.5cm margins)
  const firstRoundCount = stage.size / 2
  const MAX_H = 1009
  const MAX_SLOT_H = 80
  const MIN_SLOT_H = 36
  const MATCH_H = 30 // px for the match box (two 15px fencer rows)
  const slotH = Math.min(MAX_SLOT_H, Math.max(MIN_SLOT_H, Math.floor(MAX_H / firstRoundCount)))
  const treeH = firstRoundCount * slotH

  // Adaptive column width based on bracket size
  const colWidth = stage.size <= 8 ? 180 : stage.size <= 16 ? 165 : stage.size <= 32 ? 150 : stage.size <= 64 ? 130 : 110

  return (
    <div>
      {printHeader(stage, contest, tournament)}

      {/* Round labels */}
      <div style={{ display: 'flex', marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>
        {rounds.map(round => (
          <div key={round} style={{
            width: colWidth, flexShrink: 0, textAlign: 'center',
            fontSize: '7pt', fontWeight: 700, color: '#1e3a5f',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {roundLabelShort(round)}
          </div>
        ))}
      </div>

      {/* Bracket columns — space-around guarantees correct vertical alignment */}
      <div style={{ display: 'flex', fontFamily: 'system-ui, sans-serif', fontSize: '7.5pt' }}>
        {rounds.map(round => {
          const bouts = stage.bouts
            .filter(b => b.round === round)
            .sort((a, b) => a.boutIndex - b.boutIndex)

          return (
            <div key={round} style={{
              display: 'flex', flexDirection: 'column',
              justifyContent: 'space-around',
              width: colWidth, height: treeH,
              flexShrink: 0,
            }}>
              {bouts.map(bout => {
                const winA = !!bout.fencerAId && bout.winnerId === bout.fencerAId
                const winB = !!bout.fencerBId && bout.winnerId === bout.fencerBId
                const byeA = !bout.fencerAId
                const byeB = !bout.fencerBId
                const rowH = MATCH_H / 2

                const rowStyle = (win: boolean, bye: boolean): React.CSSProperties => ({
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 4px', height: rowH,
                  backgroundColor: win ? '#e8f5e9' : undefined,
                  opacity: bye ? 0.4 : 1,
                  fontWeight: win ? 700 : 400,
                  fontStyle: bye ? 'italic' : undefined,
                  overflow: 'hidden',
                })

                return (
                  <div key={bout.id} style={{
                    border: '1px solid #555',
                    margin: '1px 3px',
                    height: MATCH_H,
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    <div style={{ ...rowStyle(winA, byeA), borderBottom: '1px solid #ddd' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {fencerName(bout.fencerAId)}
                      </span>
                      {bout.scoreA !== undefined && (
                        <span style={{ fontWeight: 700, minWidth: 18, textAlign: 'right', flexShrink: 0 }}>{bout.scoreA}</span>
                      )}
                    </div>
                    <div style={rowStyle(winB, byeB)}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {fencerName(bout.fencerBId)}
                      </span>
                      {bout.scoreB !== undefined && (
                        <span style={{ fontWeight: 700, minWidth: 18, textAlign: 'right', flexShrink: 0 }}>{bout.scoreB}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BracketBout({ bout, nameA, nameB, maxScore, isEditing, scoreAInput, scoreBInput, onScoreAChange, onScoreBChange, onEdit, onSave, onCancel, onQuickScore, roundLocked }: {
  bout: TableauBout
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
  onQuickScore: (sa: number, sb: number) => void
  roundLocked: boolean
}) {
  const [openSide, setOpenSide] = useState<'A' | 'B' | null>(null)
  const [popupPos, setPopupPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null)
  const hasResult = bout.scoreA !== undefined && bout.scoreB !== undefined
  const isByeA = !bout.fencerAId
  const isByeB = !bout.fencerBId
  const isBye = isByeA || isByeB
  const canEdit = !isBye && !roundLocked
  const isWinnerA = bout.winnerId === bout.fencerAId
  const isWinnerB = bout.winnerId === bout.fencerBId

  const saNum = parseInt(scoreAInput)
  const sbNum = parseInt(scoreBInput)
  const err = isEditing ? (() => {
    if (isNaN(saNum) || isNaN(sbNum)) return null
    if (saNum < 0 || sbNum < 0) return 'Score n\u00e9gatif impossible'
    if (saNum > maxScore || sbNum > maxScore) return `Score max\u00a0: ${maxScore}`
    if (saNum === sbNum) return '\u00c9galit\u00e9 impossible en tableau'
    return null
  })() : null

  const quickScoresA = Array.from({ length: maxScore }, (_, i) => ({ sa: maxScore, sb: i }))
  const quickScoresB = Array.from({ length: maxScore }, (_, i) => ({ sa: i, sb: maxScore }))

  function handleQuick(sa: number, sb: number) {
    onQuickScore(sa, sb)
    setOpenSide(null)
    setPopupPos(null)
  }

  function openPopup(side: 'A' | 'B', btn: HTMLButtonElement | null) {
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const onRight = rect.left > window.innerWidth / 2
    const onBottom = rect.bottom > window.innerHeight * 0.6
    setPopupPos({
      ...(onBottom ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      ...(onRight ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    })
    setOpenSide(p => p === side ? null : side)
  }

  const QuickPopup = ({ scores, colorClass }: { scores: { sa: number; sb: number }[]; colorClass: string }) => (
    <div style={{ position: 'fixed', top: popupPos?.top, bottom: popupPos?.bottom, left: popupPos?.left, right: popupPos?.right, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl p-1.5 flex flex-col gap-1">
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
    <div className={`border rounded-lg shadow-sm ${hasResult ? 'border-green-200' : 'border-gray-200'}`}>
      {openSide && <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenSide(null); setPopupPos(null) }} />}
      {openSide && popupPos && <QuickPopup scores={openSide === 'A' ? quickScoresA : quickScoresB} colorClass={openSide === 'A' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'} />}

      {/* Row A */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${isWinnerA ? 'bg-green-50' : ''} ${isByeA ? 'opacity-40 italic' : ''}`}>
        <span className={`text-sm truncate ${isWinnerA ? 'font-bold text-green-700' : 'text-gray-700'}`}>{nameA}</span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {isEditing
            ? <input type="number" min="0" max={maxScore} value={scoreAInput} onChange={e => onScoreAChange(e.target.value)}
                className={`w-10 text-center border rounded px-1 py-0.5 text-sm ${err ? 'border-red-400 bg-red-50' : ''}`} autoFocus />
            : bout.scoreA !== undefined && <span className={`text-sm font-mono font-bold ${isWinnerA ? 'text-green-700' : 'text-gray-500'}`}>{bout.scoreA}</span>
          }
          {canEdit && (
            <button className="text-xs px-1.5 py-0.5 rounded border font-medium bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              onClick={e => openPopup('A', e.currentTarget)} title="Victoire haut">V&#9662;</button>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200" />

      {/* Row B */}
      <div className={`flex items-center justify-between px-3 py-2 ${!canEdit && !isEditing ? 'rounded-b-lg' : ''} ${isWinnerB ? 'bg-green-50' : ''} ${isByeB ? 'opacity-40 italic' : ''}`}>
        <span className={`text-sm truncate ${isWinnerB ? 'font-bold text-green-700' : 'text-gray-700'}`}>{nameB}</span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {isEditing
            ? <input type="number" min="0" max={maxScore} value={scoreBInput} onChange={e => onScoreBChange(e.target.value)}
                className={`w-10 text-center border rounded px-1 py-0.5 text-sm ${err ? 'border-red-400 bg-red-50' : ''}`} />
            : bout.scoreB !== undefined && <span className={`text-sm font-mono font-bold ${isWinnerB ? 'text-green-700' : 'text-gray-500'}`}>{bout.scoreB}</span>
          }
          {canEdit && (
            <button className="text-xs px-1.5 py-0.5 rounded border font-medium bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              onClick={e => openPopup('B', e.currentTarget)} title="Victoire bas">&#9662;V</button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-200">
          {err && <p className="text-xs text-red-600 mr-auto">{err}</p>}
          <button className="btn-primary text-xs py-0.5 px-2 disabled:opacity-40" onClick={onSave} disabled={!!err}>&#10003;</button>
          <button className="btn-secondary text-xs py-0.5 px-2" onClick={onCancel}>&#10005;</button>
        </div>
      )}

      {!isEditing && canEdit && (
        <button onClick={onEdit} className="print:hidden w-full text-center text-xs text-blue-500 hover:text-blue-700 py-1 border-t border-gray-100 hover:bg-blue-50 transition-colors rounded-b-lg">
          {hasResult ? 'Modifier le score' : 'Saisir le score'}
        </button>
      )}
    </div>
  )
}

