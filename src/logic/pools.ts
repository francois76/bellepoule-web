import { nanoid } from 'nanoid'
import type { Fencer, Pool, PoolBout } from '../types'

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
  8: [[1,5],[2,6],[3,7],[4,8],[5,3],[6,4],[7,1],[8,2],[1,3],[5,8],[7,6],[2,4],[3,8],[6,1],[5,4],[7,2],[3,6],[8,1],[4,5],[2,7],[8,6],[3,1],[7,5],[4,2],[6,3],[1,4],[2,5],[8,7]],
}

/**
 * Distribute fencers into pools (snake seeding to balance levels)
 */
export function allocatePools(fencers: Fencer[], poolCount: number): Pool[] {
  const sorted = [...fencers].sort((a, b) => (a.initialRank ?? 9999) - (b.initialRank ?? 9999))

  const pools: Pool[] = Array.from({ length: poolCount }, (_, i) => ({
    id: nanoid(),
    number: i + 1,
    fencerIds: [],
    bouts: [],
  }))

  // Snake distribution: 0→N-1 then N-1→0, alternating
  let dir = 1
  let col = 0
  for (const fencer of sorted) {
    pools[col].fencerIds.push(fencer.id)
    col += dir
    if (col >= poolCount) { col = poolCount - 1; dir = -1 }
    else if (col < 0) { col = 0; dir = 1 }
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
