import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { Contest, Tournament } from '../types'

interface Props {
  tournament: Tournament
  contest: Contest
  tournamentId: string
}

export function ContestBreadcrumb({ tournament, contest, tournamentId }: Props) {
  const navigate = useNavigate()
  const { updateContest } = useStore()
  const color = contest.color ?? null
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const borderColor = color ?? '#d1d5db'

  return (
    <span ref={ref} className="inline-flex items-center gap-1.5 relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          border: `3px solid ${borderColor}`,
          borderRadius: '7px',
          padding: '4px 28px 4px 10px',
          fontWeight: 600,
          fontSize: '0.875rem',
          color: '#1f2937',
          background: 'white',
          cursor: 'pointer',
          outline: 'none',
          maxWidth: '280px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          position: 'relative',
          lineHeight: '1.4',
        }}
      >
        {contest.name}
        {/* chevron */}
        <span style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          fontSize: '0.65rem', opacity: 0.5, pointerEvents: 'none',
        }}>▼</span>
      </button>

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

      {/* Color picker */}
      <label className="cursor-pointer leading-none" title="Couleur de la compétition">
        <input
          type="color"
          value={color ?? '#1e3a5f'}
          onChange={e => updateContest(tournamentId, { ...contest, color: e.target.value })}
          className="sr-only"
        />
        <span
          className="text-sm transition-opacity hover:opacity-100"
          style={{ opacity: color ? 0.6 : 0.35 }}
          aria-hidden
        >🎨</span>
      </label>

      {color && (
        <button
          className="text-gray-300 hover:text-gray-500 transition-colors leading-none text-xs font-bold"
          title="Retirer la couleur"
          onClick={() => updateContest(tournamentId, { ...contest, color: undefined })}
          aria-label="Retirer la couleur"
        >✕</button>
      )}
    </span>
  )
}
