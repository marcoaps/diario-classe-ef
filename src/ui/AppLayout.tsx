import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { Users, CheckSquare, GraduationCap, CloudOff, Cloud, CalendarSearch, BarChart3, Settings } from 'lucide-react';
import { useStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
const LOGO_URL = "https://i.imgur.com/3t5GEnQ.jpeg";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function AppLayout() {
  const { isSynced, triggerSync } = useStore();

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-on-surface overflow-hidden font-sans print:h-auto print:overflow-visible" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="flex-shrink-0 flex items-center justify-between px-margin-mobile h-20 bg-surface z-50 sticky top-0 shadow-sm border-b border-outline-variant pt-2">
        <div className="flex items-center gap-2 px-2 py-1">
           <img 
             src={LOGO_URL} 
             alt="Diário de Classe EF" 
             className="w-32 h-32 object-contain rounded-lg flex-shrink-0 print:w-36 print:h-36"
           />
           <span className="font-bold text-base text-primary">Diário de Classe EF</span>
        </div>
        
        <div className="flex items-center gap-sm">
           <Link to="/reset" className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </Link>
          <button 
            onClick={triggerSync}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
              isSynced ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"
            )}
          >
            {isSynced ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            {isSynced ? 'Sync' : 'Pendente'}
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto w-full pb-24 print:overflow-visible print:h-auto">
        <div className="max-w-2xl mx-auto h-full w-full px-margin-mobile">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 print:hidden left-0 right-0 h-16 bg-surface border-t border-outline-variant shadow-lg flex items-center justify-around px-2 z-50 rounded-t-xl">
         <NavItem to="/" icon={<Users />} label="Turmas" />
         <NavItem to="/attendance" icon={<CheckSquare />} label="Chamada" />
         <NavItem to="/history" icon={<CalendarSearch />} label="Histórico" />
         <NavItem to="/report" icon={<BarChart3 />} label="Relatórios" />
         <NavItem to="/grades" icon={<GraduationCap />} label="Notas" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({isActive}) => cn(
        "flex flex-col items-center justify-center w-full h-full gap-1 text-[12px] font-medium transition-all duration-150 rounded-lg",
        isActive 
          ? "bg-secondary-container text-on-secondary-container font-bold" 
          : "text-on-surface-variant dark:text-outline hover:bg-surface-container-highest"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      <span>{label}</span>
    </NavLink>
  );
}
