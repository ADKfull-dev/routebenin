/**
 * App — ossature : rail de navigation encre (desktop), barre inférieure
 * (mobile) et zone de contenu (Outlet).
 */
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Route, History as HistoryIcon, Settings as SettingsIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BandeauxPwa, BoutonInstaller } from './components/Pwa';

interface Lien {
  to: string;
  label: string;
  court: string;
  icone: LucideIcon;
  end?: boolean;
}

const liens: Lien[] = [
  { to: '/', label: 'Tableau de bord', court: 'Accueil', icone: LayoutDashboard, end: true },
  { to: '/optimiser', label: 'Nouvelle tournée', court: 'Tournée', icone: Route },
  { to: '/historique', label: 'Historique', court: 'Historique', icone: HistoryIcon },
  { to: '/parametres', label: 'Paramètres', court: 'Réglages', icone: SettingsIcon },
];

/** Marque : pastille jaune + épingle encre (même dessin que l'icône d'application). */
export function Marque({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="9" fill="#FFC414" />
      <path
        d="M20 8.5c-4.7 0-8.5 3.7-8.5 8.3 0 6 8.5 14.7 8.5 14.7s8.5-8.7 8.5-14.7c0-4.6-3.8-8.3-8.5-8.3Z"
        fill="#171B3F"
      />
      <circle cx="20" cy="16.8" r="3.3" fill="#FFC414" />
    </svg>
  );
}

export function App() {
  return (
    <div className="min-h-full md:flex">
      {/* Rail de navigation — desktop */}
      <aside className="sticky top-0 hidden h-[100dvh] w-[88px] shrink-0 flex-col items-center bg-encre py-5 md:flex">
        <NavLink to="/" aria-label="RouteBénin — accueil">
          <Marque className="h-10 w-10" />
        </NavLink>
        <nav className="mt-8 flex w-full flex-col gap-1">
          {liens.map(({ to, label, court, icone: Icone, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                `relative mx-2 flex flex-col items-center gap-1.5 rounded-md py-3 text-[0.75rem] font-medium transition-colors ${
                  isActive ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-2 top-2 bottom-2 w-1 rounded-r bg-zem" aria-hidden />}
                  <Icone className={`h-[22px] w-[22px] ${isActive ? 'text-zem' : ''}`} strokeWidth={1.8} />
                  {court}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête mobile */}
        <header className="sticky top-0 z-[600] flex items-center justify-between bg-encre px-4 py-2.5 md:hidden">
          <NavLink to="/" className="flex items-center gap-2.5">
            <Marque className="h-8 w-8" />
            <span className="font-titre text-lg font-semibold tracking-tight text-white">RouteBénin</span>
          </NavLink>
          <BoutonInstaller compact />
        </header>

        <BandeauxPwa />

        <main className="flex-1 pb-[68px] md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Navigation inférieure — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-[700] grid grid-cols-4 border-t border-ligne bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {liens.map(({ to, court, icone: Icone, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-1 py-2.5 text-[0.75rem] font-medium ${
                isActive ? 'text-encre' : 'text-encre/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b bg-zem" aria-hidden />}
                <Icone className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
                {court}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
