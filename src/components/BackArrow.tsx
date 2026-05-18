import { useNavigate, useLocation } from 'react-router-dom'

// URL structure:
// /                                         → home
// /tournament/:tid                          → 2 segments
// /tournament/:tid/contest/:cid             → 4 segments
// /tournament/:tid/contest/:cid/checkin     → 5 segments
// /tournament/:tid/contest/:cid/pools/:sid  → 6 segments
function getParentPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length >= 5) return `/tournament/${parts[1]}/contest/${parts[3]}`
  if (parts.length === 4) return `/tournament/${parts[1]}`
  if (parts.length >= 2) return '/'
  return '/'
}

export function BackArrow() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const parent = getParentPath(pathname)

  return (
    <button
      type="button"
      onClick={() => navigate(parent)}
      title="Retour"
      aria-label="Retour"
      className="text-gray-400 hover:text-gray-700 transition-colors"
      style={{ lineHeight: 1, padding: '0 2px', display: 'inline-flex', alignItems: 'center' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  )
}
