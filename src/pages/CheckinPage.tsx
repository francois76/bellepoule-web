import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import { importFFF, importBellePouleXML, readFileText } from '../logic/importExport'
import type { Fencer, Team } from '../types'
import { ContestBreadcrumb } from '../components/ContestBreadcrumb'
import { BackArrow } from '../components/BackArrow'
import { DEFAULT_DISPLAY_CONFIG } from '../types'

const DEV_LAST_NAMES = ['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','Andre','Lefevre','Mercier','Dupont','Lambert','Bonnet','François','Martinez']
const DEV_FIRST_NAMES = ['Hugo','Lucas','Léo','Louis','Gabriel','Noah','Raphaël','Arthur','Ethan','Alexandre','Léa','Emma','Chloé','Manon','Inès','Alice','Camille','Julie','Lucie','Anaïs']
const DEV_CLUBS = ['CSM Clamart','Châlons','Rodez','Paris UC','Grenoble Escrime','Bordeaux EC','Toulouse Escrime','Lyon AE','Nantes EC','Rennes EA']

const EMPTY_FENCER_FORM = { lastName: '', firstName: '', gender: 'M' as 'M' | 'F', club: '', birthDate: '', licenceNumber: '', initialRank: '' }
const EMPTY_TEAM_FORM = { name: '', club: '', initialRank: '', fencerIds: [] as string[], rankingMode: 'auto' as 'auto' | 'manual' }

function cmp<T>(a: T, b: T, dir: 'asc' | 'desc') {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  let r: number
  if (a < b) { r = -1 } else if (a > b) { r = 1 } else { r = 0 }
  return dir === 'asc' ? r : -r
}

function sortArrow(col: string, sort: { key: string; dir: 'asc' | 'desc' }) {
  if (sort.key !== col) return <span className="ml-1 text-gray-300">⇅</span>
  return <span className="ml-1">{sort.dir === 'asc' ? '↑' : '↓'}</span>
}

function validateFencer(f: typeof EMPTY_FENCER_FORM, displayConfig: typeof DEFAULT_DISPLAY_CONFIG) {
  if (!f.lastName.trim()) return "Le nom est obligatoire."
  if (!f.firstName.trim()) return "Le prénom est obligatoire."
  if (displayConfig.dateOfBirth.visible && !f.birthDate) return "La date de naissance est obligatoire."
  if (displayConfig.licence.visible && !f.licenceNumber.trim()) return "Le numéro de licence est obligatoire."
  if (displayConfig.club.visible && !f.club.trim()) return "Le club est obligatoire."
  return null
}

type TeamRowProps = Readonly<{ team: Team; idx: number; contest: import('../types').Contest; minTeamSize: number; tournamentId: string; contestId: string; onEdit: (team: Team) => void; onDelete: (id: string) => void; setTeamPresence: (tid: string, cid: string, teamId: string, v: boolean) => void }>
function TeamRow({ team, idx, contest, minTeamSize, tournamentId, contestId, onEdit, onDelete, setTeamPresence }: TeamRowProps) {
  const memberFencers = team.fencerIds.map(id => contest.fencers.find(f => f.id === id)).filter(Boolean) as Fencer[]
  const presentMembers = memberFencers.filter(f => f.present).length
  const hasRanks = contest.teams.some(t => t.initialRank !== undefined)
  return (
    <tr className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50'} ${!team.present ? 'opacity-50' : ''}`}>
      <td className="px-4 py-2"><input type="checkbox" checked={team.present !== false} disabled={presentMembers < minTeamSize && team.present === false} title={presentMembers < minTeamSize && team.present === false ? `Minimum requis : ${minTeamSize} membre(s) présent(s) (${presentMembers} actuellement)` : undefined} onChange={e => setTeamPresence(tournamentId, contestId, team.id, e.target.checked)} className="w-4 h-4 accent-blue-600 disabled:opacity-40 disabled:cursor-not-allowed" /></td>
      <td className="px-4 py-2 font-medium text-gray-800">{team.name}</td>
      <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{team.club ?? '—'}</td>
      <td className="px-4 py-2 text-gray-600">
        <span className={presentMembers < minTeamSize ? 'text-orange-600 font-medium' : 'text-green-700'}>{presentMembers}</span>
        <span className="text-gray-400"> / {memberFencers.length}</span>
        {presentMembers < minTeamSize && <span className="ml-1 text-orange-600 text-xs" title={`Minimum requis : ${minTeamSize} membre(s) présent(s)`}>⚠️ min {minTeamSize}</span>}
      </td>
      {hasRanks && <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{team.initialRank ?? '—'}</td>}
      <td className="px-4 py-2 flex gap-2 justify-end">
        <button className="text-gray-400 hover:text-blue-600 transition-colors text-xs" onClick={() => onEdit(team)}>✎</button>
        <button className="text-gray-300 hover:text-red-500 transition-colors" onClick={() => { if (confirm(`Supprimer l'équipe "${team.name}" ?`)) onDelete(team.id) }}>✕</button>
      </td>
    </tr>
  )
}

