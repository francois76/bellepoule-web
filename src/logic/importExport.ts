import { nanoid } from 'nanoid'
import type { Contest, Fencer, Tournament } from '../types'

// ─── File reading helper ───────────────────────────────────────────────────────

/**
 * Read a File into text, detecting encoding from the content.
 * - XML files: reads the <?xml encoding="..."> declaration
 * - FFF files: reads the FFF;UTF8 / FFF;WIN header line
 * Falls back to UTF-8 for unknown cases.
 */
export async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Peek at the first 200 bytes as Latin-1 to find encoding hints
  const peek = new TextDecoder('latin1').decode(bytes.slice(0, 200))

  let encoding = 'utf-8'

  // XML encoding declaration: <?xml ... encoding="ISO-8859-1" ?>
  const xmlEnc = peek.match(/encoding=["']([^"']+)["']/i)
  if (xmlEnc) {
    encoding = xmlEnc[1].toLowerCase()
  }

  // FFF first line: FFF;WIN;... (Windows-1252) or FFF;UTF8;...
  const fffHeader = peek.split(/[\r\n]/)[0]
  if (fffHeader.startsWith('FFF;')) {
    const codec = fffHeader.split(';')[1]?.toUpperCase()
    if (codec === 'WIN') encoding = 'windows-1252'
    else if (codec === 'UTF8') encoding = 'utf-8'
  }

  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

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
 * Line format: NOM,Prenom,DD/MM/YYYY,sex,nation;ligue_or_empty;licence,ligue,club,rank,points;
 * Gender: 'H' or 'M' = male, 'F' or 'D' = female
 * Note: some files wrap long lines — join continuation lines first.
 */
export function importFFF(text: string): Fencer[] {
  // Rejoin lines that are continuations (don't start with a letter after a name field)
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Merge wrapped lines: a continuation line has no ';' in the personal fields area
  // Strategy: join any line that doesn't look like a standalone record or header
  const lines: string[] = []
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line) continue
    if (
      line.startsWith('FFF') ||
      /^\d{2}\/\d{2}\/\d{4}/.test(line) ||
      /^[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ\- ]+,/.test(line) // starts with uppercase name
    ) {
      lines.push(line)
    } else if (lines.length > 0) {
      // continuation of previous line
      lines[lines.length - 1] += line
    }
  }

  const fencers: Fencer[] = []
  for (const line of lines) {
    if (!line || line.startsWith('FFF') || /^\d{2}\/\d{2}\/\d{4}/.test(line)) continue
    const parts = line.split(';')
    const personal = parts[0]?.split(',')
    if (!personal || personal.length < 4) continue
    const [lastName, firstName, birthDate, gender, country] = personal
    const clubFields = parts[2]?.split(',') ?? []
    const [licenceNumber, , club, rankStr] = clubFields
    const byStr = birthDate?.trim().split('/')?.[2]
    fencers.push({
      id: nanoid(),
      lastName: lastName?.trim() ?? '',
      firstName: firstName?.trim() ?? '',
      birthYear: byStr && byStr.length === 4 ? parseInt(byStr) || undefined : undefined,
      gender: (gender?.trim() === 'F' || gender?.trim() === 'D') ? 'F' : 'M',
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

// ─── Import phase structure from cotcot ──────────────────────────────────────

export interface ImportedPhaseConfig {
  type: 'pool' | 'tableau'
  maxScore: number
  promotionPercent?: number // pool only
}

/**
 * Parse the <Phases> section of a cotcot XML to extract pool/tableau config.
 * Returns an ordered list of phase definitions (pools then tableau).
 */
export function importCotcotPhases(xmlText: string): ImportedPhaseConfig[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const phases: ImportedPhaseConfig[] = []
  doc.querySelectorAll('TourDePoules').forEach(el => {
    phases.push({
      type: 'pool',
      maxScore: parseInt(el.getAttribute('ScoreMax') ?? '5') || 5,
      promotionPercent: 75,
    })
  })
  doc.querySelectorAll('PhaseDeTableaux').forEach(el => {
    phases.push({
      type: 'tableau',
      maxScore: parseInt(el.getAttribute('ScoreMax') ?? '15') || 15,
    })
  })
  return phases
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
