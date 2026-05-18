import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { Contest, Tournament } from '../types'

interface Props {
  tournament: Tournament
  contest: Contest
  tournamentId: string
}

const PALETTE = [
  '#1e3a5f', '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#d97706', '#16a34a', '#0891b2', '#0f766e',
]

function randomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]
}

export function ContestBreadcrumb({ tournament, contest, tournamentId }: Props) {
  const navigate = useNavigate()
  const { updateContest } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Assign a random color on first render if none set
  useEffect(() => {
    if (!contest.color) {
      updateContest(tournamentId, { ...contest, color: randomColor() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contest.id])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const color = contest.color ?? '#d1d5db'

  return (
    <span ref={ref} className="inline-flex items-center gap-1.5 relative">
      {/* Split button */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'stretch',
          border: `3px solid ${color}`,
          borderRadius: '7px',
          overflow: 'hidden',
          background: 'white',
        }}
      >
        {/* Left: navigate to current contest */}
        <button
          type="button"
          onClick={() => navigate(`/tournament/${tournamentId}/contest/${contest.id}`)}
          style={{
            padding: '4px 10px',
            fontWeight: 600,
            fontSize: '0.875rem',
            color: '#1f2937',
            background: 'transparent',
            cursor: 'pointer',
            outline: 'none',
            maxWidth: '240px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.4',
            border: 'none',
          }}
          title={`Aller à ${contest.name}`}
        >
          {contest.name}
        </button>

        {/* Separator */}
        <span style={{ width: '1px', background: color, margin: '3px 0', flexShrink: 0 }} />

        {/* Middle: color picker */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 7px',
            cursor: 'pointer',
            background: 'transparent',
            borderLeft: 'none',
            borderRight: 'none',
          }}
          title="Changer la couleur"
        >
          <input
            type="color"
            value={color}
            onChange={e => updateContest(tournamentId, { ...contest, color: e.target.value })}
            style={{ width: '1px', height: '1px', opacity: 0, border: 'none', padding: 0, margin: 0 }}
          />
          {/* Color swatch */}
          <span
            style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: color,
              border: '1.5px solid rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}
          />
        </label>

        {/* Separator */}
        <span style={{ width: '1px', background: color, margin: '3px 0', flexShrink: 0 }} />

        {/* Right: open dropdown */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            padding: '4px 8px',
            background: open ? `${color}22` : 'transparent',
            cursor: 'pointer',
            outline: 'none',
            border: 'none',
            lineHeight: '1',
            color: '#6b7280',
            fontSize: '0.6rem',
            transition: 'background 0.12s',
          }}
          title="Changer de compétition"
          aria-label="Changer de compétition"
        >
          {open ? '▲' : '▼'}
        </button>
      </span>

      {/* Dropdown list */}
      {open && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 999,
            marginTop: 4,
            minWidth: '220px',
            maxWidth: '320px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '4px 0',
            listStyle: 'none',
          }}
        >
          {tournament.contests.map(c => {
            const isCurrent = c.id === contest.id
            const optColor = c.color ?? null
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); navigate(`/tournament/${tournamentId}/contest/${c.id}`) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 14px',
                    fontWeight: isCurrent ? 700 : 400,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    border: 'none',
                    background: isCurrent
                      ? (optColor ?? '#e5e7eb')
                      : (optColor ? `${optColor}22` : 'transparent'),
                    color: isCurrent && optColor ? '#fff' : '#1f2937',
                    borderLeft: optColor ? `4px solid ${optColor}` : '4px solid transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => {
                    if (!isCurrent) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        optColor ? `${optColor}44` : '#f3f4f6'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isCurrent) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        optColor ? `${optColor}22` : 'transparent'
                    }
                  }}
                >
                  {c.name}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </span>
  )
}
