import { nanoid } from 'nanoid'
import type { Contest, Fencer, Tournament } from '../types'

// ─── Export JSON ──────────────────────────────────────────────────────────────

export function exportTournamentJSON(tournament: Tournament): void {
  const json = JSON.stringify(tournament, null, 2)
  downloadFile(`${tournament.name}.bellepoule.json`, 'application/json', json)
}

export function importTournamentJSON(file: File): Promise<Tournament> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const t = JSON.parse(e.target!.result as string) as Tournament
        // Assign fresh id to avoid collision
        const imported: Tournament = { ...t, id: nanoid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        resolve(imported)
      } catch {
        reject(new Error('Fichier JSON invalide'))
      }
    }
    reader.onerror = () => reject(new Error('Erreur lecture fichier'))
    reader.readAsText(file)
  })
}

// ─── Import XML FFF (French Fencing Federation format) ───────────────────────

/**
 * Parse a FFF XML file (Tireurs/Tireur elements) into Fencer[]
 */
export function importFFF(xmlText: string): Fencer[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const tireurs = doc.querySelectorAll('Tireur')
  const fencers: Fencer[] = []
  tireurs.forEach(t => {
    fencers.push({
      id: nanoid(),
      lastName: t.getAttribute('Nom') ?? '',
      firstName: t.getAttribute('Prenom') ?? '',
      birthYear: t.getAttribute('DateNaissance') ? parseInt(t.getAttribute('DateNaissance')!) : undefined,
      gender: (t.getAttribute('Sexe') === 'F' ? 'F' : 'M') as 'M' | 'F',
      club: t.getAttribute('Club') ?? undefined,
      country: t.getAttribute('Nation') ?? undefined,
      licenceNumber: t.getAttribute('Licence') ?? undefined,
      initialRank: t.getAttribute('Classement') ? parseInt(t.getAttribute('Classement')!) : undefined,
      present: true,
    })
  })
  return fencers
}

/**
 * Parse a FIE/BellePoule XML contest file
 */
export function importBellePouleXML(xmlText: string): Partial<Contest> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  const competition = doc.querySelector('Competition')
  if (!competition) throw new Error('Format XML non reconnu')

  const fencers: Fencer[] = []
  doc.querySelectorAll('Tireur').forEach(t => {
    fencers.push({
      id: t.getAttribute('REF') ?? nanoid(),
      lastName: t.getAttribute('Nom') ?? '',
      firstName: t.getAttribute('Prenom') ?? '',
      birthYear: t.getAttribute('DateNaissance') ? parseInt(t.getAttribute('DateNaissance')!) : undefined,
      gender: (t.getAttribute('Sexe') === 'F' ? 'F' : 'M') as 'M' | 'F',
      club: t.getAttribute('Club') ?? undefined,
      country: t.getAttribute('Nation') ?? undefined,
      licenceNumber: t.getAttribute('Licence') ?? undefined,
      initialRank: t.getAttribute('Classement') ? parseInt(t.getAttribute('Classement')!) : undefined,
      present: true,
    })
  })

  return {
    name: competition.getAttribute('Titre') ?? 'Compétition',
    weapon: mapWeapon(competition.getAttribute('Arme') ?? ''),
    gender: mapGender(competition.getAttribute('Sexe') ?? ''),
    organizer: competition.getAttribute('Organisateur') ?? undefined,
    location: competition.getAttribute('Lieu') ?? undefined,
    fencers,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapWeapon(w: string): import('../types').Weapon {
  if (w === 'S') return 'sabre'
  if (w === 'F') return 'foil'
  return 'epee'
}

function mapGender(g: string): import('../types').Gender {
  if (g === 'F' || g === 'D') return 'women'
  if (g === 'X' || g === 'FM') return 'mixed'
  return 'men'
}

function downloadFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
