import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Tournament, Contest, Fencer, Referee, Team, PoolPhase, PoolBout, BarragePhase, TableauPhase, TableauBout, TableauSize, MatchResult, FencerPoolStatus, FencedPlaces } from '../types'
import { getAllTournaments, saveTournament, deleteTournament } from '../db'
import { allocatePools, fieBoutOrder } from '../logic/pools'
import { buildBracket, propagateByes } from '../logic/tableau'

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
  addFencer: (tournamentId: string, contestId: string, fencer: Omit<Fencer, 'id'> & { id?: string }) => Promise<void>
  updateFencer: (tournamentId: string, contestId: string, fencer: Fencer) => Promise<void>
  removeFencer: (tournamentId: string, contestId: string, fencerId: string) => Promise<void>
  setPresence: (tournamentId: string, contestId: string, fencerId: string, present: boolean) => Promise<void>
  setAllPresence: (tournamentId: string, contestId: string, present: boolean) => Promise<void>

  // Referees
  addReferee: (tournamentId: string, contestId: string, referee: Omit<Referee, 'id'>) => Promise<void>
  removeReferee: (tournamentId: string, contestId: string, refereeId: string) => Promise<void>
  setRefereePresence: (tournamentId: string, contestId: string, refereeId: string, present: boolean) => Promise<void>

  // Teams (team events)
  addTeam: (tournamentId: string, contestId: string, team: Omit<Team, 'id'>) => Promise<Team>
  updateTeam: (tournamentId: string, contestId: string, team: Team) => Promise<void>
  removeTeam: (tournamentId: string, contestId: string, teamId: string) => Promise<void>
  addFencerToTeam: (tournamentId: string, contestId: string, teamId: string, fencerId: string) => Promise<void>
  setTeamPresence: (tournamentId: string, contestId: string, teamId: string, present: boolean) => Promise<void>

  // Stages
  addPoolPhase: (tournamentId: string, contestId: string, name: string, maxScore: number, promotionPercent: number) => Promise<void>
  removeStage: (tournamentId: string, contestId: string, stageId: string) => Promise<void>
  allocatePoolPhase: (tournamentId: string, contestId: string, stageId: string, poolCount: number, seedingBalanced?: boolean) => Promise<void>
  /**
   * Change le statut d'un tireur dans une phase de poules.
   * Si autoStuff=true et que le nouveau statut est 'withdrawal' ou 'excluded',
   * remplit automatiquement tous les assauts non joués du tireur (score stuffing).
   */
  setPoolFencerStatus: (tournamentId: string, contestId: string, stageId: string, participantId: string, status: FencerPoolStatus, autoStuff?: boolean) => Promise<void>
  /**
   * Ajoute un retardataire (arrivé après le début des poules) à la plus petite poule.
   * Les assauts déjà joués sans lui sont marqués V + score max pour ses adversaires (absent).
   * Le retardataire reçoit D + 0 pour ces assauts passés.
   */
  addLatecomer: (tournamentId: string, contestId: string, stageId: string, participantId: string) => Promise<void>
  setPoolBoutScore: (tournamentId: string, contestId: string, stageId: string, poolId: string, boutId: string, scoreA: number, scoreB: number) => Promise<void>
  setPoolBoutAbsent: (tournamentId: string, contestId: string, stageId: string, poolId: string, boutId: string, absentSide: 'A' | 'B') => Promise<void>
  lockPoolPhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>
  unlockPoolPhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>
  fillRandomPoolBouts: (tournamentId: string, contestId: string, stageId: string) => Promise<void>

  addBarragePhase: (tournamentId: string, contestId: string, name: string, maxScore: number) => Promise<void>
  addBarrageBout: (tournamentId: string, contestId: string, stageId: string, fencerAId: string, fencerBId: string) => Promise<void>
  setBarrageBoutScore: (tournamentId: string, contestId: string, stageId: string, boutId: string, scoreA: number, scoreB: number) => Promise<void>
  lockBarragePhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>
  unlockBarragePhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>

  addTableauPhase: (tournamentId: string, contestId: string, name: string, size: TableauSize, maxScore: number, fencedPlaces: FencedPlaces) => Promise<void>
  setTableauBoutScore: (tournamentId: string, contestId: string, stageId: string, boutId: string, scoreA: number, scoreB: number) => Promise<void>
  lockTableauPhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>
  unlockTableauPhase: (tournamentId: string, contestId: string, stageId: string) => Promise<void>
  lockTableauRound: (tournamentId: string, contestId: string, stageId: string, round: number) => Promise<void>
  unlockTableauRound: (tournamentId: string, contestId: string, stageId: string, round: number) => Promise<void>
  fillRandomTableauBouts: (tournamentId: string, contestId: string, stageId: string, round?: number) => Promise<void>
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
    // Preserve the ID if one was supplied (e.g. from XML import) so team fencerIds stay consistent
    const fencer: Fencer = { id: nanoid(), ...fencerData }
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

  setAllPresence: async (tournamentId, contestId, present) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    // Update fencers and teams in one single mutation to avoid concurrent write races
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      fencers: c.fencers.map(f => ({ ...f, present })),
      teams: c.teams.map(team => ({ ...team, present })),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  // ── Referees ───────────────────────────────────────────────────────────────

  addReferee: async (tournamentId, contestId, refereeData) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const referee: Referee = { ...refereeData, id: nanoid() }
    const updated = mutateContest(t, contestId, c => ({ ...c, referees: [...c.referees, referee] }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  removeReferee: async (tournamentId, contestId, refereeId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      referees: c.referees.filter(r => r.id !== refereeId),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  setRefereePresence: async (tournamentId, contestId, refereeId, present) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      referees: c.referees.map(r => r.id === refereeId ? { ...r, present } : r),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  // ── Teams ──────────────────────────────────────────────────────────────────

  addTeam: async (tournamentId, contestId, teamData) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const team: Team = { ...teamData, id: nanoid() }
    const updated = mutateContest(t, contestId, c => ({ ...c, teams: [...c.teams, team] }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
    return team
  },

  updateTeam: async (tournamentId, contestId, team) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      teams: c.teams.map(tm => tm.id === team.id ? team : tm),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  removeTeam: async (tournamentId, contestId, teamId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      teams: c.teams.filter(t => t.id !== teamId),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  addFencerToTeam: async (tournamentId, contestId, teamId, fencerId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      teams: c.teams.map(team =>
        team.id === teamId && !team.fencerIds.includes(fencerId)
          ? { ...team, fencerIds: [...team.fencerIds, fencerId] }
          : team
      ),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  setTeamPresence: async (tournamentId, contestId, teamId, present) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      teams: c.teams.map(team => team.id === teamId ? { ...team, present } : team),
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

  removeStage: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.filter(s => s.id !== stageId),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  allocatePoolPhase: async (tournamentId, contestId, stageId, poolCount, seedingBalanced = true) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)

    // If a previous pool phase exists and is done, use its ranking as seeding order
    // (FIE rule: 2nd pool round seeded from 1st round results, not initial ranking)
    const stageIdx = contest.stages.findIndex(s => s.id === stageId)
    const prevPoolPhase = contest.stages
      .slice(0, stageIdx)
      .reverse()
      .find(s => s.type === 'pool' && s.status === 'done') as PoolPhase | undefined
    const seedOrder = prevPoolPhase
      ? [...prevPoolPhase.results].sort((a, b) => a.rank - b.rank).map(r => r.fencerId)
      : undefined

    // For team events, pools contain teams (not individual fencers)
    const participants = contest.isTeamEvent
      ? contest.teams.filter(team => team.present !== false).map(team => ({ id: team.id, initialRank: team.initialRank }))
      : contest.fencers.filter(f => f.present)

    const pools = allocatePools(participants, poolCount, seedOrder, seedingBalanced)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'pool'
        ? { ...s, pools, status: 'running' as const }
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  // ── Statut tireur dans les poules ──────────────────────────────────────────

  setPoolFencerStatus: async (tournamentId, contestId, stageId, participantId, status, autoStuff = true) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    const phase = contest.stages.find(s => s.id === stageId) as PoolPhase | undefined
    if (!phase || phase.type !== 'pool') return

    const shouldStuff = autoStuff && (status === 'withdrawal' || status === 'excluded')
    const shouldClear = status === 'ok'
    const maxScore = phase.maxScore

    // If auto stuffing: fill all unplayed bouts of this participant
    // If reverting to ok: clear all absent bouts involving this participant
    const updatedPools = (shouldStuff || shouldClear)
      ? phase.pools.map(pool => {
          if (!pool.fencerIds.includes(participantId)) return pool
          return {
            ...pool,
            bouts: pool.bouts.map(bout => {
              const isA = bout.fencerAId === participantId
              const isB = bout.fencerBId === participantId
              if (!isA && !isB) return bout

              if (shouldClear) {
                // Clear only bouts where this fencer was marked absent (resultA/B === 'A')
                const wasAbsent = (isA && bout.resultA === 'A') || (isB && bout.resultB === 'A')
                if (!wasAbsent) return bout
                return { ...bout, scoreA: undefined, scoreB: undefined, resultA: undefined, resultB: undefined }
              }

              // Only fill bouts that haven't been scored yet
              if (bout.resultA !== undefined && bout.resultB !== undefined) return bout
              if (isA) {
                return { ...bout, scoreA: 0, scoreB: maxScore, resultA: 'A' as MatchResult, resultB: 'V' as MatchResult }
              } else {
                return { ...bout, scoreA: maxScore, scoreB: 0, resultA: 'V' as MatchResult, resultB: 'A' as MatchResult }
              }
            }),
          }
        })
      : phase.pools

    const newStatuses = { ...(phase.fencerStatuses ?? {}), [participantId]: status }
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'pool'
        ? { ...s, pools: updatedPools, fencerStatuses: newStatuses } as PoolPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  // ── Retardataire (latecomer) ────────────────────────────────────────────────

  addLatecomer: async (tournamentId, contestId, stageId, participantId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    const phase = contest.stages.find(s => s.id === stageId) as PoolPhase | undefined
    if (!phase || phase.type !== 'pool') return

    // Find the smallest pool (fewest fencers)
    const targetPool = [...phase.pools].sort((a, b) => a.fencerIds.length - b.fencerIds.length)[0]
    if (!targetPool) return

    // Add fencer to that pool and generate new bouts for this fencer
    const newFencerIds = [...targetPool.fencerIds, participantId]
    const maxScore = phase.maxScore

    // Compute which bouts already have scores (those are in the "past")
    // The latecomer gets added: for each existing member, a new bout is created.
    // Bouts with existing members that were already played: latecomer gets D+0, opponent V+maxScore.
    // Bouts not yet played: normal bout with the latecomer.
    const alreadyScoredOpponentIds = targetPool.bouts
      .filter(b => b.resultA !== undefined || b.resultB !== undefined)
      .flatMap(b => [b.fencerAId, b.fencerBId])
      .filter(id => id !== participantId)

    const existingOpponentIds = targetPool.fencerIds

    // Determine which existing bouts are "in the past" by whether they have a result
    // (heuristic: if more than half the bouts in the pool are done, consider those opponents "past")
    const scoredBoutCount = targetPool.bouts.filter(b => b.resultA !== undefined).length
    const pastOpponentIds = scoredBoutCount > 0 ? new Set(alreadyScoredOpponentIds) : new Set<string>()

    const newBouts: PoolBout[] = existingOpponentIds.map((opponentId, i) => {
      const isPast = pastOpponentIds.has(opponentId)
      const boutOrder = targetPool.bouts.length + i + 1
      if (isPast) {
        // Latecomer was absent: opponent V + maxScore, latecomer A + 0
        return {
          id: nanoid(),
          fencerAId: opponentId,
          fencerBId: participantId,
          scoreA: maxScore,
          scoreB: 0,
          resultA: 'V' as MatchResult,
          resultB: 'A' as MatchResult,
          order: boutOrder,
        }
      }
      return {
        id: nanoid(),
        fencerAId: opponentId,
        fencerBId: participantId,
        order: boutOrder,
      }
    })

    const updatedPools = phase.pools.map(pool =>
      pool.id === targetPool.id
        ? { ...pool, fencerIds: newFencerIds, bouts: [...pool.bouts, ...newBouts] }
        : pool
    )

    const updated = mutateContest(t, contestId, c => ({
      ...c,
      // Mark latecomer as present (they may have been absent at check-in)
      fencers: c.fencers.map(f => f.id === participantId ? { ...f, present: true } : f),
      teams: c.teams?.map(tm => tm.id === participantId ? { ...tm, present: true } : tm),
      stages: c.stages.map(s => s.id === stageId && s.type === 'pool'
        ? { ...s, pools: updatedPools } as PoolPhase
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
                // FIE art. t.93 : victoire = atteindre le score max OU avoir
                // le plus de touches quand le temps expire (résultat "à la montre").
                // resultA/B dépend uniquement de qui a plus de touches.
                void poolMaxScore
                const resultA: MatchResult = scoreA > scoreB ? 'V' : 'D'
                const resultB: MatchResult = scoreB > scoreA ? 'V' : 'D'
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

  setPoolBoutAbsent: async (tournamentId, contestId, stageId, poolId, boutId, absentSide) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => {
        if (s.id !== stageId || s.type !== 'pool') return s
        const maxScore = (s as PoolPhase).maxScore
        return {
          ...s,
          pools: (s as PoolPhase).pools.map(p => {
            if (p.id !== poolId) return p
            return {
              ...p,
              bouts: p.bouts.map(b => {
                if (b.id !== boutId) return b
                if (absentSide === 'A') {
                  return { ...b, scoreA: 0, scoreB: maxScore, resultA: 'A' as MatchResult, resultB: 'V' as MatchResult }
                } else {
                  return { ...b, scoreA: maxScore, scoreB: 0, resultA: 'V' as MatchResult, resultB: 'A' as MatchResult }
                }
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

  addTableauPhase: async (tournamentId, contestId, name, size, maxScore, fencedPlaces) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    // Seed from last pool phase results, or initial ranking
    const seededFencers = getSeedOrder(contest)
    const hasThirdPlace = fencedPlaces !== 'none'
    const bouts = buildBracket(size, seededFencers, hasThirdPlace)
    // Auto-lock rounds where propagateByes already resolved every bout (100% byes, no real match to play)
    const allRounds = Array.from(new Set(bouts.filter(b => !(b.round === 4 && b.boutIndex === 2)).map(b => b.round)))
    const autoLockedRounds = allRounds.filter(r => {
      const roundBouts = bouts.filter(b => b.round === r)
      return roundBouts.length > 0 && roundBouts.every(b => !!b.winnerId)
    })
    const phase: TableauPhase = {
      id: nanoid(),
      type: 'tableau',
      name,
      status: 'running',
      size,
      maxScore,
      fencedPlaces,
      hasThirdPlace,
      bouts,
      lockedRounds: autoLockedRounds,
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
    const updatedBouts = propagateByes(advanceBracket(phase.bouts, boutId, scoreA, scoreB, phase.maxScore))
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId
        ? { ...s, bouts: updatedBouts } as TableauPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  fillRandomPoolBouts: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    const phase = contest.stages.find(s => s.id === stageId) as PoolPhase | undefined
    if (!phase || phase.type !== 'pool') return
    const maxScore = phase.maxScore
    const updatedPools = phase.pools.map(pool => ({
      ...pool,
      bouts: pool.bouts.map(bout => {
        // Random: winner gets maxScore, loser gets 0..maxScore-1
        const aWins = Math.random() < 0.5
        const loserScore = Math.floor(Math.random() * maxScore)
        const sa = aWins ? maxScore : loserScore
        const sb = aWins ? loserScore : maxScore
        const resultA: PoolBout['resultA'] = aWins ? 'V' : 'D'
        const resultB: PoolBout['resultB'] = aWins ? 'D' : 'V'
        return { ...bout, scoreA: sa, scoreB: sb, resultA, resultB }
      }),
    }))
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'pool'
        ? { ...s, pools: updatedPools } as PoolPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  addBarragePhase: async (tournamentId, contestId, name, maxScore) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const phase: BarragePhase = {
      id: nanoid(),
      type: 'barrage',
      name,
      status: 'running',
      maxScore,
      bouts: [],
    }
    const updated = mutateContest(t, contestId, c => ({ ...c, stages: [...c.stages, phase] }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  addBarrageBout: async (tournamentId, contestId, stageId, fencerAId, fencerBId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const newBout: PoolBout = { id: nanoid(), fencerAId, fencerBId, order: 0 }
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => {
        if (s.id !== stageId || s.type !== 'barrage') return s
        const phase = s as BarragePhase
        const order = phase.bouts.length + 1
        return { ...phase, bouts: [...phase.bouts, { ...newBout, order }] } as BarragePhase
      }),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  setBarrageBoutScore: async (tournamentId, contestId, stageId, boutId, scoreA, scoreB) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => {
        if (s.id !== stageId || s.type !== 'barrage') return s
        const resultA: MatchResult = scoreA > scoreB ? 'V' : 'D'
        const resultB: MatchResult = scoreB > scoreA ? 'V' : 'D'
        return {
          ...s,
          bouts: (s as BarragePhase).bouts.map(b =>
            b.id === boutId ? { ...b, scoreA, scoreB, resultA, resultB } : b
          ),
        } as BarragePhase
      }),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  lockBarragePhase: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s =>
        s.id === stageId && s.type === 'barrage'
          ? { ...s, status: 'done' as const }
          : s
      ),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  unlockBarragePhase: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s =>
        s.id === stageId && s.type === 'barrage'
          ? { ...s, status: 'running' as const }
          : s
      ),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  lockTableauPhase: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'tableau'
        ? { ...s, status: 'done' } as TableauPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  unlockTableauPhase: async (tournamentId, contestId, stageId) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'tableau'
        ? { ...s, status: 'running' } as TableauPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  lockTableauRound: async (tournamentId, contestId, stageId, round) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'tableau'
        ? { ...s, lockedRounds: [...new Set([...(s.lockedRounds ?? []), round])] } as TableauPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  unlockTableauRound: async (tournamentId, contestId, stageId, round) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'tableau'
        ? { ...s, lockedRounds: (s.lockedRounds ?? []).filter(r => r !== round) } as TableauPhase
        : s),
    }))
    await saveTournament(updated)
    set(s => ({ tournaments: updateTournamentInList(s.tournaments, updated) }))
  },

  fillRandomTableauBouts: async (tournamentId, contestId, stageId, round?) => {
    const { tournaments } = get()
    const t = getTournamentOrThrow(tournaments, tournamentId)
    const contest = getContestOrThrow(t, contestId)
    const phase = contest.stages.find(s => s.id === stageId) as TableauPhase | undefined
    if (!phase || phase.type !== 'tableau') return
    const maxScore = phase.maxScore
    // Process rounds in order from largest (first round) to smallest (final)
    const allRounds = Array.from(new Set(phase.bouts.map(b => b.round))).sort((a, b) => b - a)
    const rounds = round ? [round] : allRounds
    // First propagate any existing BYEs (handles brackets created before the fix)
    let bouts = propagateByes(phase.bouts)
    for (const round of rounds) {
      // Re-filter each iteration so 3rd place bout is picked up after semi-finals are scored
      let hasMore = true
      while (hasMore) {
        const unscored = bouts.filter(b => b.round === round && b.fencerAId && b.fencerBId && !b.winnerId)
        if (unscored.length === 0) { hasMore = false; break }
        const bout = unscored[0]
        const aWins = Math.random() < 0.5
        const loserScore = Math.floor(Math.random() * maxScore)
        const sa = aWins ? maxScore : loserScore
        const sb = aWins ? loserScore : maxScore
        bouts = advanceBracket(bouts, bout.id, sa, sb, maxScore)
      }
    }
    const updated = mutateContest(t, contestId, c => ({
      ...c,
      stages: c.stages.map(s => s.id === stageId && s.type === 'tableau'
        ? { ...s, bouts } as TableauPhase
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
      if (bout.resultA === 'A') {
        // Fencer A absent: B gets V+maxScore, A gets D0
        a.bouts++; b.bouts++
        b.victories++
        b.touchesScored += phase.maxScore
        a.touchesReceived += phase.maxScore
      } else if (bout.resultB === 'A') {
        // Fencer B absent: A gets V+maxScore, B gets D0
        a.bouts++; b.bouts++
        a.victories++
        a.touchesScored += phase.maxScore
        b.touchesReceived += phase.maxScore
      } else {
        a.bouts++; b.bouts++
        a.touchesScored += bout.scoreA ?? 0
        a.touchesReceived += bout.scoreB ?? 0
        b.touchesScored += bout.scoreB ?? 0
        b.touchesReceived += bout.scoreA ?? 0
        if (bout.resultA === 'V') a.victories++
        if (bout.resultB === 'V') b.victories++
      }
    }
  }

  const entries = Object.values(totals).map(e => ({ ...e, index: e.touchesScored - e.touchesReceived }))

  // FIE t.116 / BellePoule: sort by V/M ratio (‰), then index (TD-TR), then TD
  // Using integer ratio (×1000) like BellePoule to avoid float precision issues
  entries.sort((a, b) => {
    const ratioA = a.bouts > 0 ? Math.floor(a.victories * 1000 / a.bouts) : 0
    const ratioB = b.bouts > 0 ? Math.floor(b.victories * 1000 / b.bouts) : 0
    if (ratioB !== ratioA) return ratioB - ratioA
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
    // Exclude fencers who were forfait or excluded during the pool phase
    const excludedFromPool = new Set(
      Object.entries(lastPool.fencerStatuses ?? {})
        .filter(([, s]) => s === 'withdrawal' || s === 'excluded')
        .map(([id]) => id)
    )
    const qualifiedIds = lastPool.results
      .filter(r => r.status === 'qualified' && !excludedFromPool.has(r.fencerId))
      .sort((a, b) => a.rank - b.rank)
      .map(r => r.fencerId)
    // Exclude participants who have declared forfait (present = false) since the pool was locked
    if (contest.isTeamEvent) {
      const presentTeamIds = new Set(contest.teams.filter(t => t.present !== false).map(t => t.id))
      return qualifiedIds.filter(id => presentTeamIds.has(id))
    } else {
      const presentFencerIds = new Set(contest.fencers.filter(f => f.present).map(f => f.id))
      return qualifiedIds.filter(id => presentFencerIds.has(id))
    }
  }
  // Fallback: present participants sorted by initialRank
  if (contest.isTeamEvent) {
    return contest.teams
      .filter(t => t.present !== false)
      .sort((a, b) => (a.initialRank ?? 99999) - (b.initialRank ?? 99999))
      .map(t => t.id)
  }
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
  const loserId = scoreA > scoreB ? bout.fencerBId : bout.fencerAId
  const resultA: import('../types').MatchResult = scoreA > scoreB ? 'V' : 'D'
  const resultB: import('../types').MatchResult = scoreB > scoreA ? 'V' : 'D'
  const updated = bouts.map(b => b.id === boutId ? { ...b, scoreA, scoreB, resultA, resultB, winnerId } : b)

  // Advance winner to next round bout
  const nextRound = Math.floor(bout.round / 2)
  if (nextRound < 1) return updated

  const nextBoutIndex = Math.floor(bout.boutIndex / 2)
  const isSlotA = bout.boutIndex % 2 === 0
  let result = updated.map(b => {
    if (b.round === nextRound && b.boutIndex === nextBoutIndex) {
      return isSlotA
        ? { ...b, fencerAId: winnerId }
        : { ...b, fencerBId: winnerId }
    }
    return b
  })

  // Route loser to 3rd place bout if this is a semi-final (round=4, boutIndex 0 or 1)
  if (bout.round === 4 && (bout.boutIndex === 0 || bout.boutIndex === 1)) {
    const hasThirdPlace = result.some(b => b.round === 4 && b.boutIndex === 2)
    if (hasThirdPlace && loserId) {
      result = result.map(b => {
        if (b.round === 4 && b.boutIndex === 2) {
          // bout 0 loser → slot A, bout 1 loser → slot B; reset result if rescoring
          return bout.boutIndex === 0
            ? { ...b, fencerAId: loserId, winnerId: undefined, scoreA: undefined, scoreB: undefined }
            : { ...b, fencerBId: loserId, winnerId: undefined, scoreA: undefined, scoreB: undefined }
        }
        return b
      })
    }
  }

  return result
}
