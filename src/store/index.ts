import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Tournament, Contest, Fencer, PoolPhase, PoolBout, TableauPhase, TableauBout, TableauSize } from '../types'
import { getAllTournaments, saveTournament, deleteTournament } from '../db'
import { allocatePools } from '../logic/pools'
import { buildBracket } from '../logic/tableau'

interface AppState {
  tournaments: Tournament[]
  loaded: boolean

  loadAll: () => Promise<void>
  createTournament: (name: string, organizer?: string) => Promise<Tournament>
  updateTournament: (t: Tournament) => Promise<void>
  removeTournament: (id: string) => Promise<void>

  // Contest
  addContest: (tournamentId: string, data: Omit<Contest, 'id' | 'fencers' | 'teams' | 'referees' | 'stages' | 'createdAt' | 'updatedAt'>) => Promise<Contest>
  updateContest: (tournamentId: string, contest: Contest) => Promise<void>
  removeContest: (tournamentId: string, contestId: string) => Promise<void>

  // Fencers
  addFencer: (tournamentId: string, contestId: string, fencer: Omit<Fencer, 'id'>) => Promise<void>
  updateFencer: (tournamentId: string, contestId: string, fencer: Fencer) => Promise<void>
  removeFencer: (tournamentId: string, contestId: string, fencerId: string) => Promise<void>
  setPresence: (tournamentId: string, contestId: string, fencerId: string, present: boolean) => Promise<void>

  // Stages
  addPoolPhase: (tournamentId: string, contestId: string, name: string, maxScore: number, promotionPercent: number) => Promise<void>
  allocatePoolPhase: (tournamentId: string, contestId: string, stageId: string, poolCount: number) => Promise<void>
  setPoolBoutScore: (tournamentId: string, contestId: string, stageId: string, poolId: string, boutId: string, scoreA: number, scoreB: number) => Promise<void>
  lockPoolPhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>
  unlockPoolPhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>