type TeamEditRowProps = Readonly<{ team: Team; editingTeamRowRef: React.RefObject<HTMLTableRowElement | null>; contest: import('../types').Contest; form: typeof EMPTY_TEAM_FORM; setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_TEAM_FORM>>; editingTeamId: string | null; onCancel: () => void; onSave: (e: React.SubmitEvent<HTMLFormElement>, team: Team) => void }>
function TeamEditRow({ team, editingTeamRowRef, contest, form, setForm, editingTeamId, onCancel, onSave }: TeamEditRowProps) {
  return (
    <tr ref={editingTeamRowRef} className="border-b border-blue-200 bg-blue-50">
      <td colSpan={99} className="px-4 py-3">
        <form onSubmit={e => onSave(e, team)} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="label" htmlFor="team-edit-name">Nom *</label><input id="team-edit-name" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label" htmlFor="team-edit-club">Club</label><input id="team-edit-club" className="input" value={form.club} onChange={e => setForm(f => ({ ...f, club: e.target.value }))} /></div>
            <div>
              <p className="label">Classement</p>
              <div className="flex gap-3 mt-1">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="rankingMode" className="accent-blue-600" checked={form.rankingMode === 'auto'} onChange={() => setForm(f => ({ ...f, rankingMode: 'auto' }))} /><span className="text-sm text-gray-700">Auto</span></label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="rankingMode" className="accent-blue-600" checked={form.rankingMode === 'manual'} onChange={() => setForm(f => ({ ...f, rankingMode: 'manual' }))} /><span className="text-sm text-gray-700">Manuel</span></label>
              </div>
              {form.rankingMode === 'manual' && <input type="number" className="input mt-1" value={form.initialRank} onChange={e => setForm(f => ({ ...f, initialRank: e.target.value }))} placeholder="Rang" />}
            </div>
            <TeamMemberPicker fencerIds={form.fencerIds} onChange={ids => setForm(f => ({ ...f, fencerIds: ids }))} contest={contest} editingTeamId={editingTeamId} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary text-sm" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn-primary text-sm">Enregistrer</button>
          </div>
        </form>
      </td>
    </tr>
  )
}

