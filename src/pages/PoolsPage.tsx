import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ContestBreadcrumb } from '../components/ContestBreadcrumb'
import { BackArrow } from '../components/BackArrow'
import { useStore } from '../store'
import type { PoolPhase, PoolBout, Pool, Referee, FencerPoolStatus, Fencer, Team } from '../types'
import { DEFAULT_DISPLAY_CONFIG } from '../types'
import { poolCountFromSize, poolSizeDescription } from '../logic/pools'

type LiveStat = { v: number; m: number; td: number; tr: number; allFilled: boolean }
type SwapCrit = 'club' | 'country' | 'league'

function compareLiveStat(x: string, y: string, stats: Record<string, LiveStat>): number {
  const sx = stats[x], sy = stats[y]
  const rx = sx.m > 0 ? Math.floor(sx.v * 1000 / sx.m) : 0
  const ry = sy.m > 0 ? Math.floor(sy.v * 1000 / sy.m) : 0
  if (ry !== rx) return ry - rx
  const ix = sx.td - sx.tr, iy = sy.td - sy.tr
  if (iy !== ix) return iy - ix
  return sy.td - sx.td
}

function applyBoutToStats(bout: PoolBout, a: LiveStat, b: LiveStat, maxScore: number): boolean {
  if (bout.resultA === undefined) return false
  if (bout.resultA === 'A') {
    a.m++; b.m++
    b.v++; b.td += maxScore; a.tr += maxScore
  } else if (bout.resultB === 'A') {
    a.m++; b.m++
    a.v++; a.td += maxScore; b.tr += maxScore
  } else {
    a.m++; b.m++
    a.td += bout.scoreA ?? 0; a.tr += bout.scoreB ?? 0
    b.td += bout.scoreB ?? 0; b.tr += bout.scoreA ?? 0
    if (bout.resultA === 'V') a.v++
    if (bout.resultB === 'V') b.v++
  }
  return true
}

function computePoolLiveStats(pool: Pool, maxScore: number) {
  const stats: Record<string, LiveStat> = {}
  for (const fId of pool.fencerIds) {
    stats[fId] = { v: 0, m: 0, td: 0, tr: 0, allFilled: true }
  }
  for (const bout of pool.bouts) {
    const a = stats[bout.fencerAId]
    const b = stats[bout.fencerBId]
    if (!a || !b) continue
    const filled = applyBoutToStats(bout, a, b, maxScore)
    if (!filled) { a.allFilled = false; b.allFilled = false }
  }
  const filled = pool.fencerIds.filter(fId => stats[fId]?.allFilled)
  const sorted = [...filled].sort((x, y) => compareLiveStat(x, y, stats))
  const rankMap: Record<string, number> = {}
  sorted.forEach((fId, i) => { rankMap[fId] = i + 1 })
  return { stats, rankMap }
}

type ParticipantInfo = { name: string; club?: string; birthDate?: string; licenceNumber?: string }

function buildParticipantMap(contest: import('../types').Contest): Record<string, ParticipantInfo> {
  if (contest.isTeamEvent) {
    return Object.fromEntries(contest.teams.map(t => [t.id, { name: t.name, club: t.club }]))
  }
  return Object.fromEntries(contest.fencers.map(f => [f.id, {
    name: `${f.lastName.toUpperCase()} ${f.firstName}`,
    club: f.club, birthDate: f.birthDate, licenceNumber: f.licenceNumber,
  }]))
}

function getEligibleLatecomers(contest: import('../types').Contest, allocatedIds: Set<string>) {
  if (contest.isTeamEvent) return contest.teams.filter(t => !allocatedIds.has(t.id))
  return contest.fencers.filter(f => !allocatedIds.has(f.id))
}

function validateBoutScore(scoreA: string, scoreB: string, maxScore: number): { sa: number; sb: number } | null {
  const sa = parseInt(scoreA)
  const sb = parseInt(scoreB)
  if (isNaN(sa) || isNaN(sb)) return null
  if (sa > maxScore || sb > maxScore) return null
  if (sa === sb) return null
  return { sa, sb }
}

function onEscapeKey(handler: () => void) {
  return (e: React.KeyboardEvent) => { if (e.key === 'Escape') handler() }
}

