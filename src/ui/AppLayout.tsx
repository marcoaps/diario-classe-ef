import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Users, CheckSquare, GraduationCap, CloudOff, Cloud,
  CalendarSearch, BarChart3, QrCode, ClipboardList, CalendarDays,
  Sparkles, MoreHorizontal, X, BookOpen, Trophy, ClipboardCheck, Goal
} from 'lucide-react';
import { useStore } from '../store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const LOGO_URL = "https://i.imgur.com/3t5GEnQ.jpeg";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAIS_PATHS = ['/ia', '/avaliacoes', '/alunos', '/diario-aulas', '/torneio', '/trabalhos', '/futsal'];

export function AppLayout() {
  const { isSynced, triggerSync } = useStore();
  const [maisAberto, setMaisAberto] = useState(false);
  const location = useLocation();

  const maisAtivo = MAIS_PATHS.some(p => location.pathname.startsWith(p));

  return (
    <div
      className="flex flex-col h-[100dvh] bg-background text-on-surface overflow-hidden font-sans"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-margin-mobile h-20 bg-surface z-50 sticky top-0 shadow-sm border-b border-outline-variant pt-2">
        <div className="flex items-center gap-2 px-2 py-1">
          <img
            src={LOGO_URL}
            alt="Diario de Classe EF"
            className="w-8 h-8 object-contain rounded-lg flex-shrink-0"
          />
          <span className="font-bold text-base text-primary">Di&#225;rio de Classe EF</span>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={triggerSync}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
              isSynced
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-error-container text-on-error-container"
            )}
          >
            {isSynced ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            {isSynced ? 'Sync' : 'Pendente'}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto w-full pb-24">
        <div className="max-w-2xl mx-auto h-full w-full px-margin-mobile">
          <Outlet />
        </div>
      </main>

      {/* Overlay do popup */}
      {maisAberto && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setMaisAberto(false)}
        />
      )}

      {/* Popup Mais */}
      {maisAberto && (
        <div className="fixed bottom-20 right-2 z-50 bg-surface rounded-2xl shadow-xl border border-outline-variant overflow-hidden w-52">
          <div className="px-4 py-2.5 border-b border-outline-variant flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Mais ferramentas</span>
            <button onClick={() => setMaisAberto(false)} className="text-on-surface-variant">
              <X className="w-4 h-4" />
            </button>
          </div>
          <PopupItem
            to="/diario-aulas"
            icon={<BookOpen className="w-5 h-5" />}
            label="Di&#225;rio de Aulas"
            onClick={() => setMaisAberto(false)}
          />
          <PopupItem
            to="/ia"
            icon={<Sparkles className="w-5 h-5" />}
            label="IA &#8212; Seq. Did&#225;tica"
            onClick={() => setMaisAberto(false)}
          />
          <PopupItem
            to="/avaliacoes"
            icon={<ClipboardList className="w-5 h-5" />}
            label="Avalia&#231;&#227;o"
            onClick={() => setMaisAberto(false)}
          />
          <PopupItem
            to="/alunos"
            icon={<QrCode className="w-5 h-5" />}
            label="Alunos / QR"
            onClick={() => setMaisAberto(false)}
          />
          <PopupItem
            to="/torneio"
            icon={<Trophy className="w-5 h-5" />}
            label="Interclasses IOP"
            onClick={() => setMaisAberto(false)}
          />
          <PopupItem
            to="/trabalhos"
            icon={<ClipboardCheck className="w-5 h-5" />}
            label="Trabalhos"
            onClick={() => setMaisAberto(false)}
          />
          <PopupItem
            to="/futsal"
            icon={<Goal className="w-5 h-5" />}
            label="Times de Futsal"
            onClick={() => setMaisAberto(false)}
          />
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-outline-variant shadow-lg flex items-center justify-around px-2 z-50 rounded-t-xl">
        <NavItem to="/" icon={<Users />} label="Turmas" />
        <NavItem to="/attendance" icon={<CheckSquare />} label="Chamada" />
        <NavItem to="/history" icon={<CalendarSearch />} label="Hist&#243;rico" />
        <NavItem to="/report" icon={<BarChart3 />} label="Relat&#243;rios" />
        <NavItem to="/grades" icon={<GraduationCap />} label="Notas" />
        <button
          onClick={() => setMaisAberto(prev => !prev)}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full gap-1 text-[12px] font-medium transition-all duration-150 rounded-lg",
            (maisAtivo || maisAberto)
              ? "bg-secondary-container text-on-secondary-container font-bold"
              : "text-on-surface-variant hover:bg-surface-container-highest"
          )}
        >
          <MoreHorizontal className="w-6 h-6" />
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => cn(
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

function PopupItem({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
        isActive
          ? "bg-secondary-container text-on-secondary-container"
          : "text-on-surface hover:bg-surface-variant"
      )}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}
          
