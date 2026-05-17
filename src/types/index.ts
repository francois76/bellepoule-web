// ─── Enums ────────────────────────────────────────────────────────────────────

export type Weapon = 'epee' | 'foil' | 'sabre'
export type Gender = 'men' | 'women' | 'mixed'
export type StageType = 'checkin' | 'pool' | 'tableau' | 'classification' | 'barrage'
export type StageStatus = 'pending' | 'running' | 'done'
export type MatchResult = 'V' | 'D' | 'A' // Victory, Defeat, Absent

/**
 * Statut d'un tireur au sein d'une phase de poules.
 * - ok         : participation normale (coche verte ✓)
 * - withdrawal : le tireur s'est retiré / forfait en cours de compétition (🚑)
 *                Tous ses assauts non joués → adversaire V + score max, tireur D + 0
 * - excluded   : le tireur a reçu un carton noir / exclusion (⛔)
 *                Même traitement que withdrawal
 */
export type FencerPoolStatus = 'ok' | 'withdrawal' | 'excluded'

/**
 * Options de "places tirées" au tableau :
 * - none        : aucune petite finale (seul 1er et 2e sont déterminés)
 * - third_place : match pour la 3e place (les 2 demi-finalistes perdants s'affrontent)
 * - all_places  : toutes les places sont tirées (les perdants de chaque tour s'affrontent
 *                 pour déterminer les 5e-8e, 9e-16e, etc.)
 */
export type FencedPlaces = 'none' | 'third_place' | 'all_places'

/**
 * Catégories officielles FFF / FIE.
 * Utilisées pour suggérer automatiquement le score max (M13 et moins → 4 touches, etc.)
 */
export const FENCING_CATEGORIES = [
  { value: 'M9',      label: 'M9 (moins de 9 ans)' },
  { value: 'M11',     label: 'M11 (moins de 11 ans)' },
  { value: 'M13',     label: 'M13 (moins de 13 ans)' },
  { value: 'M15',     label: 'M15 (moins de 15 ans)' },
  { value: 'M17',     label: 'M17 (moins de 17 ans)' },
  { value: 'M20',     label: 'M20 (moins de 20 ans / Espoir)' },
  { value: 'Senior',  label: 'Senior' },
  { value: 'V1',      label: 'Vétéran V1 (40-49 ans)' },
  { value: 'V2',      label: 'Vétéran V2 (50-59 ans)' },
  { value: 'V3',      label: 'Vétéran V3 (60-69 ans)' },
  { value: 'V4',      label: 'Vétéran V4 (70 ans et +)' },
  { value: 'Open',    label: 'Open (toutes catégories)' },
] as const

/**
 * Configuration de l'affichage des données dans l'application et les impressions.
 * Définie une fois par compétition, appliquée partout (liste de présence, feuilles de poule, résultats).
 *
 * Pour chaque champ :
 *   - visible    : affiché dans la liste des tireurs en application
 *   - onCheckin  : imprimé sur la feuille de présence
 *   - onPool     : imprimé sur les feuilles de poule
 *   - onResults  : affiché dans le classement final
 */
export interface DisplayFieldConfig {
  visible: boolean
  onCheckin: boolean
  onPool: boolean
  onResults: boolean
}

export interface DisplayConfig {
  dateOfBirth:  DisplayFieldConfig
  gender:       DisplayFieldConfig
  club:         DisplayFieldConfig
  country:      DisplayFieldConfig
  licence:      DisplayFieldConfig
  initialRank:  DisplayFieldConfig
}

/** Valeurs par défaut (même comportement que l'ancienne application) */
export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  dateOfBirth:  { visible: true,  onCheckin: true,  onPool: false, onResults: false },
  gender:       { visible: false, onCheckin: false, onPool: false, onResults: false },
  club:         { visible: true,  onCheckin: true,  onPool: true,  onResults: true  },
  country:      { visible: false, onCheckin: false, onPool: false, onResults: false },
  licence:      { visible: false, onCheckin: false, onPool: false, onResults: false },
  initialRank:  { visible: true,  onCheckin: true,  onPool: true,  onResults: true  },
}

// ─── Fencer ───────────────────────────────────────────────────────────────────

export interface Fencer {
  id: string
  firstName: string
  lastName: string
  birthDate?: string // ISO YYYY-MM-DD
  gender: 'M' | 'F'
  club?: string
  country?: string
  licenceNumber?: string
  initialRank?: number
  present: boolean // checked-in
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  club?: string
  fencerIds: string[]   // IDs of Fencer entries in this team
  present: boolean      // whether the team is eligible to compete
  initialRank?: number  // seeding rank (sum of N best member initial ranks, lower = better seeded)
}

// ─── Referee ──────────────────────────────────────────────────────────────────

export interface Referee {
  id: string
  firstName: string
  lastName: string
  licenceNumber?: string
  club?: string   // ligue/club in cotcot
  country?: string
  present: boolean
}

// ─── Pool phase ───────────────────────────────────────────────────────────────

export interface PoolBout {
  id: string
  fencerAId: string
  fencerBId: string
  scoreA?: number
  scoreB?: number
  /** V = victoire, D = défaite, A = absent */
  resultA?: MatchResult
  resultB?: MatchResult
  refereeId?: string
  order: number // FIE bout order within the pool
}

