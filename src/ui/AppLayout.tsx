import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { Users, CheckSquare, GraduationCap, CloudOff, Cloud, CalendarSearch, BarChart3, Settings, QrCode } from 'lucide-react';
import { useStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function AppLayout() {
  const { isSynced, triggerSync } = useStore();

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 text-gray-900 overflow-hidden font-sans" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

      <main className="flex-1 overflow-y-auto w-full pb-24">
        <div className="max-w-2xl mx-auto h-full w-full">
          <Outlet />
        </div>
      </main>

      {/* Nav branca com detalhe vermelho */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-red-600 shadow-lg flex items-stretch justify-around z-50" style={{ height: '64px' }}>
        <NavItem to="/" icon={<Users />} label="Turmas" />
        <NavItem to="/attendance" icon={<CheckSquare />} label="Chamada" />
        <NavItem to="/history" icon={<CalendarSearch />} label="Histórico" />
        <NavItem to="/report" icon={<BarChart3 />} label="Relatórios" />
        <NavItem to="/grades" icon={<GraduationCap />} label="Notas" />
        <NavItem to="/alunos" icon={<QrCode />} label="Alunos" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "flex flex-col items-center justify-center w-full gap-1 text-[11px] font-bold transition-all duration-150 relative",
        isActive ? "text-red-600" : "text-gray-400 hover:text-gray-600"
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-600 rounded-b-full" />}
          {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}