interface LatecomerModalProps {
  readonly eligibleLatecomers: (Fencer | Team)[]
  readonly latecomerFencerId: string
  readonly setLatecomerFencerId: (v: string) => void
  readonly onAdd: () => Promise<void>
  readonly onClose: () => void
}
function LatecomerModal({ eligibleLatecomers, latecomerFencerId, setLatecomerFencerId, onAdd, onClose }: LatecomerModalProps) {
  return (
    <div className="print:hidden fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">🕐 Ajouter un retardataire</h2>
        <p className="text-sm text-gray-500">
          Le retardataire sera ajouté à la <strong>plus petite poule</strong>.
          Les assauts déjà joués sans lui seront marqués comme <em>absences</em> (ses adversaires passés reçoivent victoire + score max).
        </p>
        <div>
          <label className="label" htmlFor="latecomer-fencer-select">Tireur retardataire</label>
          <select id="latecomer-fencer-select" className="input" value={latecomerFencerId} onChange={e => setLatecomerFencerId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {eligibleLatecomers.map(p => (
              <option key={p.id} value={p.id}>
                {'lastName' in p ? `${p.lastName.toUpperCase()} ${p.firstName}` : p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
          <button type="button" className="btn-primary flex-1" disabled={!latecomerFencerId} onClick={onAdd}>Ajouter</button>
        </div>
      </div>
    </div>
  )
}

interface AllocateModalProps {
  readonly presentCount: number
  readonly participantLabel: string
  readonly isTeamEvent: boolean
  readonly poolCountInput: string
  readonly setPoolCountInput: (v: string) => void
  readonly poolSizeInput: string
  readonly setPoolSizeInput: (v: string) => void
  readonly seedingBalanced: boolean
  readonly setSeedingBalanced: (v: boolean) => void
  readonly swapCriteria: SwapCrit[]
  readonly setSwapCriteria: React.Dispatch<React.SetStateAction<SwapCrit[]>>
  readonly onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void
  readonly onClose: () => void
}
function AllocateModal({ presentCount, participantLabel, isTeamEvent, poolCountInput, setPoolCountInput, poolSizeInput, setPoolSizeInput, seedingBalanced, setSeedingBalanced, swapCriteria, setSwapCriteria, onSubmit, onClose }: AllocateModalProps) {
  function toggleSwapCrit(crit: SwapCrit, checked: boolean) {
    setSwapCriteria(prev => checked ? [...prev, crit] : prev.filter(c => c !== crit))
  }
  return (
    <div className="print:hidden fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">Allouer les poules</h2>
        <p className="text-sm text-gray-500">{presentCount} {participantLabel} présent{isTeamEvent ? 'es' : 's'}</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pool-count-input">Nombre de poules</label>
              <input id="pool-count-input" className="input" type="number" min={1} max={presentCount}
                value={poolCountInput}
                onChange={e => {
                  setPoolCountInput(e.target.value)
                  const cnt = parseInt(e.target.value)
                  if (cnt > 0) setPoolSizeInput(String(Math.round(presentCount / cnt)))
                }}
                required />
            </div>
            <div>
              <label className="label" htmlFor="pool-size-input">Taille cible</label>
              <input id="pool-size-input" className="input" type="number" min={1} max={presentCount}
                value={poolSizeInput}
                onChange={e => {
                  setPoolSizeInput(e.target.value)
                  const sz = parseInt(e.target.value)
                  if (sz > 0) setPoolCountInput(String(poolCountFromSize(presentCount, sz)))
                }} />
            </div>
          </div>
          {poolCountInput && parseInt(poolCountInput) > 0 && (
            <p className="text-xs text-blue-600 font-medium">
              → {poolSizeDescription(presentCount, parseInt(poolCountInput))}
            </p>
          )}
          <div>
            <p className="label">Répartition</p>
            <div className="flex gap-3 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="seeding" checked={seedingBalanced} onChange={() => setSeedingBalanced(true)} className="accent-blue-600" />
                <span className="text-sm text-gray-700">Équilibrée <span className="text-xs text-gray-400">(serpentin)</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="seeding" checked={!seedingBalanced} onChange={() => setSeedingBalanced(false)} className="accent-blue-600" />
                <span className="text-sm text-gray-700">Par force <span className="text-xs text-gray-400">(meilleurs ensemble)</span></span>
              </label>
            </div>
          </div>
          {!isTeamEvent && (
            <div>
              <p className="label">Séparation</p>
              <p className="text-xs text-gray-400 mb-1">Éviter deux tireurs du même dans la même poule</p>
              <div className="flex gap-3 flex-wrap mt-1">
                {(['club','country','league'] as const).map(crit => {
                  const labels = { club: 'Club', country: 'Nation', league: 'Ligue' }
                  return (
                    <label key={crit} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" className="accent-blue-600"
                        checked={swapCriteria.includes(crit)}
                        onChange={e => toggleSwapCrit(crit, e.target.checked)} />
                      <span className="text-sm text-gray-700">{labels[crit]}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary flex-1">Allouer</button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface PoolActionButtonsProps {
  readonly stage: PoolPhase
  readonly eligibleLatecomers: { id: string }[]
  readonly hasLaterStageStarted: boolean
  readonly onAllocate: () => void
  readonly onLock: () => void
  readonly onOpenLatecomer: () => void
  readonly onFillRandom: () => void
  readonly onUnlock: () => void
}
function PoolActionButtons({ stage, eligibleLatecomers, hasLaterStageStarted, onAllocate, onLock, onOpenLatecomer, onFillRandom, onUnlock }: PoolActionButtonsProps) {
  return (
    <div className="print:hidden flex gap-2 flex-wrap">
      {stage.status === 'pending' && (
        <button className="btn-primary" onClick={onAllocate}>⚙️ Allouer les poules</button>
      )}
      {stage.status === 'running' && (
        <button className="btn-primary bg-green-600 hover:bg-green-700" onClick={onLock}>
          ✅ Terminer le tour
        </button>
      )}
      {stage.status === 'running' && eligibleLatecomers.length > 0 && (
        <button className="btn-secondary" onClick={onOpenLatecomer}
          title="Ajouter un tireur arrivé en retard dans la plus petite poule">
          🕐 Retardataire
        </button>
      )}
      {stage.pools.length > 0 && stage.status === 'running' && import.meta.env.DEV && (
        <button className="btn-secondary border-orange-300 text-orange-700 hover:bg-orange-50" onClick={onFillRandom}>
          🎲 Scores aléatoires
        </button>
      )}
      {stage.pools.length > 0 && (
        <button className="btn-secondary" onClick={() => window.print()}>
          🖨️ Imprimer
        </button>
      )}
      {stage.status === 'done' && !hasLaterStageStarted && (
        <button className="btn-secondary" onClick={onUnlock}>
          🔓 Rouvrir pour correction
        </button>
      )}
    </div>
  )
}

function isLaterStageStarted(contest: import('../types').Contest, stageId: string): boolean {
  const stageIdx = contest.stages.findIndex(s => s.id === stageId)
  return contest.stages.slice(stageIdx + 1).some(s => s.status === 'running' || s.status === 'done')
}

function getPresentCount(contest: import('../types').Contest) {
  if (contest.isTeamEvent) return contest.teams.filter(t => t.present).length
  return contest.fencers.filter(f => f.present).length
}

function computeDefaultAllocation(contest: import('../types').Contest, stageId: string, presentCount: number) {
  const defaultCount = Math.ceil(presentCount / 6)
  const defaultSize = Math.round(presentCount / defaultCount)
  const stageIdx = contest.stages.findIndex(s => s.id === stageId)
  const hasPrevPool = contest.stages.slice(0, stageIdx).some(s => s.type === 'pool' && s.status === 'done')
  return { defaultCount, defaultSize, seedingBalanced: !hasPrevPool }
}

async function doSaveBout(
  scoreA: string, scoreB: string, maxScore: number,
  tournamentId: string, contestId: string, stageId: string, poolId: string, boutId: string,
  setPoolBoutScore: (tid: string, cid: string, sid: string, pid: string, bid: string, sa: number, sb: number) => Promise<void>,
  setEditingBout: (v: string | null) => void, setScoreA: (v: string) => void, setScoreB: (v: string) => void,
) {
  const scores = validateBoutScore(scoreA, scoreB, maxScore)
  if (!scores) return
  await setPoolBoutScore(tournamentId, contestId, stageId, poolId, boutId, scores.sa, scores.sb)
  setEditingBout(null)
  setScoreA('')
  setScoreB('')
}

export default function PoolsPage() {
  const { tournamentId = '', contestId = '', stageId = '' } = useParams<{ tournamentId: string; contestId: string; stageId: string }>()
  const { tournaments, loaded, allocatePoolPhase, setPoolBoutScore, setPoolBoutAbsent, lockPoolPhase, unlockPoolPhase, fillRandomPoolBouts, setPoolFencerStatus, addLatecomer } = useStore()
  const tournament = tournaments.find(t => t.id === tournamentId)
  const contest = tournament?.contests.find(c => c.id === contestId)
  const stage = contest?.stages.find(s => s.id === stageId) as PoolPhase | undefined

  const [selectedPool, setSelectedPool] = useState(0)
  const [editingBout, setEditingBout] = useState<string | null>(null)
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [allocateModal, setAllocateModal] = useState(false)
  const [poolCountInput, setPoolCountInput] = useState('')
  const [seedingBalanced, setSeedingBalanced] = useState(true)
  const [swapCriteria, setSwapCriteria] = useState<('club' | 'country' | 'league')[]>(['club'])
  const [poolSizeInput, setPoolSizeInput] = useState('6')
  const [latecomerModal, setLatecomerModal] = useState(false)
  const [latecomerFencerId, setLatecomerFencerId] = useState('')
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [statusMenuPos, setStatusMenuPos] = useState<{ top: number; right: number } | null>(null)

  if (!loaded) return <div className="p-4 text-gray-500">Chargement…</div>

  if (!tournament || !contest || !stage || stage.type !== 'pool') return <div className="text-red-500">Phase introuvable</div>

  // Unified participant map: for team events, maps team IDs to display info;
  // for individual events, maps fencer IDs to display info.
  const participantMap = buildParticipantMap(contest)

  const pool = stage.pools[selectedPool]

  const displayConfig = contest.displayConfig ?? DEFAULT_DISPLAY_CONFIG

  const presentCount = getPresentCount(contest)

  // Fencers already allocated in any pool of this stage
  const allocatedIds = new Set(stage.pools.flatMap(p => p.fencerIds))
  // Eligible latecomers: registered but not yet in any pool (regardless of present flag)
  const eligibleLatecomers = getEligibleLatecomers(contest, allocatedIds)

  function openAllocateModal() {
    if (!contest) return
    const { defaultCount, defaultSize, seedingBalanced: balanced } = computeDefaultAllocation(contest, stageId, presentCount)
    setPoolCountInput(String(defaultCount))
    setPoolSizeInput(String(defaultSize))
    setSeedingBalanced(balanced)
    setAllocateModal(true)
  }

  async function handleAddLatecomer() {
    await addLatecomer(tournamentId, contestId, stageId, latecomerFencerId)
    setLatecomerModal(false)
    setLatecomerFencerId('')
  }

  async function handleAllocate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const count = parseInt(poolCountInput)
    await allocatePoolPhase(tournamentId, contestId, stageId, count, seedingBalanced, swapCriteria)
    setAllocateModal(false)
  }

  async function saveBout(boutId: string) {
    if (!stage) return
    await doSaveBout(scoreA, scoreB, stage.maxScore, tournamentId, contestId, stageId, pool.id, boutId, setPoolBoutScore, setEditingBout, setScoreA, setScoreB)
  }

  async function quickSaveBout(boutId: string, sa: number, sb: number) {
    await setPoolBoutScore(tournamentId, contestId, stageId, pool.id, boutId, sa, sb)
    setEditingBout(null)
    setScoreA('')
    setScoreB('')
  }

  const participantName = (id: string) => participantMap[id]?.name ?? '?'

  const participantLabel = contest.isTeamEvent ? 'équipes' : 'tireurs'

  const hasLaterStageStarted = isLaterStageStarted(contest, stageId)

  const livePoolStats = pool && selectedPool >= 0
    ? computePoolLiveStats(pool, stage.maxScore)
    : null
  const liveStats = livePoolStats?.stats ?? {} as Record<string, LiveStat>
  const liveRank = livePoolStats?.rankMap ?? {} as Record<string, number>

  const closeStatusMenu = () => { setStatusMenuId(null); setStatusMenuPos(null) }
  return (
    <div className="space-y-5">
      {/* Status dropdown menu — fixed positioning to avoid clip */}
      {statusMenuId && statusMenuPos && (
        <>
          <div className="fixed inset-0 z-[9998]" role="button" tabIndex={-1} aria-label="Fermer" onClick={closeStatusMenu} onKeyDown={onEscapeKey(closeStatusMenu)} />
          <div className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-max"
            style={{ top: statusMenuPos.top, right: statusMenuPos.right }}>
            {([['ok','✓ Présent(e)','text-green-700'],['withdrawal','🚑 Forfait','text-orange-700'],['excluded','⛔ Exclu(e)','text-red-700']] as [FencerPoolStatus, string, string][]).map(([s,label,cls]) => (
              <button key={s} className={`block w-full text-left px-3 py-1.5 text-sm ${cls} hover:bg-gray-50`}
                onClick={() => { setPoolFencerStatus(tournamentId, contestId, stageId, statusMenuId, s, contest.autoScoreStuffing ?? true); closeStatusMenu() }}>
                {label}
              </button>
            ))}
            <div className="px-3 pt-1 pb-1.5 border-t border-gray-100 text-xs text-gray-400 max-w-xs">
              Le remplissage auto des assauts non joués dépend du paramètre « remplissage auto » de la compétition.
            </div>
          </div>
        </>
      )}
      {/* Breadcrumb */}
      <div className="print:hidden flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <BackArrow />
        <Link to="/" className="hover:text-blue-600">Tournois</Link>
        <span>/</span>
        <Link to={`/tournament/${tournamentId}`} className="hover:text-blue-600">{tournament.name}</Link>
        <span>/</span>
        <ContestBreadcrumb tournament={tournament} contest={contest} tournamentId={tournamentId} />
        <span>/</span>
        <span className="text-gray-800 font-medium">{stage.name}</span>
      </div>

      <div className={`flex items-center justify-between flex-wrap gap-2${stage.status !== 'pending' ? ' print:hidden' : ''}`}>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{stage.name}</h1>
          <div className="flex gap-3 mt-1 text-xs text-gray-500">
            <span>Score max : <strong className="text-gray-700">{stage.maxScore}</strong></span>
            <span>Qualification : <strong className="text-gray-700">{stage.promotionPercent} %</strong></span>
            {stage.pools.length > 0 && <span>{stage.pools.length} poule{stage.pools.length > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <PoolActionButtons
          stage={stage}
          eligibleLatecomers={eligibleLatecomers}
          hasLaterStageStarted={hasLaterStageStarted}
          onAllocate={openAllocateModal}
          onLock={() => lockPoolPhase(tournamentId, contestId, stageId)}
          onOpenLatecomer={() => { setLatecomerFencerId(''); setLatecomerModal(true) }}
          onFillRandom={() => fillRandomPoolBouts(tournamentId, contestId, stageId)}
          onUnlock={() => unlockPoolPhase(tournamentId, contestId, stageId)}
        />
      </div>

      {/* Modal — Retardataire */}
      {latecomerModal && (
        <LatecomerModal
          eligibleLatecomers={eligibleLatecomers}
          latecomerFencerId={latecomerFencerId}
          setLatecomerFencerId={setLatecomerFencerId}
          onAdd={handleAddLatecomer}
          onClose={() => setLatecomerModal(false)}
        />
      )}

      {/* Modal — Allocation des poules */}
      {allocateModal && (
        <AllocateModal
          presentCount={presentCount}
          participantLabel={participantLabel}
          isTeamEvent={contest.isTeamEvent}
          poolCountInput={poolCountInput}
          setPoolCountInput={setPoolCountInput}
          poolSizeInput={poolSizeInput}
          setPoolSizeInput={setPoolSizeInput}
          seedingBalanced={seedingBalanced}
          setSeedingBalanced={setSeedingBalanced}
          swapCriteria={swapCriteria}
          setSwapCriteria={setSwapCriteria}
          onSubmit={handleAllocate}
          onClose={() => setAllocateModal(false)}
        />
      )}

      {stage.pools.length === 0 ? (
        <div className="print:hidden text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🤺</p>
          <p>Cliquez sur "Allouer les poules" pour distribuer les {participantLabel}</p>
        </div>
      ) : (
        <>
          {/* Pool selector tabs - screen only */}
          <div className="print:hidden flex gap-2 flex-wrap">
            {stage.status === 'done' && stage.results.length > 0 && (
              <button
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedPool === -1 ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                onClick={() => setSelectedPool(-1)}>
                📊 Classement
              </button>
            )}
            {stage.pools.map((p, idx) => {
              const POOL_SUITS = ['♦','♣','♥','♠']
              const suit = POOL_SUITS[(p.number - 1) % 4]
              return (
                <button key={p.id}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${idx === selectedPool ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}
                  onClick={() => setSelectedPool(idx)}>
                  {suit} Poule {p.number}
                </button>
              )
            })}
          </div>

          {/* Bout scoring - screen only */}
          {selectedPool === -1 ? (
            <div className="print:hidden card flex flex-col">
              <h2 className="font-semibold text-gray-700 mb-3">Classement de la phase</h2>
              <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Rang</th>
                    <th className="px-3 py-2 text-left">Tireur</th>
                    <th className="px-3 py-2 text-center">V</th>
                    <th className="px-3 py-2 text-center">M</th>
                    <th className="px-3 py-2 text-center">TD</th>
                    <th className="px-3 py-2 text-center">TR</th>
                    <th className="px-3 py-2 text-center">Ind.</th>
                    <th className="px-3 py-2 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.results.map(r => (
                    <tr key={r.fencerId} className={`border-t border-gray-100 ${r.status === 'qualified' ? '' : 'opacity-60'}`}>
                      <td className="px-3 py-2 font-bold text-gray-700">{r.rank}</td>
                      <td className="px-3 py-2">{participantName(r.fencerId)}</td>
                      <td className="px-3 py-2 text-center">{r.victories}</td>
                      <td className="px-3 py-2 text-center">{r.bouts}</td>
                      <td className="px-3 py-2 text-center">{r.touchesScored}</td>
                      <td className="px-3 py-2 text-center">{r.touchesReceived}</td>
                      <td className="px-3 py-2 text-center font-medium">{r.index > 0 ? `+${r.index}` : r.index}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'qualified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status === 'qualified' ? 'Qualifié' : 'Éliminé'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : pool && (
            <div className="print:hidden grid gap-5 lg:grid-cols-2">
              {/* Pool composition */}
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">{['♦','♣','♥','♠'][(pool.number - 1) % 4]} Poule {pool.number} — {contest.isTeamEvent ? 'Équipes' : 'Tireurs'}</h2>
                <ol className="space-y-1">
                  {pool.fencerIds.map((fId, idx) => {
                    const fencerStatus: FencerPoolStatus = (stage.fencerStatuses?.[fId] ?? 'ok') as FencerPoolStatus
                    let statusIcon = '✓'
                    let statusColor = 'text-green-600'
                    let statusLabel = 'Présent(e)'
                    if (fencerStatus === 'withdrawal') {
                      statusIcon = '🚑'; statusColor = 'text-orange-600'; statusLabel = 'Forfait'
                    } else if (fencerStatus === 'excluded') {
                      statusIcon = '⛔'; statusColor = 'text-red-600'; statusLabel = 'Exclu(e)'
                    }
                    return (
                      <li key={fId} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                        <span className={`text-gray-800 ${fencerStatus !== 'ok' ? 'line-through text-gray-400' : ''}`}>{participantName(fId)}</span>
                        {participantMap[fId]?.club && <span className="text-gray-400 text-xs">({participantMap[fId].club})</span>}
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          {liveStats[fId]?.allFilled && (
                            <span
                              className="text-xs font-mono text-gray-400"
                              title={`V:${liveStats[fId].v}  M:${liveStats[fId].m}  TD:${liveStats[fId].td}  TR:${liveStats[fId].tr}  ID:${liveStats[fId].td - liveStats[fId].tr >= 0 ? '+' : ''}${liveStats[fId].td - liveStats[fId].tr}  RG:${liveRank[fId] ?? '?'}`}
                            >
                              {liveStats[fId].v}/{liveStats[fId].m} {liveStats[fId].td}/{liveStats[fId].tr} {liveStats[fId].td - liveStats[fId].tr >= 0 ? '+' : ''}{liveStats[fId].td - liveStats[fId].tr} #{liveRank[fId] ?? '?'}
                            </span>
                          )}
                          {/* Status badge + dropdown */}
                          {stage.status !== 'done' && (
                            <div className="relative">
                              <button
                                className={`text-xs font-medium ${statusColor} border border-current rounded px-1.5 py-0.5 hover:opacity-80`}
                                title={statusLabel}
                                onClick={e => {
                                  if (statusMenuId === fId) { setStatusMenuId(null); setStatusMenuPos(null); return }
                                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                                  setStatusMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                  setStatusMenuId(fId)
                                }}
                              >{statusIcon} {statusLabel}</button>
                            </div>
                          )}
                          {stage.status === 'done' && fencerStatus !== 'ok' && (
                            <span className={`text-xs font-medium ${statusColor}`}>{statusIcon}</span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>

              {/* Bouts */}
              <div className="card flex flex-col">
                <h2 className="font-semibold text-gray-700 mb-3">Matchs</h2>
                <div className="space-y-2 overflow-y-auto flex-1" style={{ maxHeight: '60vh' }}>
                  {pool.bouts.map(bout => (
                    <BoutRow key={bout.id}
                      bout={bout}
                      nameA={participantName(bout.fencerAId)}
                      nameB={participantName(bout.fencerBId)}
                      maxScore={stage.maxScore}
                      isEditing={editingBout === bout.id}
                      scoreAInput={scoreA}
                      scoreBInput={scoreB}
                      onScoreAChange={setScoreA}
                      onScoreBChange={setScoreB}
                      onEdit={() => { setEditingBout(bout.id); setScoreA(String(bout.scoreA ?? '')); setScoreB(String(bout.scoreB ?? '')) }}
                      onSave={() => saveBout(bout.id)}
                      onCancel={() => setEditingBout(null)}
                      onAbsent={(side) => setPoolBoutAbsent(tournamentId, contestId, stageId, pool.id, bout.id, side)}
                      onQuickScore={(sa, sb) => quickSaveBout(bout.id, sa, sb)}
                      disabled={stage.status === 'done'}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Results table — print only (screen version is in the Classement tab) */}
      {stage.status === 'done' && stage.results.length > 0 && (
        <div className="hidden print:block">
          {/* Print-only recap header before the classification */}
          <div className="hidden print:block mb-3">
            <h2 className="text-base font-bold text-gray-800">{stage.name}</h2>
            <p className="text-xs text-gray-600">
              {[WEAPON_LABEL[contest.weapon] ?? contest.weapon,
                GENDER_LABEL[contest.gender] ?? contest.gender,
                contest.category].filter(Boolean).join(' · ')}
            </p>
            <p className="text-xs text-gray-500">
              {[(() => {
                if (contest.date) return new Date(contest.date).toLocaleDateString('fr-FR')
                if (tournament.startDate) return new Date(tournament.startDate).toLocaleDateString('fr-FR')
                return ''
              })(),
                contest.location ?? tournament.location ?? ''].filter(Boolean).join(' — ')}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Score max&nbsp;: {stage.maxScore} · Qualification&nbsp;: {stage.promotionPercent}&nbsp;% · {stage.pools.length} poule{stage.pools.length > 1 ? 's' : ''}
            </p>
          </div>
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-gray-700 mb-3">Classement de la phase</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Rang</th>
                <th className="px-3 py-2 text-left">Tireur</th>
                <th className="px-3 py-2 text-center">V</th>
                <th className="px-3 py-2 text-center">M</th>
                <th className="px-3 py-2 text-center">TD</th>
                <th className="px-3 py-2 text-center">TR</th>
                <th className="px-3 py-2 text-center">Ind.</th>
                <th className="px-3 py-2 text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {stage.results.map(r => (
                <tr key={r.fencerId} className={`border-t border-gray-100 ${r.status === 'qualified' ? '' : 'opacity-60'}`}>
                  <td className="px-3 py-2 font-bold text-gray-700">{r.rank}</td>
                  <td className="px-3 py-2">{participantName(r.fencerId)}</td>
                  <td className="px-3 py-2 text-center">{r.victories}</td>
                  <td className="px-3 py-2 text-center">{r.bouts}</td>
                  <td className="px-3 py-2 text-center">{r.touchesScored}</td>
                  <td className="px-3 py-2 text-center">{r.touchesReceived}</td>
                  <td className="px-3 py-2 text-center font-medium">{r.index > 0 ? `+${r.index}` : r.index}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'qualified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.status === 'qualified' ? 'Qualifié' : 'Éliminé'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Pool score sheets — print only */}
      {stage.pools.length > 0 && (
        <div className="pool-sheets-wrapper hidden print:block">
          {stage.pools.map(p => (
            <PoolScoreSheet
              key={p.id}
              pool={p}
              stage={stage}
              participantMap={participantMap}
              contest={contest}
              tournament={tournament}
              referees={contest.referees}
              displayConfig={displayConfig}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const WEAPON_LABEL: Record<string, string> = { epee: 'Épée', foil: 'Fleuret', sabre: 'Sabre' }
const GENDER_LABEL: Record<string, string> = { men: 'Messieurs', women: 'Dames', mixed: 'Mixte' }

function PoolScoreSheet({ pool, stage, participantMap, contest, tournament, referees, displayConfig }: Readonly<{
  pool: Pool
  stage: PoolPhase
  participantMap: Record<string, { name: string; club?: string; birthDate?: string; licenceNumber?: string }>
  contest: import('../types').Contest
  tournament: import('../types').Tournament
  referees: Referee[]
  displayConfig: import('../types').DisplayConfig
}>) {
  const referee = pool.refereeId ? referees.find(r => r.id === pool.refereeId) : undefined
  const refName = referee ? `${referee.lastName.toUpperCase()} ${referee.firstName}` : ''

  const weaponLabel = WEAPON_LABEL[contest.weapon] ?? contest.weapon
  const genderLabel = GENDER_LABEL[contest.gender] ?? contest.gender
  const categoryLabel = contest.category ? ` ${contest.category}` : ''
  const fullLabel = `${weaponLabel} ${genderLabel}${categoryLabel}`

  let dateLabel = ''
  if (contest.date) {
    dateLabel = new Date(contest.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } else if (tournament.startDate) {
    dateLabel = new Date(tournament.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const locationLabel = contest.location ?? tournament.location ?? ''

  const fencers = pool.fencerIds.map((id, idx) => {
    const p = participantMap[id]
    const infos: string[] = []
    if (displayConfig.club.onPool && p?.club) infos.push(p.club)
    if (displayConfig.licence.onPool && p?.licenceNumber) infos.push(p.licenceNumber)
    if (displayConfig.dateOfBirth.onPool && p?.birthDate) {
      const year = p.birthDate.split('-')[0]
      infos.push(year)
    }
    return {
      id,
      num: idx + 1,
      name: p?.name ?? '?',
      info: infos.join(' · '),
    }
  })


  // ── Poule fermée : grille de résultats complète ──────────────
  if (stage.status === 'done') {
    const resultsMap = Object.fromEntries(
      stage.results
        .filter(r => pool.fencerIds.includes(r.fencerId))
        .map(r => [r.fencerId, r])
    )

    function getCellContent(rowId: string, colId: string): string {
      const bout = pool.bouts.find(b =>
        (b.fencerAId === rowId && b.fencerBId === colId) ||
        (b.fencerBId === rowId && b.fencerAId === colId)
      )
      if (!bout || bout.scoreA === undefined) return ''
      if (bout.fencerAId === rowId) {
        return `${bout.resultA === 'V' ? 'V' : 'D'}${bout.scoreA}`
      }
      return `${bout.resultB === 'V' ? 'V' : 'D'}${bout.scoreB}`
    }

    return (
      <div className="pool-sheet">
        <div className="pool-sheet-header">
          <div className="pool-sheet-title">
            <h3>Poule {pool.number} — {stage.name}</h3>
            <p className="pool-sheet-competition">{contest.name} · {fullLabel}</p>
            {(dateLabel || locationLabel) && (
              <p className="pool-sheet-meta">{[dateLabel, locationLabel].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="pool-sheet-meta-right">
            {pool.piste && <span>Piste {pool.piste}</span>}
            <span className="pool-sheet-referee">Arbitre : <span className="pool-sheet-referee-name">{refName || '________________________'}</span></span>
          </div>
        </div>
        <div className="pool-grid-scroll">
          <table className="pool-grid">
            <thead>
              <tr>
                <th>N°</th>
                <th className="pg-name">Nom</th>
                {fencers.map(f => <th key={f.id}>{f.num}</th>)}
                <th>V</th>
                <th>M</th>
                <th>TD</th>
                <th>TR</th>
                <th>Ind.</th>
                <th>Rang</th>
              </tr>
            </thead>
            <tbody>
              {fencers.map((rowF, rowIdx) => {
                const result = resultsMap[rowF.id]
                return (
                  <tr key={rowF.id}>
                    <td>{rowF.num}</td>
                    <td className="pg-name" style={{ textAlign: 'left' }}>
                      {rowF.name}{rowF.info ? ` (${rowF.info})` : ''}
                    </td>
                    {fencers.map((colF, colIdx) => (
                      rowIdx === colIdx
                        ? <td key={colF.id} className="pg-x">&nbsp;</td>
                        : <td key={colF.id}>{getCellContent(rowF.id, colF.id)}</td>
                    ))}
                    <td>{result?.victories ?? ''}</td>
                    <td>{result?.bouts ?? ''}</td>
                    <td>{result?.touchesScored ?? ''}</td>
                    <td>{result?.touchesReceived ?? ''}</td>
                    <td>{(() => {
                      if (!result) return ''
                      if (result.index >= 0) return `+${result.index}`
                      return String(result.index)
                    })()}</td>
                    <td>{result?.rank ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Poule ouverte : format liste (à remplir à la main) ───────
  // Pour les grosses poules (>24 matchs), on force un saut de page avant la liste
  // afin que le header du <thead> apparaisse en haut d'une nouvelle page et non
  // en plein milieu de la page 1 (où header+grille se trouvent déjà).
  const needsPageBreak = pool.bouts.length > 24

  return (
    <div className="pool-sheet">
      {/* En-tête */}
      <div className="pool-sheet-header">
        <div className="pool-sheet-title">
          <h3>Poule {pool.number} — {stage.name}</h3>
          <p className="pool-sheet-competition">{contest.name} · {fullLabel}</p>
          {(dateLabel || locationLabel) && (
            <p className="pool-sheet-meta">{[dateLabel, locationLabel].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="pool-sheet-meta-right">
          <span className="pool-sheet-referee">Piste : <span className="pool-sheet-referee-name">{pool.piste || '____'}</span></span>
        </div>
      </div>

      {/* Grille de report des scores avec colonne signature */}
      <div className="pool-grid-scroll">
        <table className="pool-grid pool-grid--open">
          <thead>
            <tr>
              <th>N°</th>
              <th className="pg-name">{contest.isTeamEvent ? 'Équipe' : 'Tireur'}</th>
              {fencers.map(f => <th key={f.id}>{f.num}</th>)}
              <th>V</th>
              <th>M</th>
              <th>TD</th>
              <th>TR</th>
              <th>Ind.</th>
              <th>Rang</th>
              <th className="pg-sig">Signature</th>
            </tr>
          </thead>
          <tbody>
            <tr className="pg-arb-row">
              <td colSpan={2} style={{ textAlign: 'left', fontWeight: 700 }}>
                Arbitre{refName ? <> — {refName}</> : ''}
              </td>
              <td colSpan={fencers.length + 6}></td>
              <td className="pg-sig"></td>
            </tr>
            {fencers.map((rowF, rowIdx) => (
              <tr key={rowF.id}>
                <td>{rowF.num}</td>
                <td className="pg-name" style={{ textAlign: 'left' }}>
                  {rowF.name}{rowF.info ? ` (${rowF.info})` : ''}
                </td>
                {fencers.map((colF, colIdx) => (
                  rowIdx === colIdx
                    ? <td key={colF.id} className="pg-x">&nbsp;</td>
                    : <td key={colF.id}>&nbsp;</td>
                ))}
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td className="pg-sig"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <table className={`pool-bout-list${needsPageBreak ? ' pool-bout-list--break' : ''}`} style={needsPageBreak ? {} : { marginTop: '8px' }}>
        <thead>
          {needsPageBreak && (
          <tr className="pbl-repeat-header">
            <td colSpan={4}>
              <div className="pool-sheet-title">
                <h3>Poule {pool.number} — {stage.name}</h3>
                <p className="pool-sheet-competition">{contest.name} · {fullLabel}</p>
                {(dateLabel || locationLabel) && (
                  <p className="pool-sheet-meta">{[dateLabel, locationLabel].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </td>
          </tr>
          )}
          <tr>
            <th className="pbl-num">Match</th>
            <th className="pbl-fencer">{contest.isTeamEvent ? 'Équipe' : 'Tireur'}</th>
            <th className="pbl-score">Score</th>
            <th className="pbl-fencer">{contest.isTeamEvent ? 'Équipe' : 'Tireur'}</th>
          </tr>
        </thead>
        <tbody>
          {pool.bouts.map((bout, idx) => {
            const fA = fencers.find(f => f.id === bout.fencerAId)
            const fB = fencers.find(f => f.id === bout.fencerBId)
            return (
              <tr key={idx}>
                <td className="pbl-num">{idx + 1}</td>
                <td className="pbl-fencer pbl-fencer-a">
                  <span className="pbl-n">{fA?.num}</span>{' '}{fA?.name}
                </td>
                <td className="pbl-score">
                  <span className="score-box"></span>
                  <span className="score-sep">–</span>
                  <span className="score-box"></span>
                </td>
                <td className="pbl-fencer pbl-fencer-b">
                  <span className="pbl-n">{fB?.num}</span>{' '}{fB?.name}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const QuickPopup = ({ scores, colorClass, popupPos, handleQuick }: {
  scores: { sa: number; sb: number }[]
  colorClass: string
  popupPos: { top?: number; bottom?: number; left?: number; right?: number }
  handleQuick: (sa: number, sb: number) => void
}) => (
  <div style={{ position: 'fixed', top: popupPos.top, bottom: popupPos.bottom, left: popupPos.left, right: popupPos.right, zIndex: 9999 }}
    className="bg-white border border-gray-200 rounded-lg shadow-xl p-1.5 flex flex-col gap-1">
    {scores.map(({ sa, sb }) => (
      <button key={`${sa}-${sb}`}
        className={`text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap transition-colors ${colorClass}`}
        onClick={() => handleQuick(sa, sb)}>
        {sa}-{sb}
      </button>
    ))}
  </div>
)

function BoutRow({ bout, nameA, nameB, maxScore, isEditing, scoreAInput, scoreBInput, onScoreAChange, onScoreBChange, onEdit, onSave, onCancel, onAbsent, onQuickScore, disabled }: Readonly<{
  bout: PoolBout
  nameA: string
  nameB: string
  maxScore: number
  isEditing: boolean
  scoreAInput: string
  scoreBInput: string
  onScoreAChange: (v: string) => void
  onScoreBChange: (v: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onAbsent: (side: 'A' | 'B') => void
  onQuickScore: (sa: number, sb: number) => void
  disabled: boolean
}>) {
  const [openSide, setOpenSide] = useState<'A' | 'B' | null>(null)
  const [popupPos, setPopupPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null)

  const scored = bout.scoreA !== undefined && bout.scoreB !== undefined
  const isAbsent = bout.resultA === 'A' || bout.resultB === 'A'

  const quickScoresA = Array.from({ length: maxScore }, (_, i) => ({ sa: maxScore, sb: i }))
  const quickScoresB = Array.from({ length: maxScore }, (_, i) => ({ sa: i, sb: maxScore }))

  function handleQuick(sa: number, sb: number) {
    onQuickScore(sa, sb)
    setOpenSide(null)
    setPopupPos(null)
  }

  function openPopup(side: 'A' | 'B', btn: HTMLButtonElement | null) {
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const onRight = rect.left > window.innerWidth / 2
    const onBottom = rect.bottom > window.innerHeight * 0.6
    setPopupPos({
      ...(onBottom ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      ...(onRight ? { right: window.innerWidth - rect.right } : { left: rect.left }),
    })
    setOpenSide(p => p === side ? null : side)
  }

  const inputError = (() => {
    if (!isEditing) return null
    const sa = parseInt(scoreAInput)
    const sb = parseInt(scoreBInput)
    if (isNaN(sa) || isNaN(sb)) return null
    if (sa < 0 || sb < 0) return 'Score négatif impossible'
    if (sa > maxScore || sb > maxScore) return `Score max\u00a0: ${maxScore}`
    if (sa === sb) return 'Égalité impossible en poule'
    return null
  })()

  return (
    <div className={`rounded-lg border p-2 ${scored ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'} ${isAbsent ? 'opacity-60' : ''}`}>
      {/* Backdrop to close popup on outside click */}
      {openSide && <div className="fixed inset-0 z-[9998]" role="button" tabIndex={-1} aria-label="Fermer" onClick={() => { setOpenSide(null); setPopupPos(null) }} onKeyDown={e => { if (e.key === 'Escape') { setOpenSide(null); setPopupPos(null) } }} />}
      {openSide && popupPos && (
        <QuickPopup
          scores={openSide === 'A' ? quickScoresA : quickScoresB}
          colorClass={openSide === 'A' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}
          popupPos={popupPos}
          handleQuick={handleQuick}
        />
      )}
      <div className="text-xs text-gray-400 mb-1">Match {bout.order}</div>
      {isEditing ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1 flex-wrap">
            {/* Trigger bulle : A gagne */}
            {!disabled && (
              <button
                className="text-xs px-1.5 py-0.5 rounded border font-medium bg-green-50 text-green-700 border-green-200 hover:bg-green-100 shrink-0"
                onClick={e => openPopup('A', e.currentTarget)}
                title="Scores rapides — gauche gagne">
                V ▾
              </button>
            )}
            <span className="text-sm font-medium flex-1 text-right truncate min-w-0">{nameA}</span>
            <input type="number" min="0" max={maxScore} value={scoreAInput}
              onChange={e => onScoreAChange(e.target.value)}
              className={`w-12 text-center border rounded px-1 py-0.5 text-sm shrink-0 ${inputError ? 'border-red-400 bg-red-50' : ''}`}
              />
            <span className="text-gray-400 font-bold shrink-0">—</span>
            <input type="number" min="0" max={maxScore} value={scoreBInput}
              onChange={e => onScoreBChange(e.target.value)}
              className={`w-12 text-center border rounded px-1 py-0.5 text-sm shrink-0 ${inputError ? 'border-red-400 bg-red-50' : ''}`} />
            <span className="text-sm font-medium flex-1 truncate min-w-0">{nameB}</span>
            <button className="btn-primary text-xs py-0.5 px-2 disabled:opacity-40 shrink-0" onClick={onSave} disabled={!!inputError}>✓</button>
            <button className="btn-secondary text-xs py-0.5 px-2 shrink-0" onClick={onCancel}>✕</button>
            {/* Trigger bulle : B gagne */}
            {!disabled && (
              <button
                className="text-xs px-1.5 py-0.5 rounded border font-medium bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shrink-0"
                onClick={e => openPopup('B', e.currentTarget)}
                title="Scores rapides — droite gagne">
                ▾ V
              </button>
            )}
          </div>
          {inputError && (
            <p className="text-xs text-red-600 text-center">{inputError}</p>
          )}
          <div className="flex justify-center gap-2 pt-1">
            <button className="text-xs text-red-500 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50" onClick={() => { onAbsent('A'); onCancel() }}>Absent ← {nameA}</button>
            <button className="text-xs text-red-500 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50" onClick={() => { onAbsent('B'); onCancel() }}>Absent → {nameB}</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {/* Trigger bulle : A gagne */}
          {!disabled && (
            <button
              className="text-xs px-1.5 py-0.5 rounded border font-medium bg-green-50 text-green-700 border-green-200 hover:bg-green-100 shrink-0"
              onClick={e => openPopup('A', e.currentTarget)}
              title="Scores rapides — gauche gagne">
              V ▾
            </button>
          )}
          {(() => {
            let classA = 'text-gray-700'
            if (bout.resultA === 'V') { classA = 'font-bold text-green-700' } else if (bout.resultA === 'A') { classA = 'text-red-500 italic' }
            let classB = 'text-gray-700'
            if (bout.resultB === 'V') { classB = 'font-bold text-green-700' } else if (bout.resultB === 'A') { classB = 'text-red-500 italic' }
            return (<>
              <span className={`text-sm flex-1 text-right truncate min-w-0 ${classA}`}>{nameA}{bout.resultA === 'A' ? ' (ABS)' : ''}</span>
              <span className="text-sm font-mono font-bold text-gray-800 w-16 text-center shrink-0">
                {scored ? `${bout.scoreA} — ${bout.scoreB}` : '— —'}
              </span>
              <span className={`text-sm flex-1 truncate min-w-0 ${classB}`}>{nameB}{bout.resultB === 'A' ? ' (ABS)' : ''}</span>
            </>)
          })()}
          {/* Trigger bulle : B gagne */}
          {!disabled && (
            <button
              className="text-xs px-1.5 py-0.5 rounded border font-medium bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shrink-0"
              onClick={e => openPopup('B', e.currentTarget)}
              title="Scores rapides — droite gagne">
              ▾ V
            </button>
          )}
          {!disabled && <span className="text-gray-300 text-xs cursor-pointer shrink-0 ml-1" role="button" tabIndex={0} onClick={onEdit} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onEdit() }}>✏️</span>}
        </div>
      )}
    </div>
  )
}
