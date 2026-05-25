import { nanoid } from 'nanoid'
import type { TableauBout, TableauSize, FencedPlaces } from '../types'

/**
 * Build an empty bracket for a tableau of given size.
 * Seeds are placed according to FIE seeding table.
 * Returns a flat list of TableauBout for all rounds.
 *
 * Rounds are numbered by the "tableau de X" terminology:
 * size=64 → rounds 64, 32, 16, 8, 4, 2 (final)
 *
 * Bout indexing within a round: 0-based, top to bottom.
 */

// FIE seeding positions for each bracket size (1-indexed seed → 0-based slot in first round)
const FIE_SEEDING: Record<number, number[]> = {
  2:   [0, 1],
  4:   [0, 3, 1, 2],
  8:   [0, 7, 3, 4, 1, 6, 2, 5],
  16:  [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10],
  32:  [0,31,15,16,7,24,8,23,3,28,12,19,4,27,11,20,1,30,14,17,6,25,9,22,2,29,13,18,5,26,10,21],
  64:  generateSeedingFor(64),
  128: generateSeedingFor(128),
}

function generateSeedingFor(n: number): number[] {
  let positions = [0, 1]
  while (positions.length < n) {
    const next: number[] = []
    for (const p of positions) {
      next.push(p, positions.length * 2 - 1 - p)
    }
    positions = next
  }
  return positions
}

/**
 * Returns true if ANY first-round slot in the sub-tree rooted at this bout
 * contains a real player.  Used to determine whether an empty slot is a
 * definitive BYE (no player ever) vs a pending match result.
 *
 * `size` = the first-round number (e.g. 32 for a T32).
 * Only considers main bracket bouts (no bracket identifier).
 */
function branchHasPlayer(bouts: TableauBout[], round: number, boutIndex: number, size: number): boolean {
  const bout = bouts.find(b => !b.bracket && b.round === round && b.boutIndex === boutIndex)
  if (!bout) return false
  if (round === size) {
    // Base case: first round — has a player if either slot is filled
    return !!(bout.fencerAId || bout.fencerBId)
  }
  // Recurse into predecessor bouts (higher round number = earlier in bracket)
  return (
    branchHasPlayer(bouts, round * 2, boutIndex * 2, size) ||
    branchHasPlayer(bouts, round * 2, boutIndex * 2 + 1, size)
  )
}

/**
 * Propagate BYEs through a bracket correctly.
 *
 * A bout auto-advances its player ONLY when the opponent's ENTIRE sub-tree
 * has no real players — i.e. the missing slot is definitively void, not just
 * "waiting for the other match to finish".
 *
 * This prevents cascading BYEs into rounds that still have real matches to play.
 * Exported so the store can call it after each advanceBracket.
 *
 * Only processes main bracket bouts (bouts without a bracket identifier).
 * Consolation bracket bouts are passed through unchanged.
 */
function advanceWinner(working: TableauBout[], bout: TableauBout, winnerId: string) {
  const r = bout.round
  const nextRound = Math.floor(r / 2)
  if (nextRound < 1) return
  const nextBoutIndex = Math.floor(bout.boutIndex / 2)
  const isSlotA = bout.boutIndex % 2 === 0
  const next = working.find(b => !b.bracket && b.round === nextRound && b.boutIndex === nextBoutIndex)
  if (next && !next.winnerId) {
    if (isSlotA && !next.fencerAId) next.fencerAId = winnerId
    else if (!isSlotA && !next.fencerBId) next.fencerBId = winnerId
  }
}

function propagateByeForBout(
  bout: TableauBout,
  working: TableauBout[],
  size: number,
): boolean {
  const hasA = !!bout.fencerAId
  const hasB = !!bout.fencerBId
  if (hasA === hasB) return false

  const r = bout.round
  let emptyBranchHasPlayer: boolean
  if (r === size) {
    emptyBranchHasPlayer = false
  } else {
    const emptyPredIdx = !hasA ? bout.boutIndex * 2 : bout.boutIndex * 2 + 1
    emptyBranchHasPlayer = branchHasPlayer(working, r * 2, emptyPredIdx, size)
  }

  if (!emptyBranchHasPlayer) {
    const winnerId = (bout.fencerAId ?? bout.fencerBId) as string
    bout.winnerId = winnerId
    advanceWinner(working, bout, winnerId)
    return true
  }
  return false
}

export function propagateByes(bouts: TableauBout[]): TableauBout[] {
  const working = bouts.map(b => ({ ...b }))
  // Only work on main bracket bouts
  const mainBouts = working.filter(b => !b.bracket)
  if (mainBouts.length === 0) return working
  const size = Math.max(...mainBouts.map(b => b.round))
  const rounds = Array.from(new Set(mainBouts.map(b => b.round))).sort((a, b) => b - a)

  let changed = true
  while (changed) {
    changed = false
    for (const r of rounds) {
      for (const bout of working.filter(b => !b.bracket && b.round === r && !b.winnerId)) {
        if (propagateByeForBout(bout, working, size)) changed = true
      }
    }
  }
  return working
}

function buildConsolationBrackets(result: TableauBout[], size: number) {
  let R = size
  while (R >= 8) {
    const bracketId = `cons-from-${R}`
    const consSize = R / 2
    let consRound = consSize
    while (consRound >= 2) {
      const boutCount = consRound / 2
      for (let i = 0; i < boutCount; i++) {
        result.push({ id: nanoid(), round: consRound, boutIndex: i, bracket: bracketId })
      }
      consRound = Math.floor(consRound / 2)
    }
    if (consSize >= 4) {
      result.push({ id: nanoid(), round: 4, boutIndex: 2, bracket: bracketId })
    }
    R = R / 2
  }
}

export function buildBracket(size: TableauSize, seededFencerIds: string[], fencedPlaces: FencedPlaces | boolean = 'none'): TableauBout[] {
  let places: FencedPlaces
  if (typeof fencedPlaces === 'boolean') {
    places = fencedPlaces ? 'third_place' : 'none'
  } else {
    places = fencedPlaces
  }

  const bouts: TableauBout[] = []
  const seeding = FIE_SEEDING[size] ?? generateSeedingFor(size)

  // First round: place seeded fencers into slots
  const firstRoundSlots: (string | undefined)[] = Array(size).fill(undefined)
  seededFencerIds.forEach((fId, seedIdx) => {
    firstRoundSlots[seeding[seedIdx]] = fId
  })

  for (let i = 0; i < size / 2; i++) {
    bouts.push({
      id: nanoid(),
      round: size,
      boutIndex: i,
      fencerAId: firstRoundSlots[i * 2],
      fencerBId: firstRoundSlots[i * 2 + 1],
    })
  }

  // Create empty bouts for all subsequent rounds
  let round = size / 2
  while (round >= 2) {
    for (let i = 0; i < round / 2; i++) {
      bouts.push({ id: nanoid(), round, boutIndex: i })
    }
    round = round / 2
  }

  const result = propagateByes(bouts)

  // 3rd place bout: always at round=4 (same as semi-finals), boutIndex=2
  if (places !== 'none' && size >= 4) {
    result.push({ id: nanoid(), round: 4, boutIndex: 2 })
  }

  // ── Consolation brackets for all_places ──────────────────────────────────
  if (places === 'all_places') {
    buildConsolationBrackets(result, size)
  }

  return result
}

