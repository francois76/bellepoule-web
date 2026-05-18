import { nanoid } from 'nanoid'
import type { Pool, PoolBout } from '../types'

// FIE standard bout order for pools up to 9 fencers
// Each pair is [1-indexed positions in pool]
const FIE_ORDER: Record<number, [number, number][]> = {
  2: [[1,2]],
  3: [[2,3],[1,3],[1,2]],
  4: [[1,4],[2,3],[1,3],[2,4],[3,4],[1,2]],
  5: [[1,2],[3,4],[5,1],[2,3],[5,4],[1,3],[2,5],[4,1],[3,5],[4,2]],
  6: [[1,2],[4,3],[6,5],[3,1],[2,6],[5,4],[1,6],[3,5],[4,2],[5,1],[6,4],[2,3],[1,4],[5,2],[3,6]],
  7: [[1,4],[2,5],[3,6],[7,1],[5,4],[2,3],[6,7],[5,1],[4,3],[6,2],[5,7],[3,1],[4,6],[7,2],[3,5],[1,6],[2,4],[7,3],[6,5],[1,2],[4,7]],
  // 8 fencers — ordre officiel FIE (28 matchs)
  8: [[2,3],[1,5],[7,4],[6,8],[1,2],[3,4],[5,6],[8,7],[4,1],[5,2],[8,3],[6,7],[4,2],[8,1],[7,5],[3,6],[2,8],[5,4],[6,1],[3,7],[4,8],[2,6],[3,5],[1,7],[4,6],[8,5],[7,2],[1,3]],
  // 9 fencers — ordre officiel FIE (36 matchs)
  9: [[1,9],[2,8],[3,7],[4,6],[1,5],[2,9],[8,3],[7,4],[6,5],[1,2],[9,3],[8,4],[7,2],[6,1],[3,2],[9,4],[5,8],[7,6],[3,1],[2,4],[5,9],[8,6],[7,1],[4,3],[5,2],[6,9],[8,7],[4,1],[5,3],[6,2],[9,7],[1,8],[4,5],[3,6],[5,7],[9,8]],
}

/**
 * Calcule le nombre de poules optimal pour obtenir des poules d'une taille cible.
 *
 * La taille demandée est la taille minimale souhaitée. Le résultat peut produire
 * des poules de taille `minPoolSize` ou `minPoolSize + 1` selon le nombre de participants.
 *
 * Exemples :
 *   poolCountFromSize(22, 6) → 3  (poules de 7, 7, 8 ou 7, 7, 8 selon algo)
 *   poolCountFromSize(21, 7) → 3  (3 poules de 7)
 *   poolCountFromSize(22, 7) → 3  (2 poules de 7 + 1 de 8)
 */
export function poolCountFromSize(participantCount: number, minPoolSize: number): number {
  if (participantCount <= 0 || minPoolSize <= 0) return 1
  // Number of pools = ceil(n / (minPoolSize + 1)) ensures all pools ≤ minPoolSize + 1
  // and ≥ minPoolSize (as long as n ≥ minPoolSize).
  // We want floor(n / minPoolSize) pools max, ceil to avoid pools > minPoolSize+1.
  const count = Math.ceil(participantCount / (minPoolSize + 1))
  return Math.max(1, count)
}

/**
 * Retourne une description lisible de la taille des poules pour un effectif donné.
 * Ex: "3 poules de 7 ou 8 tireurs"
 */
export function poolSizeDescription(participantCount: number, poolCount: number): string {
  if (poolCount <= 0) return ''
  const base = Math.floor(participantCount / poolCount)
  const extra = participantCount % poolCount
  if (extra === 0) {
    return `${poolCount} poule${poolCount > 1 ? 's' : ''} de ${base} ${base > 1 ? 'tireurs' : 'tireur'}`
  }
  return `${poolCount} poule${poolCount > 1 ? 's' : ''} de ${base} ou ${base + 1} tireurs`
}

/**
 * Distribute participants (fencers or teams) into pools.
 * seedOrder: optional array of participant IDs in rank order (e.g. from a previous pool round).
 * seedingBalanced:
 *   true  (default) — snake distribution: best players spread across all pools (FIE standard T1).
 *   false           — grouped/by-strength: ranks 1..N → pool 1, N+1..2N → pool 2, etc.
 *                     (BellePoule "par force" / "RepartitionEquilibre=false").
 */
