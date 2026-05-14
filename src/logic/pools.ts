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
