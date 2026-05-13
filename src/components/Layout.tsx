import { Outlet, NavLink } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-[#1e3a5f] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:text-blue-200">
            <span className="text-2xl">🤺</span>
            BellePoule
          </NavLink>
          <span className="text-blue-300 text-sm ml-auto">Gestion de compétitions d'escrime</span>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-gray-400 py-3 border-t border-gray-200">
        BellePoule Web — Données stockées localement, fonctionne hors connexion
      </footer>
    </div>
  )
}
