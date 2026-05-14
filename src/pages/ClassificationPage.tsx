import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { PoolPhase, TableauPhase } from '../types'

const WEAPON_LABEL: Record<string, string> = { epee: 'Épée', foil: 'Fleuret', sabre: 'Sabre' }
const GENDER_LABEL: Record<string, string> = { men: 'Messieurs', women: 'Dames', mixed: 'Mixte' }

export default function ClassificationPage() {
  const { tournamentId, contestId } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)

  if (!tournament || !contest) return <div className="text-red-500">Compétition introuvable</div>

  // Unified participant map: team IDs → name/club for team events, fencer IDs for individual events
  type ParticipantInfo = { name: string; firstName?: string; club?: string; country?: string }
  const participantMap: Record<string, ParticipantInfo> = contest.isTeamEvent
    ? Object.fromEntries(contest.teams.map(t => [t.id, { name: t.name, club: t.club }]))
    : Object.fromEntries(contest.fencers.map(f => [f.id, { name: f.lastName.toUpperCase(), firstName: f.firstName, club: f.club, country: f.country }]))

  // Build classification: prefer tableau results, then pool results
  const lastTableau = [...contest.stages].reverse().find(s => s.type === 'tableau') as TableauPhase | undefined
  const lastPool = [...contest.stages].reverse().find(s => s.type === 'pool' && s.status === 'done') as PoolPhase | undefined

  interface RankEntry {
    rank: number
    fencerId: string
    source: string
  }

  let entries: RankEntry[] = []

  if (lastTableau) {
    // Pool rank lookup for tie-breaking within elimination groups
    const poolRank: Record<string, number> = {}
    if (lastPool) {
      for (const r of lastPool.results) poolRank[r.fencerId] = r.rank
    }

    const ranked: string[] = []

    // 1st / 2nd: from the final
    const finalBout = lastTableau.bouts.find(b => b.round === 2 && b.boutIndex === 0)
    if (finalBout?.winnerId) {
      ranked.push(finalBout.winnerId)
      const finalist = finalBout.fencerAId === finalBout.winnerId ? finalBout.fencerBId : finalBout.fencerAId
      if (finalist) ranked.push(finalist)
    }

    // 3rd / 4th: from petite finale, or ex-aequo semi-final losers sorted by pool rank
    const thirdPlaceBout = lastTableau.hasThirdPlace
      ? lastTableau.bouts.find(b => b.round === 4 && b.boutIndex === 2)
      : undefined
    if (thirdPlaceBout?.winnerId) {
      ranked.push(thirdPlaceBout.winnerId)
      const fourth = thirdPlaceBout.fencerAId === thirdPlaceBout.winnerId ? thirdPlaceBout.fencerBId : thirdPlaceBout.fencerAId
      if (fourth) ranked.push(fourth)
    } else {
      // No petite finale (or not yet played): both semi-final losers ex-aequo 3rd, sorted by pool rank
      const semiLosers = lastTableau.bouts
        .filter(b => b.round === 4 && b.boutIndex !== 2 && b.fencerAId && b.fencerBId && b.winnerId)
        .map(b => (b.fencerAId === b.winnerId ? b.fencerBId! : b.fencerAId!))
        .sort((a, b) => (poolRank[a] ?? 9999) - (poolRank[b] ?? 9999))
      ranked.push(...semiLosers)
    }

    // 5th+, 9th+, 17th+, … : losers of each earlier round, sorted by pool rank within each group
    const eliminationRounds = [...new Set(lastTableau.bouts.map(b => b.round))]
      .filter(r => r >= 8)
      .sort((a, b) => a - b) // 8 → 16 → 32 → 64 → 128

    for (const round of eliminationRounds) {
      const losers = lastTableau.bouts
        .filter(b => b.round === round && b.fencerAId && b.fencerBId && b.winnerId)
        .map(b => (b.fencerAId === b.winnerId ? b.fencerBId! : b.fencerAId!))
        .filter(id => !ranked.includes(id))
        .sort((a, b) => (poolRank[a] ?? 9999) - (poolRank[b] ?? 9999))
      ranked.push(...losers)
    }

    // Remaining present fencers (didn't play / no result yet), sorted by pool rank
    const allPresent = contest.isTeamEvent
      ? contest.teams.filter(t => t.present).map(t => t.id)
      : contest.fencers.filter(f => f.present).map(f => f.id)
    const remaining = allPresent
      .filter(id => !ranked.includes(id))
      .sort((a, b) => (poolRank[a] ?? 9999) - (poolRank[b] ?? 9999))
    ranked.push(...remaining)

    entries = ranked.map((fId, idx) => ({ rank: idx + 1, fencerId: fId, source: 'tableau' }))
  } else if (lastPool) {
    entries = lastPool.results.map(r => ({ rank: r.rank, fencerId: r.fencerId, source: 'pool' }))
  } else {
    // No results yet — show all present participants by initial rank
    if (contest.isTeamEvent) {
      entries = contest.teams
        .filter(t => t.present)
        .sort((a, b) => (a.initialRank ?? 99999) - (b.initialRank ?? 99999))
        .map((t, idx) => ({ rank: idx + 1, fencerId: t.id, source: 'initial' }))
    } else {
      entries = contest.fencers
        .filter(f => f.present)
        .sort((a, b) => (a.initialRank ?? 9999) - (b.initialRank ?? 9999))
        .map((f, idx) => ({ rank: idx + 1, fencerId: f.id, source: 'initial' }))
    }
  }

  function handlePrint() {
    window.print()
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
        <span className="text-gray-800 font-medium">Classement</span>
      </div>

      {/* En-tête d'impression — visible uniquement à l'impression */}
      <div className="hidden print:block mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-xl font-bold">Classement général — {contest.name}</h1>
        <p className="text-sm mt-1">
          {WEAPON_LABEL[contest.weapon] ?? contest.weapon}
          {' '}{GENDER_LABEL[contest.gender] ?? contest.gender}
          {contest.category ? ` · ${contest.category}` : ''}
        </p>
        {(contest.organizer || tournament.organizer) && (
          <p className="text-xs text-gray-600 mt-0.5">
            Organisateur&nbsp;: {contest.organizer ?? tournament.organizer}
          </p>
        )}
        {(contest.location || tournament.location || contest.date || tournament.startDate) && (
          <p className="text-xs text-gray-600 mt-0.5">
            {[
              contest.location ?? tournament.location,
              (contest.date ?? tournament.startDate)
                ? new Date((contest.date ?? tournament.startDate)!).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : undefined,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-gray-800">Classement général — {contest.name}</h1>
        <button className="btn-secondary" onClick={handlePrint}>🖨️ Imprimer</button>
      </div>

      <div className="card p-0 overflow-hidden print:shadow-none print:border-0">
        <table className="w-full text-sm">
          <thead className="bg-[#1e3a5f] text-white print:bg-[#1e3a5f]">
            <tr>
              <th className="px-4 py-3 text-left w-16">Rang</th>
              <th className="px-4 py-3 text-left" colSpan={contest.isTeamEvent ? 2 : 1}>Nom</th>
              {!contest.isTeamEvent && <th className="px-4 py-3 text-left">Prénom</th>}
              <th className="px-4 py-3 text-left hidden sm:table-cell print:table-cell">Club</th>
              <th className="px-4 py-3 text-left hidden md:table-cell print:table-cell">Nation</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => {
              const p = participantMap[entry.fencerId]
              return (
                <tr key={entry.fencerId} className={`border-b border-gray-100 ${entry.rank <= 3 ? 'bg-yellow-50' : entry.rank % 2 === 0 ? 'bg-gray-50' : ''}`}>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold
                      ${entry.rank === 1 ? 'bg-yellow-400 text-white' : entry.rank === 2 ? 'bg-gray-300 text-white' : entry.rank === 3 ? 'bg-amber-600 text-white' : 'text-gray-600'}`}>
                      {entry.rank}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800" colSpan={contest.isTeamEvent ? 2 : 1}>{p?.name ?? '?'}</td>
                  {!contest.isTeamEvent && <td className="px-4 py-2 text-gray-600">{p?.firstName ?? '—'}</td>}
                  {contest.isTeamEvent && <td className="px-4 py-2 text-gray-500 hidden sm:table-cell print:table-cell">{p?.club ?? '—'}</td>}
                  {!contest.isTeamEvent && <td className="px-4 py-2 text-gray-500 hidden sm:table-cell print:table-cell">{p?.club ?? '—'}</td>}
                  <td className="px-4 py-2 text-gray-500 hidden md:table-cell print:table-cell">{p?.country ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
