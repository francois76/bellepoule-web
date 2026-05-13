import { nanoid } from 'nanoid'
import type { TableauBout, TableauSize } from '../types'

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

export function buildBracket(size: TableauSize, seededFencerIds: string[]): TableauBout[] {
  const bouts: TableauBout[] = []
  const seeding = FIE_SEEDING[size] ?? generateSeedingFor(size)

  // First round: place seeded fencers into slots
  // Each bout has 2 slots: slot index = boutIndex*2 and boutIndex*2+1
  const firstRoundSlots: (string | undefined)[] = Array(size).fill(undefined)
  seededFencerIds.forEach((fId, seedIdx) => {
    const slot = seeding[seedIdx]
    if (slot !== undefined) firstRoundSlots[slot] = fId
  })

  // Create bouts for first round (tableau de `size`)
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
    const count = round / 2
    for (let i = 0; i < count; i++) {
      bouts.push({
        id: nanoid(),
        round,
        boutIndex: i,
      })
    }
    round = round / 2
  }

  // Final round (round=2 means the final bout)
  // Already included above when round=2, count=1

  return bouts
}
