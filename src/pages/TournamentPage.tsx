import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import { BackArrow } from '../components/BackArrow'
import { importBellePouleXML, importFFF, importCotcotPhases, readFileText } from '../logic/importExport'
import type { Contest } from '../types'
import { FENCING_CATEGORIES, DEFAULT_DISPLAY_CONFIG } from '../types'

const WEAPONS = [
  { value: 'epee', label: 'Épée' },
  { value: 'foil', label: 'Fleuret' },
  { value: 'sabre', label: 'Sabre' },
]
const GENDERS = [
  { value: 'men', label: 'Messieurs' },
  { value: 'women', label: 'Dames' },
  { value: 'mixed', label: 'Mixte' },
]

const weaponEmoji: Record<string, string> = { epee: '⚔️', foil: '🤺', sabre: '🗡️' }

const DISPLAY_FIELD_LABELS: Record<string, string> = {
  dateOfBirth:  'Date de naissance',
  gender:       'Genre',
  club:         'Club',
  country:      'Pays',
  licence:      'N° licence',
  initialRank:  'Classement initial',
  league:       'Ligue',
  region:       'Région',
}

export default function TournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const { tournaments, addContest, removeContest, addFencer, addReferee, addTeam, addPoolPhase } = useStore()
  const navigate = useNavigate()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    weapon: 'epee' as Contest['weapon'],
    gender: 'men' as Contest['gender'],
    category: 'Senior',
    organizer: '',
    location: '',
    date: '',
    isTeamEvent: false,
    minTeamSize: '3',
    displayConfig: DEFAULT_DISPLAY_CONFIG,
  })

  if (!tournament) return <div className="text-red-500">Tournoi introuvable</div>

  async function handleImportContest(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await readFileText(file)
      let partial
      if (file.name.endsWith('.fff') || file.name.endsWith('.FFF')) {
        const fencers = importFFF(text)
        partial = { name: file.name.replace(/\.fff$/i, ''), fencers, weapon: 'epee' as const, gender: 'men' as const }
      } else {
        partial = importBellePouleXML(text)
      }
      const contest = await addContest(tournamentId!, {
        name: partial.name ?? 'Compétition importée',
        weapon: partial.weapon ?? 'epee',
        gender: partial.gender ?? 'men',
        organizer: partial.organizer ?? tournament?.organizer,
        location: partial.location ?? undefined,
        isTeamEvent: partial.isTeamEvent ?? false,
        autoScoreStuffing: true,
        displayConfig: DEFAULT_DISPLAY_CONFIG,
      })
      for (const f of partial.fencers ?? []) {
        await addFencer(tournamentId!, contest.id, f)
      }
      // Import teams (team events)
      for (const team of (partial.teams ?? [])) {
        await addTeam(tournamentId!, contest.id, team)
      }
      // Import referees (cotcot)
      for (const ref of (partial.referees ?? [])) {
        await addReferee(tournamentId!, contest.id, ref)
      }
      // For cotcot files, also create the declared phases
      if (file.name.endsWith('.cotcot')) {
        const phaseConfigs = importCotcotPhases(text)
        let poolCount = 0
        for (const cfg of phaseConfigs) {
          if (cfg.type === 'pool') {
            poolCount++
            await addPoolPhase(tournamentId!, contest.id, `Tour de poules ${poolCount}`, cfg.maxScore, cfg.promotionPercent ?? 75)
          }
          // Tableau phases are not added here — size depends on pool results, will be auto-suggested later
        }
      }
      navigate(`/tournament/${tournamentId}/contest/${contest.id}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur import fichier')
    }
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const contest = await addContest(tournamentId!, {
      ...form,
      name: form.name.trim(),
      category: form.category.trim() || undefined,
      organizer: form.organizer.trim() || tournament?.organizer,
      location: form.location.trim() || undefined,
      date: form.date || undefined,
      minTeamSize: form.isTeamEvent ? (parseInt(form.minTeamSize) || 3) : undefined,
      autoScoreStuffing: true,
      displayConfig: form.displayConfig,
    })
    setCreating(false)
    navigate(`/tournament/${tournamentId}/contest/${contest.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <BackArrow />
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{tournament.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{tournament.name}</h1>
          {tournament.organizer && <p className="text-gray-500">{tournament.organizer}</p>}
        </div>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer">
            📂 Importer compétition
            <input type="file" accept=".cotcot,.xml,.XML,.fff,.FFF" className="hidden" onChange={handleImportContest} />
          </label>
          <button className="btn-primary" onClick={() => setCreating(true)}>+ Nouvelle compétition</button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-gray-700">Nouvelle compétition</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Nom *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Épée Messieurs Senior" autoFocus />
            </div>
            <div>
              <label className="label">Arme</label>
              <select className="input" value={form.weapon} onChange={e => set('weapon', e.target.value as Contest['weapon'])}>
                {WEAPONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Genre</label>
              <select className="input" value={form.gender} onChange={e => set('gender', e.target.value as Contest['gender'])}>
                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {FENCING_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
                <option value="">Autre / libre</option>
              </select>
              {form.category === '' && (
                <input className="input mt-1" placeholder="Catégorie personnalisée…"
                  onChange={e => set('category', e.target.value)} />
              )}
            </div>
            <div>
              <label className="label">Organisateur</label>
              <input className="input" value={form.organizer} onChange={e => set('organizer', e.target.value)} placeholder={tournament.organizer ?? ''} />
            </div>
            <div>
              <label className="label">Lieu</label>
              <input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Salle des fêtes…" />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="team" checked={form.isTeamEvent} onChange={e => set('isTeamEvent', e.target.checked)} className="w-4 h-4" />
              <label htmlFor="team" className="text-sm text-gray-700">Compétition par équipes</label>
            </div>
            {form.isTeamEvent && (
              <div>
                <label className="label">Taille minimale d'équipe</label>
                <input type="number" className="input" min="1" max="10" value={form.minTeamSize}
                  onChange={e => set('minTeamSize', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">
                  Une équipe avec moins de {form.minTeamSize || '?'} membres présents ne peut pas être déclarée présente.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-4">
            <h3 className="font-semibold text-gray-700 text-sm">Champs activés (obligatoires)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(form.displayConfig) as (keyof typeof form.displayConfig)[]).map(field => (
                <label key={field} className="flex items-center gap-2 group cursor-pointer text-sm">
                  <input type="checkbox"
                    checked={form.displayConfig[field].visible}
                    onChange={e => set('displayConfig', {
                      ...form.displayConfig,
                      [field]: { ...form.displayConfig[field], visible: e.target.checked, onCheckin: e.target.checked, onPool: e.target.checked }
                    })}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className={`text-gray-700 transition-colors ${form.displayConfig[field].visible ? 'font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>
                    {DISPLAY_FIELD_LABELS[field]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Annuler</button>
            <button type="submit" className="btn-primary">Créer</button>
          </div>
        </form>
      )}

      {tournament.contests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🏆</p>
          <p>Aucune compétition — créez-en une pour commencer</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournament.contests.map(c => (
            <div key={c.id} className="card hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/tournament/${tournamentId}/contest/${c.id}`)}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{weaponEmoji[c.weapon] ?? '⚔️'}</span>
                    <span className="font-semibold text-gray-800 group-hover:text-blue-700">{c.name}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {WEAPONS.find(w => w.value === c.weapon)?.label} · {GENDERS.find(g => g.value === c.gender)?.label}
                    {c.category && ` · ${c.category}`}
                    {c.isTeamEvent && ' · Par équipes'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.isTeamEvent
                      ? `${c.teams.length} équipe${c.teams.length !== 1 ? 's' : ''}`
                      : `${c.fencers.filter(f => f.present).length}/${c.fencers.length} tireurs présents`}
                  </p>
                </div>
                <button className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  onClick={e => { e.stopPropagation(); if (confirm('Supprimer cette compétition ?')) removeContest(tournamentId!, c.id) }}
                  title="Supprimer">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
