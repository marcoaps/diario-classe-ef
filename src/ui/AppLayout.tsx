import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Users, CheckSquare, GraduationCap, CalendarSearch, BarChart3, QrCode, Sparkles } from 'lucide-react';
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
      <main className="flex-1 overflow-y-auto w-full" style={{ paddingBottom: '80px' }}>
        <div className="max-w-2xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-red-600 shadow-lg flex items-stretch justify-around z-50" style={{ height: '64px' }}>
        <NavItem to="/" icon={<Users />} label="Turmas" />
        <NavItem to="/attendance" icon={<CheckSquare />} label="Chamada" />
        <NavItem to="/history" icon={<CalendarSearch />} label="Histórico" />
        <NavItem to="/grades" icon={<GraduationCap />} label="Notas" />
        <NavItem to="/alunos" icon={<QrCode />} label="Alunos" />
        <NavItem to="/ia" icon={<Sparkles />} label="IA" ia />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label, ia }: { to: string; icon: React.ReactNode; label: string; ia?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "flex flex-col items-center justify-center w-full gap-1 text-[11px] font-bold transition-all duration-150 relative",
        isActive
          ? ia ? "text-purple-600" : "text-red-600"
          : "text-gray-400 hover:text-gray-600"
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className={cn(
              "absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full",
              ia ? "bg-purple-600" : "bg-red-600"
            )} />
          )}
          {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}