function TeamsSection({ filter }: Readonly<{ filter: string }>) {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, addTeam, updateTeam, removeTeam, setTeamPresence, setAllPresence } = useStore()
  const contest = tournaments.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)

  const [addingTeam, setAddingTeam] = useState(false)
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM_FORM)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editTeamForm, setEditTeamForm] = useState(EMPTY_TEAM_FORM)
  const [teamSort, setTeamSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' })
  const editingTeamRowRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (editingTeamId) editingTeamRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [editingTeamId])

  if (!contest) return null

  const minTeamSize = contest.minTeamSize ?? 3
  const toggleTeamSort = (key: string) =>
    setTeamSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

  const filteredTeams = contest.teams.filter(t =>
    `${t.name} ${t.club ?? ''}`.toLowerCase().includes(filter.toLowerCase()) ||
    t.fencerIds.some(id => {
      const f = contest.fencers.find(f => f.id === id)
      return f && `${f.lastName} ${f.firstName}`.toLowerCase().includes(filter.toLowerCase())
    })
  )
  const teamSortKey: Record<string, (t: Team) => unknown> = {
    present: t => t.present !== false ? 0 : 1,
    name: t => t.name,
    club: t => t.club ?? '',
    initialRank: t => t.initialRank,
    presentMembers: t => t.fencerIds.filter(id => contest.fencers.find(f => f.id === id)?.present).length,
  }
  const sortedTeams = [...filteredTeams].sort((a, b) =>
    cmp(teamSortKey[teamSort.key]?.(a), teamSortKey[teamSort.key]?.(b), teamSort.dir)
  )

  function startEditTeam(team: Team) {
    setEditingTeamId(team.id)
    setEditTeamForm({
      name: team.name, club: team.club ?? '', initialRank: team.initialRank?.toString() ?? '',
      fencerIds: [...team.fencerIds], rankingMode: team.rankingMode ?? 'auto',
    })
  }

  async function handleAddTeam(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!teamForm.name.trim()) return
    await addTeam(tournamentId, contestId, {
      name: teamForm.name.trim(), club: teamForm.club.trim() || undefined,
      initialRank: teamForm.initialRank ? parseInt(teamForm.initialRank) : undefined,
      fencerIds: teamForm.fencerIds, present: true,
    })
    setTeamForm(EMPTY_TEAM_FORM)
    setAddingTeam(false)
  }

  function handleSaveTeam(e: React.SubmitEvent<HTMLFormElement>, team: Team) {
    e.preventDefault()
    if (!contest || !editTeamForm.name.trim()) return
    let initialRank: number | undefined
    if (editTeamForm.rankingMode === 'manual' && editTeamForm.initialRank) {
      initialRank = parseInt(editTeamForm.initialRank)
    } else if (editTeamForm.rankingMode === 'auto') {
      const memberRanks = editTeamForm.fencerIds
        .map(id => contest.fencers.find(f => f.id === id)?.initialRank ?? 99999)
        .sort((a, b) => a - b)
      const n = Math.min(3, memberRanks.length)
      const sum = memberRanks.slice(0, n).reduce((s, r) => s + r, 0)
      initialRank = n > 0 && sum < 99999 * n ? sum : undefined
    }
    updateTeam(tournamentId, contestId, {
      ...team, name: editTeamForm.name.trim(), club: editTeamForm.club.trim() || undefined,
      rankingMode: editTeamForm.rankingMode, initialRank, fencerIds: editTeamForm.fencerIds,
    }).then(() => setEditingTeamId(null))
  }

  return (
    <div className="shrink-0 card p-0 overflow-y-auto max-h-[50vh]">
      <div className="sticky top-0 z-10 px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
        <h2 className="font-semibold text-blue-800">Équipes</h2>
        <div className="flex gap-2">
          <button className="text-xs btn-secondary py-1 px-2" onClick={() => setAllPresence(tournamentId, contestId, true)}>Toutes présentes</button>
          <button className="text-xs btn-secondary py-1 px-2" onClick={() => setAllPresence(tournamentId, contestId, false)}>Toutes absentes</button>
          <button className="text-xs btn-primary py-1 px-2" onClick={() => { setAddingTeam(true); setTeamForm(EMPTY_TEAM_FORM) }}>+ Équipe</button>
        </div>
      </div>
      {addingTeam && (
        <form onSubmit={handleAddTeam} className="px-4 py-3 border-b border-blue-100 bg-blue-50/50 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Nouvelle équipe</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="label" htmlFor="team-add-name">Nom *</label><input id="team-add-name" className="input" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label" htmlFor="team-add-club">Club</label><input id="team-add-club" className="input" value={teamForm.club} onChange={e => setTeamForm(f => ({ ...f, club: e.target.value }))} /></div>
            <div><label className="label" htmlFor="team-add-rank">Rang initial</label><input id="team-add-rank" type="number" className="input" value={teamForm.initialRank} onChange={e => setTeamForm(f => ({ ...f, initialRank: e.target.value }))} placeholder="1" /></div>
            <TeamMemberPicker fencerIds={teamForm.fencerIds} onChange={ids => setTeamForm(f => ({ ...f, fencerIds: ids }))} contest={contest} editingTeamId={editingTeamId} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary text-sm" onClick={() => setAddingTeam(false)}>Annuler</button>
            <button type="submit" className="btn-primary text-sm">Ajouter</button>
          </div>
        </form>
      )}
      {contest.teams.length > 0 && (
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleTeamSort('present')}>Présente{sortArrow('present', teamSort)}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleTeamSort('name')}>Équipe{sortArrow('name', teamSort)}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 hidden sm:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleTeamSort('club')}>Club{sortArrow('club', teamSort)}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleTeamSort('presentMembers')}>Membres présents{sortArrow('presentMembers', teamSort)}</th>
                {contest.teams.some(t => t.initialRank !== undefined) && (
                  <th className="px-4 py-2 text-left font-medium text-gray-600 hidden md:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleTeamSort('initialRank')}>Rang{sortArrow('initialRank', teamSort)}</th>
                )}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, idx) => {
                if (editingTeamId === team.id) {
                  return <TeamEditRow key={team.id} team={team} editingTeamRowRef={editingTeamRowRef} contest={contest} form={editTeamForm} setForm={setEditTeamForm} editingTeamId={editingTeamId} onCancel={() => setEditingTeamId(null)} onSave={handleSaveTeam} />
                }
                return <TeamRow key={team.id} team={team} idx={idx} contest={contest} minTeamSize={minTeamSize} tournamentId={tournamentId} contestId={contestId} onEdit={startEditTeam} onDelete={id => removeTeam(tournamentId, contestId, id)} setTeamPresence={setTeamPresence} />
              })}
            </tbody>
          </table>
        </div>
      )}
      {contest.teams.length === 0 && !addingTeam && (
        <p className="text-center text-gray-400 py-6 text-sm">Aucune équipe — cliquez sur « + Équipe » pour en ajouter une.</p>
      )}
    </div>
  )
}

