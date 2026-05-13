// ─── Enums ────────────────────────────────────────────────────────────────────

export type Weapon = 'epee' | 'foil' | 'sabre'
export type Gender = 'men' | 'women' | 'mixed'
export type StageType = 'checkin' | 'pool' | 'tableau' | 'classification' | 'barrage'
export type StageStatus = 'pending' | 'running' | 'done'
export type MatchResult = 'V' | 'D' | 'A' // Victory, Defeat, Absent

// ─── Fencer ───────────────────────────────────────────────────────────────────

export interface Fencer {
  id: string
  firstName: string
  lastName: string
  birthYear?: number
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
  fencerIds: string[] // IDs of Fencer entries in this team
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
}

// ─── Barrage ──────────────────────────────────────────────────────────────────

export interface BarragePhase {
  id: string
  type: 'barrage'
  name: string
  status: StageStatus
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
  hasThirdPlace: boolean
  bouts: TableauBout[]
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
  category?: string   // e.g. "Senior", "Cadet", "Vétéran"
  organizer?: string
  location?: string
  date?: string       // ISO date YYYY-MM-DD
  isTeamEvent: boolean

  fencers: Fencer[]
  teams: Team[]       // populated only when isTeamEvent = true
  referees: Referee[]

  stages: Stage[]

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
