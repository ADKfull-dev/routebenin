/**
 * App — ossature de l'application : barre latérale (desktop) et barre de
 * navigation inférieure (mobile), avec la zone de contenu (Outlet).
 */
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Route, History as HistoryIcon, Settings as SettingsIcon, MapPin } from 'lucide-react';
import type { ComponentType } from 'react';
import { BandeauxPwa, BoutonInstaller } from './components/Pwa';

interface Lien {
  to: string;
  label: string;
  icone: ComponentType<{ className?: string }>;
  end?: boolean;
}

const liens: Lien[] = [
  { to: '/', label: 'Tableau de bord', icone: LayoutDashboard, end: true },
  { to: '/optimiser', label: 'Nouvelle tournée', icone: Route },
  { to: '/historique', label: 'Historique', icone: HistoryIcon },
  { to: '/parametres', label: 'Paramètres', icone: SettingsIcon },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-electrique text-white">
        <MapPin className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="font-bold text-slate-900 dark:text-white">
          Route<span className="text-electrique">Bénin</span>
        </p>
        <p className="text-[11px] text-slate-400">Optimiseur de tournées</p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <div className="min-h-full md:flex">
      {/* Barre latérale — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ligne bg-white p-5 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-0.5">
          {liens.map(({ to, label, icone: Icone, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-electrique/[0.08] text-electrique'
                    : 'text-nuit/65 hover:bg-brume hover:text-nuit'
                }`
              }
            >
              <Icone className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto max-w-[12rem] pt-6 text-xs leading-relaxed text-nuit/40">
          Optimisez vos livraisons. Gagnez du temps. Réduisez vos distances.
        </p>
      </aside>

      {/* En-tête mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ligne bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <BoutonInstaller compact />
      </header>

      {/* Contenu */}
      <main className="flex-1 pb-20 md:pb-0">
        <BandeauxPwa />
        <Outlet />
      </main>

      {/* Navigation inférieure — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-ligne bg-white/95 backdrop-blur md:hidden">
        {liens.map(({ to, label, icone: Icone, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-electrique' : 'text-nuit/55'
              }`
            }
          >
            <Icone className="h-5 w-5" />
            {label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
