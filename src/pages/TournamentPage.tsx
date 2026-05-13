import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '../store'
import type { Contest } from '../types'

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
const LEVELS = [
  { value: 'league', label: 'Ligue' },
  { value: 'regional', label: 'Régional' },
  { value: 'open', label: 'Open' },
  { value: 'world_cup', label: 'Coupe du monde' },
  { value: 'national', label: 'Championnat national' },
  { value: 'world', label: 'Championnat du monde' },
  { value: 'other', label: 'Autre' },
]

const weaponEmoji: Record<string, string> = { epee: '⚔️', foil: '🤺', sabre: '🗡️' }

export default function TournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const { tournaments, addContest, removeContest } = useStore()
  const navigate = useNavigate()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    weapon: 'epee' as Contest['weapon'],
    gender: 'men' as Contest['gender'],
    level: 'open' as Contest['level'],
    category: '',
    organizer: '',
    location: '',
    date: '',
    isTeamEvent: false,
  })

  if (!tournament) return <div className="text-red-500">Tournoi introuvable</div>

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
    })
    setCreating(false)
    navigate(`/tournament/${tournamentId}/contest/${contest.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">{tournament.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{tournament.name}</h1>
          {tournament.organizer && <p className="text-gray-500">{tournament.organizer}</p>}
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nouvelle compétition</button>
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
              <label className="label">Niveau</label>
              <select className="input" value={form.level} onChange={e => set('level', e.target.value as Contest['level'])}>
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Catégorie</label>
              <input className="input" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Senior, Cadet, Vétéran…" />
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
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.fencers.filter(f => f.present).length}/{c.fencers.length} tireurs présents
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
