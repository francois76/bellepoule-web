import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { importTournamentJSON } from '../logic/importExport'

export default function HomePage() {
  const { tournaments, loaded, createTournament, removeTournament, updateTournament } = useStore()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [organizer, setOrganizer] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const t = await createTournament(name.trim(), organizer.trim() || undefined)
    setCreating(false)
    setName('')
    setOrganizer('')
    navigate(`/tournament/${t.id}`)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const t = await importTournamentJSON(file)
      await updateTournament(t)
      navigate(`/tournament/${t.id}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur import')
    }
    e.target.value = ''
  }

  if (!loaded) return <p className="text-gray-500">Chargement…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tournois</h1>
        <div className="flex gap-2">
          <label className="btn-secondary cursor-pointer">
            Importer
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + Nouveau tournoi
          </button>
        </div>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="card space-y-3">
          <h2 className="font-semibold text-gray-700">Nouveau tournoi</h2>
          <div>
            <label className="label" htmlFor="new-tournament-name">Nom *</label>
            <input id="new-tournament-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Coupe de France 2026" />
          </div>
          <div>
            <label className="label" htmlFor="new-tournament-organizer">Organisateur</label>
            <input id="new-tournament-organizer" className="input" value={organizer} onChange={e => setOrganizer(e.target.value)} placeholder="Club d'escrime de Paris" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Annuler</button>
            <button type="submit" className="btn-primary">Créer</button>
          </div>
        </form>
      )}

      {tournaments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">🤺</p>
          <p className="text-lg">Aucun tournoi pour l'instant</p>
          <p className="text-sm mt-1">Créez votre premier tournoi pour commencer</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map(t => (
            <div key={t.id} className="card hover:shadow-md transition-shadow cursor-pointer group"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/tournament/${t.id}`)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/tournament/${t.id}`) }}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 group-hover:text-blue-700">{t.name}</h3>
                  {t.organizer && <p className="text-sm text-gray-500">{t.organizer}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {t.contests.length} compétition{t.contests.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  onClick={e => { e.stopPropagation(); if (confirm('Supprimer ce tournoi ?')) removeTournament(t.id) }}
                  title="Supprimer"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
