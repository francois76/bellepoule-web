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

// ─── Import FFF (Engarde CSV format) ─────────────────────────────────────────

/**
 * Parse a FFF file (Engarde semicolon/CSV format) into Fencer[]
 * Line format: NOM,Prenom,DD/MM/YYYY,sex,nation;team;licence,,club,rank,points;
 */
export function importFFF(text: string): Fencer[] {
  const fencers: Fencer[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('FFF') || /^\d{2}\/\d{2}\/\d{4}/.test(line)) continue
    const parts = line.split(';')
    const personal = parts[0]?.split(',')
    if (!personal || personal.length < 4) continue
    const [lastName, firstName, birthDate, gender, country] = personal
    const clubFields = parts[2]?.split(',') ?? []
    const [licenceNumber, , club, rankStr] = clubFields
    const byStr = birthDate?.split('/')?.[2]
    fencers.push({
      id: nanoid(),
      lastName: lastName?.trim() ?? '',
      firstName: firstName?.trim() ?? '',
      birthYear: byStr ? parseInt(byStr) || undefined : undefined,
      gender: gender?.trim() === 'F' ? 'F' : 'M',
      club: club?.trim() || undefined,
      country: country?.trim() || undefined,
      licenceNumber: licenceNumber?.trim() || undefined,
      initialRank: rankStr ? parseInt(rankStr) || undefined : undefined,
      present: true,
    })
  }
  return fencers
}

/**
 * Parse a FIE/BellePoule/cotcot XML contest file.
 * Supports root elements: CompetitionIndividuelle (cotcot), BaseCompetitionIndividuelle,
 * BaseCompetitionParEquipes (FIE XML), and Competition (internal format).
 */
export function importBellePouleXML(xmlText: string): Partial<Contest> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  const competition =
    doc.querySelector('CompetitionIndividuelle') ??
    doc.querySelector('BaseCompetitionIndividuelle') ??
    doc.querySelector('BaseCompetitionParEquipes') ??
    doc.querySelector('Competition')

  if (!competition) throw new Error('Format XML non reconnu')

  const isCotcot = competition.tagName === 'CompetitionIndividuelle'

  const fencers: Fencer[] = []
  doc.querySelectorAll('Tireur').forEach(t => {
    // cotcot uses Ranking; FIE XML and internal format use Classement
    const rankAttr = isCotcot ? t.getAttribute('Ranking') : t.getAttribute('Classement')
    // Statut: 'F' = forfait (absent), 'Q' = qualifié/présent
    const statut = t.getAttribute('Statut')
    // DateNaissance may be DD.MM.YYYY (XML) — parseInt alone would give day, not year
    const dob = t.getAttribute('DateNaissance') ?? ''
    const dobParts = dob.includes('.') ? dob.split('.') : dob.includes('/') ? dob.split('/') : []
    const birthYear = dobParts.length === 3 ? parseInt(dobParts[2]) || undefined : undefined
    fencers.push({
      id: t.getAttribute('REF') ?? t.getAttribute('ID') ?? nanoid(),
      lastName: t.getAttribute('Nom') ?? '',
      firstName: t.getAttribute('Prenom') ?? '',
      birthYear,
      gender: (t.getAttribute('Sexe') === 'F' ? 'F' : 'M') as 'M' | 'F',
      club: t.getAttribute('Club') ?? undefined,
      country: t.getAttribute('Nation') ?? undefined,
      licenceNumber: t.getAttribute('Licence') ?? undefined,
      initialRank: rankAttr ? parseInt(rankAttr) || undefined : undefined,
      present: statut !== 'F', // 'F' = forfait = absent
    })
  })

  const name =
    competition.getAttribute('TitreLong') ??
    competition.getAttribute('Titre') ??
    'Compétition'

  return {
    name,
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