function PrintSection() {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  if (!tournament || !contest) return null
  const displayConfig = contest.displayConfig ?? DEFAULT_DISPLAY_CONFIG
  const allFencersSorted = [...contest.fencers].sort((a, b) =>
    a.lastName.toUpperCase().localeCompare(b.lastName.toUpperCase()) || a.firstName.localeCompare(b.firstName)
  )
  const tournamentName = tournament.name
  return (
    <div className="hidden checkin-print-only">
      <div className="checkin-print-header">{tournamentName} — {contest.name}</div>
      <div className="checkin-print-sub">
        Liste des inscrits — imprimée le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
        {' | '}{contest.fencers.filter(f => f.present).length} présent(s) / {contest.fencers.length} inscrit(s)
      </div>
      {contest.isTeamEvent && contest.teams.length > 0 && (
        <>
          <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 12 }}>Équipes</div>
          <table className="checkin-print-table" style={{ marginBottom: 20 }}>
            <thead><tr><th>#</th><th>Équipe</th><th>Club</th><th>Rang</th><th>Présente</th><th>Membres</th></tr></thead>
            <tbody>
              {[...contest.teams]
                .sort((a, b) => (a.initialRank ?? 999) - (b.initialRank ?? 999) || a.name.localeCompare(b.name))
                .map((team, idx) => {
                  const members = team.fencerIds.map(id => contest.fencers.find(f => f.id === id)).filter(Boolean) as Fencer[]
                  return (
                    <tr key={team.id}>
                      <td>{idx + 1}</td><td>{team.name}</td><td>{team.club ?? '—'}</td>
                      <td>{team.initialRank ?? '—'}</td>
                      <td>{team.present !== false ? 'Oui' : 'Non'}</td>
                      <td>{members.map(m => `${m.lastName.toUpperCase()} ${m.firstName}`).join(', ')}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </>
      )}
      <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 12 }}>
        {contest.isTeamEvent ? 'Membres (liste individuelle)' : 'Participants'}
      </div>
      <table className="checkin-print-table">
        <thead>
          <tr>
            <th>#</th><th>Nom</th><th>Prénom</th>
            {contest.isTeamEvent && <th>Équipe</th>}
            {displayConfig.club.onCheckin && <th>Club</th>}
            {displayConfig.league?.onCheckin && <th>Ligue</th>}
            {displayConfig.licence.onCheckin && <th>Licence</th>}
            {displayConfig.dateOfBirth.onCheckin && <th>Né(e) le</th>}
            {displayConfig.initialRank.onCheckin && <th>Rang</th>}
            <th>Présent</th>
          </tr>
        </thead>
        <tbody>
          {allFencersSorted.map((f, idx) => {
            const team = contest.isTeamEvent ? contest.teams.find(t => t.fencerIds.includes(f.id)) : undefined
            return (
              <tr key={f.id}>
                <td>{idx + 1}</td><td>{f.lastName.toUpperCase()}</td><td>{f.firstName}</td>
                {contest.isTeamEvent && <td>{team?.name ?? '—'}</td>}
                {displayConfig.club.onCheckin && <td>{f.club ?? '—'}</td>}
                {displayConfig.league?.onCheckin && <td>{f.league ?? '—'}</td>}
                {displayConfig.licence.onCheckin && <td>{f.licenceNumber ?? '—'}</td>}
                {displayConfig.dateOfBirth.onCheckin && <td>{f.birthDate ? new Date(f.birthDate).toLocaleDateString('fr-FR') : '—'}</td>}
                {displayConfig.initialRank.onCheckin && <td>{f.initialRank ?? '—'}</td>}
                <td>{f.present ? '✓' : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PresenceHeader() {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments } = useStore()
  const contest = tournaments.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
  if (!contest) return null
  const presentCount = contest.fencers.filter(f => f.present).length
  const totalFencers = contest.fencers.length
  const allFencersPresent = totalFencers > 0 && presentCount === totalFencers
  const presentTeams = contest.teams.filter(t => t.present !== false).length
  const totalTeams = contest.teams.length
  const allTeamsPresent = totalTeams > 0 && presentTeams === totalTeams
  return (
    <div className="shrink-0 flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-800">Checkin</h1>
      <div className="flex items-center gap-3">
        {contest.isTeamEvent && (
          <span className={`text-base font-semibold flex items-center gap-1.5 ${allTeamsPresent ? 'text-green-700' : 'text-orange-600'}`}>
            {allTeamsPresent ? '✔' : '⚠'} {presentTeams} / {totalTeams} équipe{totalTeams > 1 ? 's' : ''} présente{totalTeams > 1 ? 's' : ''}
          </span>
        )}
        <span className={`text-base font-semibold flex items-center gap-1.5 ${allFencersPresent ? 'text-green-700' : 'text-orange-600'}`}>
          {allFencersPresent ? '✔' : '⚠'} {presentCount} / {totalFencers} tireur{totalFencers > 1 ? 's' : ''} présent{totalFencers > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

function plural(n: number, word: string, suffix: string) {
  return `${n} ${word}${n > 1 ? suffix : ''}`
}

function PresenceStatusBanner() {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments } = useStore()
  const contest = tournaments.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
  if (!contest) return null
  const presentCount = contest.fencers.filter(f => f.present).length
  const totalFencers = contest.fencers.length
  if (totalFencers === 0) return null
  const allFencersPresent = presentCount === totalFencers
  const presentTeams = contest.teams.filter(t => t.present !== false).length
  const totalTeams = contest.teams.length
  const allTeamsPresent = totalTeams === 0 || presentTeams === totalTeams
  const allPresent = contest.isTeamEvent ? allFencersPresent && allTeamsPresent : allFencersPresent
  const missingFencers = totalFencers - presentCount
  const missingTeams = totalTeams - presentTeams
  const bannerClass = allPresent
    ? 'bg-green-50 border border-green-200 text-green-800'
    : 'bg-orange-50 border border-orange-200 text-orange-800'
  return (
    <div className={`shrink-0 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${bannerClass}`}>
      <span className="text-lg leading-none mt-0.5">{allPresent ? '✅' : '⚠️'}</span>
      {allPresent
        ? <span><strong>Tout le monde est présent.</strong> La compétition peut démarrer.</span>
        : <span>
            <strong>Checkin incomplet.</strong>{' '}
            {missingFencers > 0 && <span>{plural(missingFencers, 'tireur', 's')} non présent{missingFencers > 1 ? 's' : ''}. </span>}
            {contest.isTeamEvent && missingTeams > 0 && <span>{plural(missingTeams, 'équipe', 's')} non présente{missingTeams > 1 ? 's' : ''}. </span>}
            Les tireurs et équipes non cochés <strong>ne seront pas intégrés à la compétition</strong> lors de l'allocation des poules ou du tableau.
          </span>
      }
    </div>
  )
}

function FencerToolbar({ filter, setFilter }: Readonly<{ filter: string; setFilter: (v: string) => void }>) {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, addFencer, addTeam, setAllPresence } = useStore()
  const contest = tournaments.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
  const [devCount, setDevCount] = useState('12')

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await readFileText(file)
    let fencers: Fencer[] = []
    let importedTeams: Team[] = []
    try {
      if (file.name.endsWith('.fff') || file.name.endsWith('.FFF')) {
        fencers = importFFF(text) as unknown as Fencer[]
      } else if (file.name.endsWith('.xml') || file.name.endsWith('.XML') || file.name.endsWith('.cotcot')) {
        try {
          const partial = importBellePouleXML(text)
          fencers = partial.fencers ?? []
          importedTeams = partial.teams ?? []
        } catch {
          fencers = importFFF(text) as unknown as Fencer[]
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur import fichier')
    }
    for (const f of fencers) await addFencer(tournamentId, contestId, f)
    for (const team of importedTeams) await addTeam(tournamentId, contestId, { name: team.name, club: team.club, fencerIds: team.fencerIds, present: team.present, initialRank: team.initialRank })
    e.target.value = ''
  }

  async function handleInjectFakers() {
    if (!contest) return
    const n = parseInt(devCount) || 12
    const existing = contest.fencers.length
    for (let i = 0; i < n; i++) {
      const rank = existing + i + 1
      await addFencer(tournamentId, contestId, {
        lastName: DEV_LAST_NAMES[(rank * 7) % DEV_LAST_NAMES.length],
        firstName: DEV_FIRST_NAMES[(rank * 3) % DEV_FIRST_NAMES.length],
        gender: rank % 3 === 0 ? 'F' : 'M',
        club: DEV_CLUBS[rank % DEV_CLUBS.length],
        birthDate: `${1990 + (rank % 35)}-01-01`,
        licenceNumber: `LIC-${rank}`,
        initialRank: rank,
        present: true,
      })
    }
  }

  return (
    <div className="shrink-0 flex flex-wrap gap-2">
      <input className="input flex-1 min-w-48"
        placeholder={contest?.isTeamEvent ? 'Rechercher un membre…' : 'Rechercher un tireur…'}
        value={filter} onChange={e => setFilter(e.target.value)} />
      <button className="btn-secondary text-sm" onClick={() => setAllPresence(tournamentId, contestId, true)}>Tous présents</button>
      <button className="btn-secondary text-sm" onClick={() => setAllPresence(tournamentId, contestId, false)}>Tous absents</button>
      <label className="btn-secondary cursor-pointer text-sm">
        📂 Importer FFF/XML/cotcot
        <input type="file" accept=".fff,.FFF,.xml,.XML,.cotcot" className="hidden" onChange={handleImportFile} />
      </label>
      <button className="btn-secondary text-sm" onClick={() => window.print()} title="Imprimer la liste des inscrits">🖨 Imprimer</button>
      {import.meta.env.DEV && (
        <div className="flex items-center gap-1 border border-orange-300 rounded-lg px-2 py-1 bg-orange-50" title="Dev only">
          <span className="text-xs text-orange-600 font-medium">DEV</span>
          <input type="number" min={1} max={200} value={devCount} onChange={e => setDevCount(e.target.value)} className="w-12 text-center border border-orange-300 rounded text-sm px-1 py-0.5 bg-white" />
          <button className="text-xs text-orange-700 font-medium hover:text-orange-900 whitespace-nowrap" onClick={handleInjectFakers}>Inject tireurs</button>
        </div>
      )}
    </div>
  )
}

function AddFencerForm() {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, addFencer } = useStore()
  const contest = tournaments.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FENCER_FORM)
  if (!contest) return null
  const displayConfig = contest.displayConfig ?? DEFAULT_DISPLAY_CONFIG

  async function handleAdd(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const err = validateFencer(form, displayConfig)
    if (err) return alert(err)
    await addFencer(tournamentId, contestId, {
      lastName: form.lastName.trim(), firstName: form.firstName.trim(), gender: form.gender,
      club: form.club.trim() || undefined, birthDate: form.birthDate || undefined,
      licenceNumber: form.licenceNumber.trim() || undefined,
      initialRank: form.initialRank ? parseInt(form.initialRank) : undefined, present: true,
    })
    setForm(EMPTY_FENCER_FORM)
    setAdding(false)
  }

  if (!adding) return <button className="btn-primary text-sm shrink-0 self-end" onClick={() => setAdding(true)}>+ Ajouter tireur</button>
  return (
    <form onSubmit={handleAdd} className="shrink-0 card space-y-3">
      <h2 className="font-semibold text-gray-700">Nouveau tireur</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div><label className="label" htmlFor="fencer-add-last-name">Nom *</label><input id="fencer-add-last-name" className="input" value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} /></div>
        <div><label className="label" htmlFor="fencer-add-first-name">Prénom *</label><input id="fencer-add-first-name" className="input" value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} /></div>
        <div><label className="label" htmlFor="fencer-add-gender">Genre</label>
          <select id="fencer-add-gender" className="input" value={form.gender} onChange={e => setForm(f => ({...f, gender: e.target.value as 'M'|'F'}))}>
            <option value="M">M</option><option value="F">F</option>
          </select>
        </div>
        {displayConfig.club.visible && <div><label className="label" htmlFor="fencer-add-club">Club *</label><input id="fencer-add-club" className="input" value={form.club} onChange={e => setForm(f => ({...f, club: e.target.value}))} /></div>}
        {displayConfig.licence.visible && <div><label className="label" htmlFor="fencer-add-licence">N° Licence *</label><input id="fencer-add-licence" className="input" value={form.licenceNumber} onChange={e => setForm(f => ({...f, licenceNumber: e.target.value}))} /></div>}
        {displayConfig.dateOfBirth.visible && <div><label className="label" htmlFor="fencer-add-dob">Date de naissance *</label><input id="fencer-add-dob" type="date" className="input" value={form.birthDate} onChange={e => setForm(f => ({...f, birthDate: e.target.value}))} /></div>}
        <div><label className="label" htmlFor="fencer-add-rank">Classement initial</label><input id="fencer-add-rank" type="number" className="input" value={form.initialRank} onChange={e => setForm(f => ({...f, initialRank: e.target.value}))} placeholder="1" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>Annuler</button>
        <button type="submit" className="btn-primary">Ajouter</button>
      </div>
    </form>
  )
}

type FencerRowProps = Readonly<{ f: Fencer; idx: number; contest: import('../types').Contest; displayConfig: typeof DEFAULT_DISPLAY_CONFIG; tournamentId: string; contestId: string; onEdit: (f: Fencer) => void; onDelete: (id: string) => void; setPresence: (tid: string, cid: string, fid: string, v: boolean) => void }>
function FencerRow({ f, idx, contest, displayConfig, tournamentId, contestId, onEdit, onDelete, setPresence }: FencerRowProps) {
  const team = contest.isTeamEvent ? contest.teams.find(t => t.fencerIds.includes(f.id)) : undefined
  return (
    <tr className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50'} ${!f.present ? 'opacity-50' : ''}`}>
      <td className="px-4 py-2"><input type="checkbox" checked={f.present} onChange={e => setPresence(tournamentId, contestId, f.id, e.target.checked)} className="w-4 h-4 accent-blue-600" /></td>
      <td className="px-4 py-2 font-medium text-gray-800">{f.lastName.toUpperCase()}</td>
      <td className="px-4 py-2 text-gray-700">{f.firstName}</td>
      {contest.isTeamEvent && <td className="px-4 py-2 text-gray-500 hidden sm:table-cell text-xs">{team?.name ?? '—'}</td>}
      {displayConfig.club.visible && <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{f.club ?? '—'}</td>}
      {displayConfig.licence.visible && <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{f.licenceNumber ?? '—'}</td>}
      {displayConfig.dateOfBirth.visible && <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{f.birthDate ? new Date(f.birthDate).toLocaleDateString('fr-FR') : '—'}</td>}
      {displayConfig.initialRank.visible && <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{f.initialRank ?? '—'}</td>}
      <td className="px-4 py-2 flex gap-2 justify-end">
        <button className="text-gray-400 hover:text-blue-600 transition-colors text-xs" onClick={() => onEdit(f)}>✎</button>
        <button className="text-gray-300 hover:text-red-500 transition-colors" onClick={() => { if (confirm(`Supprimer ${f.lastName} ?`)) onDelete(f.id) }}>✕</button>
      </td>
    </tr>
  )
}

type FencerEditRowProps = Readonly<{ f: Fencer; displayConfig: typeof DEFAULT_DISPLAY_CONFIG; form: typeof EMPTY_FENCER_FORM; setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FENCER_FORM>>; onCancel: () => void; onSave: (e: React.SubmitEvent<HTMLFormElement>, f: Fencer) => void }>
function FencerEditRow({ f, displayConfig, form, setForm, onCancel, onSave }: FencerEditRowProps) {
  return (
    <tr className="border-b border-blue-200 bg-blue-50">
      <td colSpan={99} className="px-4 py-3">
        <form onSubmit={e => onSave(e, f)} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label className="label" htmlFor="fencer-edit-last-name">Nom *</label><input id="fencer-edit-last-name" className="input" value={form.lastName} onChange={e => setForm(v => ({...v, lastName: e.target.value}))} /></div>
            <div><label className="label" htmlFor="fencer-edit-first-name">Prénom *</label><input id="fencer-edit-first-name" className="input" value={form.firstName} onChange={e => setForm(v => ({...v, firstName: e.target.value}))} /></div>
            <div><label className="label" htmlFor="fencer-edit-gender">Genre</label>
              <select id="fencer-edit-gender" className="input" value={form.gender} onChange={e => setForm(v => ({...v, gender: e.target.value as 'M'|'F'}))}>
                <option value="M">M</option><option value="F">F</option>
              </select>
            </div>
            <div><label className="label" htmlFor="fencer-edit-club">Club {displayConfig.club.visible && '*'}</label><input id="fencer-edit-club" className="input" value={form.club} onChange={e => setForm(v => ({...v, club: e.target.value}))} /></div>
            <div><label className="label" htmlFor="fencer-edit-licence">N° Licence {displayConfig.licence.visible && '*'}</label><input id="fencer-edit-licence" className="input" value={form.licenceNumber} onChange={e => setForm(v => ({...v, licenceNumber: e.target.value}))} /></div>
            <div><label className="label" htmlFor="fencer-edit-dob">Date de naissance {displayConfig.dateOfBirth.visible && '*'}</label><input id="fencer-edit-dob" type="date" className="input" value={form.birthDate} onChange={e => setForm(v => ({...v, birthDate: e.target.value}))} /></div>
            <div><label className="label" htmlFor="fencer-edit-rank">Classement initial</label><input id="fencer-edit-rank" type="number" className="input" value={form.initialRank} onChange={e => setForm(v => ({...v, initialRank: e.target.value}))} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary text-sm" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn-primary text-sm">Enregistrer</button>
          </div>
        </form>
      </td>
    </tr>
  )
}

function emptyFencerListMessage(total: number, isTeamEvent: boolean) {
  if (total !== 0) return 'Aucun résultat pour cette recherche'
  if (isTeamEvent) return 'Aucun membre inscrit'
  return 'Aucun tireur inscrit'
}

function FencerList({ filter }: Readonly<{ filter: string }>) {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, updateFencer, removeFencer, setPresence } = useStore()
  const contest = tournaments.find(t => t.id === tournamentId)?.contests.find(c => c.id === contestId)
  const [fencerSort, setFencerSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'lastName', dir: 'asc' })
  const [editingFencerId, setEditingFencerId] = useState<string | null>(null)
  const [editFencerForm, setEditFencerForm] = useState(EMPTY_FENCER_FORM)
  if (!contest) return null
  const displayConfig = contest.displayConfig ?? DEFAULT_DISPLAY_CONFIG
  const filtered = contest.fencers.filter(f =>
    `${f.lastName} ${f.firstName} ${f.club ?? ''} ${f.licenceNumber ?? ''}`.toLowerCase().includes(filter.toLowerCase())
  )
  const toggleFencerSort = (key: string) =>
    setFencerSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  const fencerSortKey: Record<string, (f: Fencer) => unknown> = {
    present: f => f.present ? 0 : 1, lastName: f => f.lastName.toUpperCase(), firstName: f => f.firstName,
    club: f => f.club ?? '', birthDate: f => f.birthDate ?? '', licenceNumber: f => f.licenceNumber ?? '',
    initialRank: f => f.initialRank, team: f => contest.teams.find(t => t.fencerIds.includes(f.id))?.name ?? '',
  }
  const sortedFencers = [...filtered].sort((a, b) => cmp(fencerSortKey[fencerSort.key]?.(a), fencerSortKey[fencerSort.key]?.(b), fencerSort.dir))

  function startEditFencer(f: Fencer) {
    setEditingFencerId(f.id)
    setEditFencerForm({ lastName: f.lastName, firstName: f.firstName, gender: f.gender, club: f.club ?? '', birthDate: f.birthDate ?? '', licenceNumber: f.licenceNumber ?? '', initialRank: f.initialRank?.toString() ?? '' })
  }
  async function handleSaveFencer(e: React.SubmitEvent<HTMLFormElement>, fencer: Fencer) {
    e.preventDefault()
    const err = validateFencer(editFencerForm, displayConfig)
    if (err) return alert(err)
    await updateFencer(tournamentId, contestId, {
      ...fencer, lastName: editFencerForm.lastName.trim(), firstName: editFencerForm.firstName.trim(), gender: editFencerForm.gender,
      club: editFencerForm.club.trim() || undefined, birthDate: editFencerForm.birthDate || undefined,
      licenceNumber: editFencerForm.licenceNumber.trim() || undefined,
      initialRank: editFencerForm.initialRank ? parseInt(editFencerForm.initialRank) : undefined,
    })
    setEditingFencerId(null)
  }

  return (
    <div className="flex-1 min-h-0 card p-0 overflow-hidden flex flex-col">
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-10 m-auto">
          {emptyFencerListMessage(contest.fencers.length, contest.isTeamEvent)}
        </p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('present')}>Présent{sortArrow('present', fencerSort)}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('lastName')}>Nom{sortArrow('lastName', fencerSort)}</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('firstName')}>Prénom{sortArrow('firstName', fencerSort)}</th>
                {contest.isTeamEvent && <th className="px-4 py-2 text-left font-medium text-gray-600 hidden sm:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('team')}>Équipe{sortArrow('team', fencerSort)}</th>}
                {displayConfig.club.visible && <th className="px-4 py-2 text-left font-medium text-gray-600 hidden sm:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('club')}>Club{sortArrow('club', fencerSort)}</th>}
                {displayConfig.licence.visible && <th className="px-4 py-2 text-left font-medium text-gray-600 hidden md:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('licenceNumber')}>Licence{sortArrow('licenceNumber', fencerSort)}</th>}
                {displayConfig.dateOfBirth.visible && <th className="px-4 py-2 text-left font-medium text-gray-600 hidden md:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('birthDate')}>Né{sortArrow('birthDate', fencerSort)}</th>}
                {displayConfig.initialRank.visible && <th className="px-4 py-2 text-left font-medium text-gray-600 hidden md:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => toggleFencerSort('initialRank')}>Rang{sortArrow('initialRank', fencerSort)}</th>}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedFencers.map((f, idx) => {
                if (editingFencerId === f.id) {
                  return <FencerEditRow key={f.id} f={f} displayConfig={displayConfig} form={editFencerForm} setForm={setEditFencerForm} onCancel={() => setEditingFencerId(null)} onSave={handleSaveFencer} />
                }
                return <FencerRow key={f.id} f={f} idx={idx} contest={contest} displayConfig={displayConfig} tournamentId={tournamentId} contestId={contestId} onEdit={startEditFencer} onDelete={id => removeFencer(tournamentId, contestId, id)} setPresence={setPresence} />
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CheckinPage() {
  const { tournamentId = '', contestId = '' } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, loaded } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const [filter, setFilter] = useState('')

  if (!loaded) return <div className="p-4 text-gray-500">Chargement…</div>
  if (!tournament || !contest) return <div className="text-red-500">Compétition introuvable</div>

  return (
    <div className="flex flex-col h-full gap-5">
      <PrintSection />
      <div className="checkin-screen-only flex flex-col gap-5 h-full">
        <div className="shrink-0 flex items-center gap-2 text-sm text-gray-500">
          <BackArrow />
          <Link to="/" className="hover:text-blue-600">Tournois</Link>
          <span>/</span>
          <Link to={`/tournament/${tournamentId}`} className="hover:text-blue-600">{tournament.name}</Link>
          <span>/</span>
          <ContestBreadcrumb tournament={tournament} contest={contest} tournamentId={tournamentId} />
          <span>/</span>
          <span className="text-gray-800 font-medium">Checkin</span>
        </div>
        <PresenceHeader />
        <PresenceStatusBanner />
        {contest.isTeamEvent && <TeamsSection filter={filter} />}
        <FencerToolbar filter={filter} setFilter={setFilter} />
        <AddFencerForm />
        <FencerList filter={filter} />
      </div>
    </div>
  )
}

function toggleTeamMember(fencerId: string, current: string[], setter: (ids: string[]) => void) {
  setter(current.includes(fencerId) ? current.filter(id => id !== fencerId) : [...current, fencerId])
}

function TeamMemberPicker({ fencerIds, onChange, contest, editingTeamId }: Readonly<{ fencerIds: string[]; onChange: (ids: string[]) => void; contest: import('../types').Contest; editingTeamId: string | null }>) {
  const visible = contest.fencers.filter(f =>
    fencerIds.includes(f.id) ||
    !contest.teams.some(t => t.fencerIds.includes(f.id) && t.id !== editingTeamId)
  )
  if (visible.length === 0) {
    return <p className="text-xs text-gray-400 col-span-full">Aucun tireur disponible — ajoutez d'abord des tireurs.</p>
  }
  return (
    <div className="col-span-full">
      <p className="label">Membres</p>
      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
        {visible.map(f => (
          <label key={f.id} className="flex items-center gap-1 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
            <input
              type="checkbox"
              checked={fencerIds.includes(f.id)}
              onChange={() => toggleTeamMember(f.id, fencerIds, onChange)}
              className="accent-blue-600"
            />
            <span>{f.lastName.toUpperCase()} {f.firstName}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