export interface Pool {
  id: string
  number: number
  fencerIds: string[] // ordered list (position in pool)
  bouts: PoolBout[]
  piste?: string
  refereeId?: string
}

export interface PoolStageResult {
  fencerId: string
  victories: number
  bouts: number
  touchesScored: number
  touchesReceived: number
  index: number // TD - TR
  rank: number
  status: 'qualified' | 'eliminated' | 'barrage'
}

export interface PoolPhase {
  id: string
  type: 'pool'
  name: string
  status: StageStatus
  maxScore: number
  promotionPercent: number // % of fencers promoted to next round
  pools: Pool[]
  results: PoolStageResult[]
  /**
   * Statut individuel de chaque tireur dans cette phase de poules.
   * Clé = fencerId (ou teamId pour les épreuves par équipe).
   * Absent de la map = statut 'ok' (participation normale).
   *
   * withdrawal : le tireur déclare forfait en cours de phase.
   *   → Tous ses assauts non encore joués sont automatiquement remplis :
   *     adversaire reçoit V + score max ; tireur reçoit D + 0.
   * excluded : exclusion disciplinaire (carton noir).
   *   → Même traitement automatique que withdrawal.
   */
  fencerStatuses?: Record<string, FencerPoolStatus>
  /**
   * "Score stuffing automatique" : si activé, le remplissage automatique des
   * assauts d'un tireur withdrawal/excluded est effectué dès le changement de statut.
   * Hérite du paramètre de la compétition (autoScoreStuffing).
   */
  autoStuffing?: boolean
}

// ─── Barrage ──────────────────────────────────────────────────────────────────

export interface BarragePhase {
  id: string
  type: 'barrage'
  name: string
  status: StageStatus
  maxScore: number
  bouts: PoolBout[]
}

// ─── Tableau (elimination bracket) ───────────────────────────────────────────

export type TableauSize = 2 | 4 | 8 | 16 | 32 | 64 | 128

export interface TableauBout {
  id: string
  round: number // e.g. 64 = tableau de 64
  boutIndex: number // position in the round
  fencerAId?: string
  fencerBId?: string
  scoreA?: number
  scoreB?: number
  resultA?: MatchResult
  resultB?: MatchResult
  winnerId?: string
  refereeId?: string
}

export interface TableauPhase {
  id: string
  type: 'tableau'
  name: string
  status: StageStatus
  size: TableauSize
  maxScore: number
  /**
   * Places tirées au tableau.
   * - none        : aucune petite finale (3e et 4e ex-æquo)
   * - third_place : match pour la 3e place seulement
   * - all_places  : toutes les places sont disputées (nécessite des barrages supplémentaires)
   *
   * Remplace l'ancien booléen `hasThirdPlace`.
   * Pour compatibilité : hasThirdPlace = fencedPlaces !== 'none'.
   */
  fencedPlaces: FencedPlaces
  /** @deprecated utiliser fencedPlaces à la place */
  hasThirdPlace: boolean
  bouts: TableauBout[]
  lockedRounds: number[]  // round numbers (e.g. 32, 16, 8…) that have been locked/completed
}

// ─── Classification ───────────────────────────────────────────────────────────

export interface ClassificationEntry {
  rank: number
  fencerId: string
  status?: 'qualified' | 'eliminated'
}

export interface ClassificationPhase {
  id: string
  type: 'classification'
  name: string
  status: StageStatus
  entries: ClassificationEntry[]
}

// ─── Stage (discriminated union) ─────────────────────────────────────────────

export type Stage = PoolPhase | BarragePhase | TableauPhase | ClassificationPhase

// ─── Contest (individual or team competition) ─────────────────────────────────

export interface Contest {
  id: string
  name: string
  weapon: Weapon
  gender: Gender
  category?: string   // e.g. "Senior", "M20", "M15" — see FENCING_CATEGORIES
  organizer?: string
  location?: string
  date?: string       // ISO date YYYY-MM-DD
  isTeamEvent: boolean

  fencers: Fencer[]
  teams: Team[]       // populated only when isTeamEvent = true
  referees: Referee[]

  stages: Stage[]

  /**
   * Taille minimale d'une équipe pour qu'elle soit considérée présente.
   * (Compétitions par équipe uniquement)
   * Si une équipe a moins de `minTeamSize` membres présents, elle est
   * automatiquement considérée comme absente et ne peut pas participer.
   */
  minTeamSize?: number

  /**
   * Score stuffing automatique.
   * Quand un tireur est déclaré "withdrawal" (forfait) ou "excluded" (exclu),
   * tous ses assauts non encore joués sont automatiquement remplis :
   * - Adversaire reçoit V + score maximum
   * - Tireur reçoit D + 0
   * Évite de devoir remplir manuellement chaque assaut.
   * Par défaut : true (comportement de l'ancienne application).
   */
  autoScoreStuffing?: boolean

  /**
   * Configuration de l'affichage des données dans l'application et les impressions.
   * Définit pour chaque champ s'il est visible dans l'app, sur la feuille de présence,
   * sur les feuilles de poule, et dans le classement final.
   */
  displayConfig?: DisplayConfig

  createdAt: string
  updatedAt: string
}

// ─── Tournament (top-level container) ────────────────────────────────────────

export interface Tournament {
  id: string
  name: string
  organizer?: string
  location?: string
  startDate?: string
  contests: Contest[]
  createdAt: string
  updatedAt: string
}