export function allocatePools(
  participants: { id: string, initialRank?: number }[],
  poolCount: number,
  seedOrder?: string[],
  seedingBalanced = true,
): Pool[] {
  let sorted: { id: string, initialRank?: number }[]
  if (seedOrder && seedOrder.length > 0) {
    const rankMap = new Map(seedOrder.map((id, i) => [id, i]))
    sorted = [...participants].sort((a, b) => (rankMap.get(a.id) ?? 9999) - (rankMap.get(b.id) ?? 9999))
  } else {
    sorted = [...participants].sort((a, b) => (a.initialRank ?? 9999) - (b.initialRank ?? 9999))
  }

  const pools: Pool[] = Array.from({ length: poolCount }, (_, i) => ({
    id: nanoid(),
    number: i + 1,
    fencerIds: [],
    bouts: [],
  }))

  if (seedingBalanced) {
    // Snake distribution: 0→N-1 then N-1→0, alternating (levels balanced across pools)
    let dir = 1
    let col = 0
    for (const fencer of sorted) {
      pools[col].fencerIds.push(fencer.id)
      col += dir
      if (col >= poolCount) { col = poolCount - 1; dir = -1 }
      else if (col < 0) { col = 0; dir = 1 }
    }
  } else {
    // Grouped/by-strength: fill pool 1 first, then pool 2, etc.
    // Compute base size and how many pools get an extra fencer
    const baseSize = Math.floor(sorted.length / poolCount)
    const extra = sorted.length % poolCount
    let idx = 0
    for (let p = 0; p < poolCount; p++) {
      const size = baseSize + (p < extra ? 1 : 0)
      for (let i = 0; i < size; i++) {
        pools[p].fencerIds.push(sorted[idx++].id)
      }
    }
  }

  // Generate bouts for each pool using FIE order (or fallback)
  return pools.map(pool => ({
    ...pool,
    bouts: fieBoutOrder(pool.fencerIds),
  }))
}

/**
 * Generate FIE-ordered bouts for a pool of n fencers
 */
export function fieBoutOrder(fencerIds: string[]): PoolBout[] {
  const n = fencerIds.length
  const order = FIE_ORDER[n]

  if (order) {
    return order.map(([a, b], idx) => ({
      id: nanoid(),
      fencerAId: fencerIds[a - 1],
      fencerBId: fencerIds[b - 1],
      order: idx + 1,
    }))
  }

  // Fallback: round-robin for large pools (>7)
  const bouts: PoolBout[] = []
  let order_idx = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      bouts.push({
        id: nanoid(),
        fencerAId: fencerIds[i],
        fencerBId: fencerIds[j],
        order: ++order_idx,
      })
    }
  }
  return bouts
}

// ─── Separation criteria (greedy swap) ──────────────────────────────────────

type ParticipantInfo = { id: string; club?: string; country?: string; league?: string }

/**
 * Count conflicts in a set of pools for the given criteria.
 * A conflict occurs when two fencers in the same pool share the same
 * non-empty value for any criterion (club, country, or league).
 */
function countConflicts(pools: Pool[], info: Map<string, ParticipantInfo>, criteria: Array<'club' | 'country' | 'league'>): number {
  let count = 0
  for (const pool of pools) {
    for (const crit of criteria) {
      const values: string[] = []
      for (const id of pool.fencerIds) {
        const v = info.get(id)?.[crit]
        if (v) values.push(v)
      }
      // Count duplicate values (each pair is one conflict)
      const freq = new Map<string, number>()
      for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
      for (const cnt of freq.values()) if (cnt > 1) count += cnt - 1
    }
  }
  return count
}

/**
 * Apply separation criteria to an existing pool allocation using a greedy swap algorithm.
 * Tries to minimise the number of fencers from the same club/country/league in the same pool.
 *
 * participants must contain ALL participants (even those not in pools) — used for metadata lookup.
 */
export function applySeparationCriteria(
  pools: Pool[],
  participants: ParticipantInfo[],
  criteria: Array<'club' | 'country' | 'league'>,
): Pool[] {
  if (!criteria.length || pools.length <= 1) return pools

  const info = new Map<string, ParticipantInfo>(participants.map(p => [p.id, p]))
  // Deep-copy pool fencer lists (bouts regenerated at end)
  const result = pools.map(p => ({ ...p, fencerIds: [...p.fencerIds] }))

  let improved = true
  const MAX_ITER = 500
  let iter = 0
  let best = countConflicts(result, info, criteria)

  while (improved && iter < MAX_ITER && best > 0) {
    improved = false
    iter++
    outer:
    for (let pi = 0; pi < result.length; pi++) {
      for (let pj = pi + 1; pj < result.length; pj++) {
        for (let ai = 0; ai < result[pi].fencerIds.length; ai++) {
          for (let bj = 0; bj < result[pj].fencerIds.length; bj++) {
            // Try swapping result[pi].fencerIds[ai] with result[pj].fencerIds[bj]
            const tmp = result[pi].fencerIds[ai]
            result[pi].fencerIds[ai] = result[pj].fencerIds[bj]
            result[pj].fencerIds[bj] = tmp

            const newConflicts = countConflicts(result, info, criteria)
            if (newConflicts < best) {
              best = newConflicts
              improved = true
              if (best === 0) break outer
            } else {
              // Revert
              result[pj].fencerIds[bj] = result[pi].fencerIds[ai]
              result[pi].fencerIds[ai] = tmp
            }
          }
        }
      }
    }
  }

  // Regenerate bouts with the new assignment
  return result.map(pool => ({ ...pool, bouts: fieBoutOrder(pool.fencerIds) }))
}