  addTableauPhase: (tournamentId: string, contestId: string, name: string, size: TableauSize, maxScore: number, hasThirdPlace: boolean) => Promise<void>
  setTableauBoutScore: (tournamentId: string, contestId: string, stageId: string, boutId: string, scoreA: number, scoreB: number) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function updateTournamentInList(tournaments: Tournament[], updated: Tournament): Tournament[] {
  return tournaments.map(t => t.id === updated.id ? updated : t)
}

function getTournamentOrThrow(tournaments: Tournament[], id: string): Tournament {
  const t = tournaments.find(t => t.id === id)
  if (!t) throw new Error(`Tournament ${id} not found`)
  return t
}

function getContestOrThrow(tournament: Tournament, contestId: string): Contest {
  const c = tournament.contests.find(c => c.id === contestId)
  if (!c) throw new Error(`Contest ${contestId} not found`)
  return c
}

function mutateContest(t: Tournament, contestId: string, fn: (c: Contest) => Contest): Tournament {
  return {
    ...t,
    updatedAt: now(),
    contests: t.contests.map(c => c.id === contestId ? fn(c) : c),
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  tournaments: [],
  loaded: false,

  loadAll: async () => {
    const tournaments = await getAllTournaments()
    set({ tournaments, loaded: true })
  },

  createTournament: async (name, organizer) => {
    const t: Tournament = {
      id: nanoid(),
      name,
      organizer,
      contests: [],
      createdAt: now(),
      updatedAt: now(),
    }
    await saveTournament(t)
    set(s => ({ tournaments: [...s.tournaments, t] }))
    return t
  },

  updateTournament: async (t) => {
    const updated = { ...t, updatedAt: now() }
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  removeTournament: async (id) => {
    await deleteTournament(id)
    set(s => ({ tournaments: s.tournaments.filter(t => t.id !== id) }))
  },

  // ── Contest ────────────────────────────────────────────────────────────────

  addContest: async (tournamentId, data) => {
    const { tournaments } = get()
    const tournament = getTournamentOrThrow(tournaments, tournamentId)
    const contest: Contest = {
      ...data,
      id: nanoid(),
      fencers: [],
      teams: [],
      referees: [],
      stages: [],
      createdAt: now(),
      updatedAt: now(),
    }
    const updated = { ...tournament, updatedAt: now(), contests: [...tournament.contests, contest] }
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
    return contest
  },

  updateContest: async (tournamentId, contest) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contest.id, () => ({ ...contest, updatedAt: now() }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  removeContest: async (tournamentId, contestId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = { ...t, updatedAt: now(), contests: t.contests.filter(c => c.id !== contestId) }
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  // ── Fencers ────────────────────────────────────────────────────────────────

  addFencer: async (tournamentId, contestId, fencerData) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const fencer: Fencer = { ...fencerData, id: nanoid() }
    const updated = mutateContest(t, contestId, c => ({ ...c, fencers: [...c.fencers, fencer] }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  updateFencer: async (tournamentId, contestId, fencer) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      fencers: c.fencers.map(f => f.id === fencer.id ? fencer : f),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  removeFencer: async (tournamentId, contestId, fencerId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      fencers: c.fencers.filter(f => f.id !== fencerId),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  setPresence: async (tournamentId, contestId, fencerId, present) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      fencers: c.fencers.map(f => f.id === fencerId ? { ...f, present } : f),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  // ── Pool phase ─────────────────────────────────────────────────────────────

  addPoolPhase: async (tournamentId, contestId, name, maxScore, promotionPercent) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const phase: PoolPhase = {
      id: nanoid(),
      type: 'pool',
      name,
      status: 'pending',
      maxScore,
      promotionPercent,
      pools: [],
      results: [],
    }
    const updated = mutateContest(t, contestId, c => ({ ...c, stages: [...c.stages, phase] }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  allocatePoolPhase: async (tournamentId, contestId, stageId, poolCount) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    const presentFencers = contest.fencers.filter(f => f.present)
    const pools = allocatePools(presentFencers, poolCount)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'pool'
        ? { ...s, pools, status: 'running' as const }
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  setPoolBoutScore: async (tournamentId, contestId, stageId, poolId, boutId, scoreA, scoreB) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => {
        if (s.id !== stageId || s.type !== 'pool') return s
        return {
          ...s,
          pools: (s as PoolPhase).pools.map(p => {
            if (p.id !== poolId) return p
            const poolMaxScore = (s as PoolPhase).maxScore
            return {
              ...p,
              bouts: p.bouts.map(b => {
                if (b.id !== boutId) return b
                const resultA = scoreA === poolMaxScore ? 'V' : (scoreA === 0 && scoreB === 0 ? 'A' : 'D')
                const resultB = scoreB === poolMaxScore ? 'V' : (scoreA === 0 && scoreB === 0 ? 'A' : 'D')
                return { ...b, scoreA, scoreB, resultA, resultB } as PoolBout
              }),
            }
          }),
        } as PoolPhase
      }),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  lockPoolPhase: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    const phase = contest.stages.find(s => s.id === stageId) as PoolPhase | undefined
    if (!phase || phase.type !== 'pool') return
    const results = computePoolResults(phase)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId
        ? { ...s, status: 'done' as const, results }
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  unlockPoolPhase: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => {
      const stageIdx = c.stages.findIndex(s => s.id === stageId)
      return {
        ...c,
        // Remove all stages that came after this one (they're based on now-invalid results)
        stages: c.stages
          .slice(0, stageIdx + 1)
          .map(s => s.id === stageId && s.type === 'pool'
            ? { ...s, status: 'running' as const }
            : s),
      }
    })
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  // ── Tableau phase ──────────────────────────────────────────────────────────

  addTableauPhase: async (tournamentId, contestId, name, size, maxScore, hasThirdPlace) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    // Seed from last pool phase results, or initial ranking
    const seededFencers = getSeedOrder(contest)
    const bouts = buildBracket(size, seededFencers)
    const phase: TableauPhase = {
      id: nanoid(),
      type: 'tableau',
      name,
      status: 'running',
      size,
      maxScore,
      hasThirdPlace,
      bouts,
    }
    const updated = mutateContest(t, contestId, c => ({ ...c, stages: [...c.stages, phase] }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  setTableauBoutScore: async (tournamentId, contestId, stageId, boutId, scoreA, scoreB) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    const phase = contest.stages.find(s => s.id === stageId) as TableauPhase | undefined
    if (!phase || phase.type !== 'tableau') return
    const updatedBouts = advanceBracket(phase.bouts, boutId, scoreA, scoreB, phase.maxScore)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId
        ? { ...s, bouts: updatedBouts } as TableauPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },
}))

// ─── Pool results computation ─────────────────────────────────────────────────

import type { PoolStageResult } from '../types'

function computePoolResults(phase: PoolPhase): PoolStageResult[] {
  const totals: Record<string, PoolStageResult> = {}

  for (const pool of phase.pools) {
    for (const fId of pool.fencerIds) {
      totals[fId] = { fencerId: fId, victories: 0, bouts: 0, touchesScored: 0, touchesReceived: 0, index: 0, rank: 0, status: 'eliminated' }
    }
    for (const bout of pool.bouts) {
      const a = totals[bout.fencerAId]
      const b = totals[bout.fencerBId]
      if (!a || !b) continue
      if (bout.resultA === 'A' || bout.resultB === 'A') continue
      a.bouts++; b.bouts++
      a.touchesScored += bout.scoreA ?? 0
      a.touchesReceived += bout.scoreB ?? 0
      b.touchesScored += bout.scoreB ?? 0
      b.touchesReceived += bout.scoreA ?? 0
      if (bout.resultA === 'V') a.victories++
      if (bout.resultB === 'V') b.victories++
    }
  }

  const entries = Object.values(totals).map(e => ({ ...e, index: e.touchesScored - e.touchesReceived }))

  entries.sort((a, b) => {
    if (b.victories !== a.victories) return b.victories - a.victories
    if (b.index !== a.index) return b.index - a.index
    return b.touchesScored - a.touchesScored
  })

  const total = entries.length
  const qualifiedCount = Math.round(total * phase.promotionPercent / 100)

  return entries.map((e, i) => ({
    ...e,
    rank: i + 1,
    status: i < qualifiedCount ? 'qualified' : 'eliminated',
  }))
}

// ─── Seed order helper ────────────────────────────────────────────────────────

function getSeedOrder(contest: Contest): string[] {
  const lastPool = [...contest.stages].reverse().find(s => s.type === 'pool') as PoolPhase | undefined
  if (lastPool && lastPool.results.length > 0) {
    return lastPool.results
      .filter(r => r.status === 'qualified')
      .sort((a, b) => a.rank - b.rank)
      .map(r => r.fencerId)
  }
  // Fallback: present fencers sorted by initialRank
  return contest.fencers
    .filter(f => f.present)
    .sort((a, b) => (a.initialRank ?? 9999) - (b.initialRank ?? 9999))
    .map(f => f.id)
}

// ─── Bracket advancement ──────────────────────────────────────────────────────

function advanceBracket(bouts: TableauBout[], boutId: string, scoreA: number, scoreB: number, _maxScore: number): TableauBout[] {
  const bout = bouts.find(b => b.id === boutId)
  if (!bout) return bouts
  const winnerId = scoreA > scoreB ? bout.fencerAId : bout.fencerBId
  const resultA: import('../types').MatchResult = scoreA > scoreB ? 'V' : 'D'
  const resultB: import('../types').MatchResult = scoreB > scoreA ? 'V' : 'D'
  const updated = bouts.map(b => b.id === boutId ? { ...b, scoreA, scoreB, resultA, resultB, winnerId } : b)

  // Advance winner to next round bout
  const nextRound = Math.floor(bout.round / 2)
  if (nextRound < 1) return updated

  const nextBoutIndex = Math.floor(bout.boutIndex / 2)
  const isSlotA = bout.boutIndex % 2 === 0
  return updated.map(b => {
    if (b.round === nextRound && b.boutIndex === nextBoutIndex) {
      return isSlotA
        ? { ...b, fencerAId: winnerId }
        : { ...b, fencerBId: winnerId }
    }
    return b
  })
}
