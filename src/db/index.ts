import { openDB, type IDBPDatabase } from 'idb'
import type { Tournament } from '../types'

const DB_NAME = 'bellepoule'
const DB_VERSION = 1
const STORE_TOURNAMENTS = 'tournaments'

let _db: IDBPDatabase | null = null

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_TOURNAMENTS)) {
        db.createObjectStore(STORE_TOURNAMENTS, { keyPath: 'id' })
      }
    },
  })
  return _db
}

export async function getAllTournaments(): Promise<Tournament[]> {
  const db = await getDb()
  return db.getAll(STORE_TOURNAMENTS)
}

export async function getTournament(id: string): Promise<Tournament | undefined> {
  const db = await getDb()
  return db.get(STORE_TOURNAMENTS, id)
}

export async function saveTournament(tournament: Tournament): Promise<void> {
  const db = await getDb()
  await db.put(STORE_TOURNAMENTS, tournament)
}

export async function deleteTournament(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_TOURNAMENTS, id)
}
