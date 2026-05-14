import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useStore } from '../store'
import { importFFF, importBellePouleXML, readFileText } from '../logic/importExport'
import type { Fencer } from '../types'

const DEV_LAST_NAMES = ['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','Andre','Lefevre','Mercier','Dupont','Lambert','Bonnet','François','Martinez']
const DEV_FIRST_NAMES = ['Hugo','Lucas','Léo','Louis','Gabriel','Noah','Raphaël','Arthur','Ethan','Alexandre','Léa','Emma','Chloé','Manon','Inès','Alice','Camille','Julie','Lucie','Anaïs']
const DEV_CLUBS = ['CSM Clamart','Châlons','Rodez','Paris UC','Grenoble Escrime','Bordeaux EC','Toulouse Escrime','Lyon AE','Nantes EC','Rennes EA']

export default function CheckinPage() {
  const { tournamentId, contestId } = useParams<{ tournamentId: string; contestId: string }>()
  const { tournaments, addFencer, removeFencer, setPresence, setTeamPresence, addTeam, setAllPresence } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const [filter, setFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ lastName: '', firstName: '', gender: 'M' as 'M' | 'F', club: '', birthYear: '', initialRank: '' })
  const [devCount, setDevCount] = useState('12')

  if (!tournament || !contest) return <div className="text-red-500">Compétition introuvable</div>

  const filtered = contest.fencers.filter(f =>
    `${f.lastName} ${f.firstName} ${f.club ?? ''}`.toLowerCase().includes(filter.toLowerCase())
  )
  const presentCount = contest.fencers.filter(f => f.present).length

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.lastName.trim()) return
    await addFencer(tournamentId!, contestId!, {
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      gender: form.gender,
      club: form.club.trim() || undefined,
      birthYear: form.birthYear ? parseInt(form.birthYear) : undefined,
      initialRank: form.initialRank ? parseInt(form.initialRank) : undefined,
      present: true,
    })
    setForm({ lastName: '', firstName: '', gender: 'M', club: '', birthYear: '', initialRank: '' })
    setAdding(false)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await readFileText(file)
    let fencers: Fencer[] = []
    let importedTeams: import('../types').Team[] = []
    try {
      if (file.name.endsWith('.fff') || file.name.endsWith('.FFF')) {
        fencers = importFFF(text) as unknown as Fencer[]
      } else if (
        file.name.endsWith('.xml') || file.name.endsWith('.XML') ||
        file.name.endsWith('.cotcot')
      ) {
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
    for (const f of fencers) {
      await addFencer(tournamentId!, contestId!, f)
    }
    // For team events: add teams from XML (preserving fencerIds that reference the just-added fencers)
    for (const team of importedTeams) {
      await addTeam(tournamentId!, contestId!, { name: team.name, club: team.club, fencerIds: team.fencerIds, present: team.present, initialRank: team.initialRank })
    }
    e.target.value = ''
  }

  function handleSetAll(present: boolean) {
    setAllPresence(tournamentId!, contestId!, present)
  }

  async function handleInjectFakers() {
    const n = parseInt(devCount) || 12
    const existing = contest!.fencers.length
    for (let i = 0; i < n; i++) {
      const rank = existing + i + 1
      const fencer: Omit<Fencer, 'id'> = {
        lastName: DEV_LAST_NAMES[(rank * 7) % DEV_LAST_NAMES.length],
        firstName: DEV_FIRST_NAMES[(rank * 3) % DEV_FIRST_NAMES.length],
        gender: rank % 3 === 0 ? 'F' : 'M',
        club: DEV_CLUBS[rank % DEV_CLUBS.length],
        birthYear: 1990 + (rank % 35),
        initialRank: rank,
        present: true,
      }
      await addFencer(tournamentId!, contestId!, fencer)
    }
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}`} className="hover:text-blue-600">{tournament.name}</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}/contest/${contestId}`} className="hover:text-blue-600">{contest.name}</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Checkin</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Checkin</h1>
        {contest.isTeamEvent
          ? <span className="text-lg font-semibold text-blue-700">{contest.teams.filter(t => t.present !== false).length} / {contest.teams.length} équipes présentes</span>
          : <span className="text-lg font-semibold text-blue-700">{presentCount} / {contest.fencers.length} présents</span>
        }
      </div>

      {/* Teams section — team events only */}
      {contest.isTeamEvent && contest.teams.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <h2 className="font-semibold text-blue-800">Équipes</h2>
            <div className="flex gap-2">
              <button className="text-xs btn-secondary py-1 px-2"
                onClick={() => setAllPresence(tournamentId!, contestId!, true)}>
                Toutes présentes
              </button>
              <button className="text-xs btn-secondary py-1 px-2"
                onClick={() => setAllPresence(tournamentId!, contestId!, false)}>
                Toutes absentes
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Présente</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Équipe</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 hidden sm:table-cell">Club</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Membres présents</th>
                {contest.teams.some(t => t.initialRank !== undefined) && (
                  <th className="px-4 py-2 text-left font-medium text-gray-600 hidden md:table-cell">Rang</th>
                )}
              </tr>
            </thead>
            <tbody>
              {contest.teams.map((team, idx) => {
                const memberFencers = team.fencerIds.map(id => contest.fencers.find(f => f.id === id)).filter(Boolean) as import('../types').Fencer[]
                const presentMembers = memberFencers.filter(f => f.present).length
                return (
                  <tr key={team.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50'} ${!team.present ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={team.present !== false}
                        onChange={e => setTeamPresence(tournamentId!, contestId!, team.id, e.target.checked)}
                        className="w-4 h-4 accent-blue-600" />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">{team.name}</td>
                    <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{team.club ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">
                      <span className={presentMembers < 3 ? 'text-orange-600 font-medium' : 'text-green-700'}>
                        {presentMembers}
                      </span>
                      <span className="text-gray-400"> / {memberFencers.length}</span>
                    </td>
                    {contest.teams.some(t => t.initialRank !== undefined) && (
                      <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{team.initialRank ?? '—'}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1 min-w-48"
          placeholder={contest.isTeamEvent ? 'Rechercher un membre…' : 'Rechercher un tireur…'}
          value={filter} onChange={e => setFilter(e.target.value)} />
        <button className="btn-secondary text-sm" onClick={() => handleSetAll(true)}>Tous présents</button>
        <button className="btn-secondary text-sm" onClick={() => handleSetAll(false)}>Tous absents</button>
        <label className="btn-secondary cursor-pointer text-sm">
          📂 Importer FFF/XML/cotcot
          <input type="file" accept=".fff,.FFF,.xml,.XML,.cotcot" className="hidden" onChange={handleImportFile} />
        </label>
        <button className="btn-primary text-sm" onClick={() => setAdding(true)}>+ Ajouter tireur</button>
        {import.meta.env.DEV && (
          <div className="flex items-center gap-1 border border-orange-300 rounded-lg px-2 py-1 bg-orange-50" title="Dev only">
            <span className="text-xs text-orange-600 font-medium">DEV</span>
            <input type="number" min={1} max={200} value={devCount}
              onChange={e => setDevCount(e.target.value)}
              className="w-12 text-center border border-orange-300 rounded text-sm px-1 py-0.5 bg-white" />
            <button className="text-xs text-orange-700 font-medium hover:text-orange-900 whitespace-nowrap" onClick={handleInjectFakers}>
              Inject tireurs
            </button>
          </div>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="card space-y-3">
          <h2 className="font-semibold text-gray-700">Nouveau tireur</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Nom *</label>
              <input className="input" value={form.lastName} onChange={e => setForm(f => ({...f, lastName: e.target.value}))} autoFocus />
            </div>
            <div>
              <label className="label">Prénom</label>
              <input className="input" value={form.firstName} onChange={e => setForm(f => ({...f, firstName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Genre</label>
              <select className="input" value={form.gender} onChange={e => setForm(f => ({...f, gender: e.target.value as 'M'|'F'}))}>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
            <div>
              <label className="label">Club</label>
              <input className="input" value={form.club} onChange={e => setForm(f => ({...f, club: e.target.value}))} />
            </div>
            <div>
              <label className="label">Année naissance</label>
              <input type="number" className="input" value={form.birthYear} onChange={e => setForm(f => ({...f, birthYear: e.target.value}))} placeholder="2000" />
            </div>
            <div>
              <label className="label">Classement initial</label>
              <input type="number" className="input" value={form.initialRank} onChange={e => setForm(f => ({...f, initialRank: e.target.value}))} placeholder="1" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>Annuler</button>
            <button type="submit" className="btn-primary">Ajouter</button>
          </div>
        </form>
      )}

      {/* Fencer list */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            {contest.fencers.length === 0
              ? (contest.isTeamEvent ? 'Aucun membre inscrit' : 'Aucun tireur inscrit')
              : 'Aucun résultat pour cette recherche'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Présent</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Nom</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Prénom</th>
                {contest.isTeamEvent && <th className="px-4 py-2 text-left font-medium text-gray-600 hidden sm:table-cell">Équipe</th>}
                <th className="px-4 py-2 text-left font-medium text-gray-600 hidden sm:table-cell">Club</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 hidden md:table-cell">Né</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 hidden md:table-cell">Rang</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, idx) => {
                const team = contest.isTeamEvent ? contest.teams.find(t => t.fencerIds.includes(f.id)) : undefined
                return (
                  <tr key={f.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50'} ${!f.present ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={f.present}
                        onChange={e => setPresence(tournamentId!, contestId!, f.id, e.target.checked)}
                        className="w-4 h-4 accent-blue-600" />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">{f.lastName.toUpperCase()}</td>
                    <td className="px-4 py-2 text-gray-700">{f.firstName}</td>
                    {contest.isTeamEvent && <td className="px-4 py-2 text-gray-500 hidden sm:table-cell text-xs">{team?.name ?? '—'}</td>}
                    <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{f.club ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{f.birthYear ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{f.initialRank ?? '—'}</td>
                    <td className="px-4 py-2">
                      <button className="text-gray-300 hover:text-red-500 transition-colors"
                        onClick={() => { if (confirm(`Supprimer ${f.lastName} ?`)) removeFencer(tournamentId!, contestId!, f.id) }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
