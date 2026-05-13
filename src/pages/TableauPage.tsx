import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { TableauPhase, TableauBout } from '../types'

export default function TableauPage() {
  const { tournamentId, contestId, stageId } = useParams<{ tournamentId: string; contestId: string; stageId: string }>()
  const { tournaments, setTableauBoutScore, fillRandomTableauBouts } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const stage = contest?.stages.find(s => s.id === stageId) as TableauPhase | undefined

  const [editingBout, setEditingBout] = useState<string | null>(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')

  if (!tournament || !contest || !stage || stage.type !== 'tableau') return <div className="text-red-500">Tableau introuvable</div>

  const fencerMap = Object.fromEntries(contest.fencers.map(f => [f.id, f]))

  function fencerName(id?: string) {
    if (!id) return 'BYE'
    const f = fencerMap[id]
    return f ? `${f.lastName.toUpperCase()} ${f.firstName}` : '?'
  }

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
    if (sa !== stage.maxScore && sb !== stage.maxScore) return
    await setTableauBoutScore(tournamentId!, contestId!, stageId!, boutId, sa, sb)
    setEditingBout(null)
    setScoreA('')
    setScoreB('')
  }

  // Group bouts by round (descending: size → 2)
  const rounds = Array.from(new Set(stage.bouts.map(b => b.round))).sort((a, b) => b - a)

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
            <span>Tableau de <strong className="text-gray-700">{stage.size}</strong></span>
            {stage.hasThirdPlace && <span className="text-gray-700">· 3e place</span>}
          </div>
        </div>
        <div className="print:hidden flex gap-2 flex-wrap">
          {import.meta.env.DEV && (
            <button className="btn-secondary border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={() => fillRandomTableauBouts(tournamentId!, contestId!, stageId!)}>
              🎲 Scores aléatoires
            </button>
          )}
          <button className="btn-secondary" onClick={() => window.print()}>🖨️ Imprimer</button>
        </div>
      </div>

      <div className="space-y-8 overflow-x-auto">
        {rounds.map(round => {
          const roundBouts = stage.bouts.filter(b => b.round === round).sort((a, b) => a.boutIndex - b.boutIndex)
          const label = round === 2 ? 'Finale' : round === 4 ? 'Demi-finales' : round === 8 ? 'Quarts de finale' : `Tableau de ${round}`
          return (
            <div key={round}>
              <h2 className="font-semibold text-gray-700 mb-3 text-lg">{label}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {roundBouts.map(bout => (
                  <BracketBout key={bout.id}
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
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BracketBout({ bout, nameA, nameB, maxScore, isEditing, scoreAInput, scoreBInput, onScoreAChange, onScoreBChange, onEdit, onSave, onCancel }: {
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
}) {
  const hasResult = bout.scoreA !== undefined && bout.scoreB !== undefined
  const isBye = !bout.fencerAId || !bout.fencerBId
  const canEdit = !isBye && !hasResult

  return (
    <div className={`border rounded-lg overflow-hidden shadow-sm ${hasResult ? 'border-green-200' : 'border-gray-200'}`}>
      <FencerSlot name={nameA} score={bout.scoreA} isWinner={bout.winnerId === bout.fencerAId} isBye={!bout.fencerAId} />
      <div className="border-t border-gray-200" />
      <FencerSlot name={nameB} score={bout.scoreB} isWinner={bout.winnerId === bout.fencerBId} isBye={!bout.fencerBId} />
      {isEditing ? (
        <div className="print:hidden bg-blue-50 px-3 py-2 border-t border-blue-200 space-y-1">
          {(() => {
            const sa = parseInt(scoreAInput)
            const sb = parseInt(scoreBInput)
            const err = (() => {
              if (isNaN(sa) || isNaN(sb)) return null
              if (sa < 0 || sb < 0) return 'Score négatif impossible'
              if (sa > maxScore || sb > maxScore) return `Score max : ${maxScore}`
              if (sa === sb) return 'Égalité impossible en tableau'
              if (sa !== maxScore && sb !== maxScore) return `Un des scores doit être ${maxScore}`
              return null
            })()
            return (
              <>
                <div className="flex gap-2 items-center">
                  <input type="number" min="0" max={maxScore} value={scoreAInput} onChange={e => onScoreAChange(e.target.value)}
                    className={`w-10 text-center border rounded px-1 py-0.5 text-sm ${err ? 'border-red-400 bg-red-50' : ''}`} autoFocus />
                  <span className="text-gray-400">—</span>
                  <input type="number" min="0" max={maxScore} value={scoreBInput} onChange={e => onScoreBChange(e.target.value)}
                    className={`w-10 text-center border rounded px-1 py-0.5 text-sm ${err ? 'border-red-400 bg-red-50' : ''}`} />
                  <button className="btn-primary text-xs py-0.5 px-2 ml-auto disabled:opacity-40" onClick={onSave} disabled={!!err}>✓</button>
                  <button className="btn-secondary text-xs py-0.5 px-2" onClick={onCancel}>✕</button>
                </div>
                {err && <p className="text-xs text-red-600 text-center">{err}</p>}
              </>
            )
          })()}
        </div>
      ) : (
        canEdit && (
          <button onClick={onEdit} className="print:hidden w-full text-center text-xs text-blue-500 hover:text-blue-700 py-1 border-t border-gray-100 hover:bg-blue-50 transition-colors">
            Saisir le score
          </button>
        )
      )}
    </div>
  )
}

function FencerSlot({ name, score, isWinner, isBye }: { name: string; score?: number; isWinner: boolean; isBye: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${isWinner ? 'bg-green-50' : ''} ${isBye ? 'opacity-40 italic' : ''}`}>
      <span className={`text-sm truncate ${isWinner ? 'font-bold text-green-700' : 'text-gray-700'}`}>{name}</span>
      {score !== undefined && (
        <span className={`text-sm font-mono ml-2 font-bold ${isWinner ? 'text-green-700' : 'text-gray-500'}`}>{score}</span>
      )}
    </div>
  )
}
