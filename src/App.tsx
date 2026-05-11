import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store';
import { AppLayout } from './ui/AppLayout';
import { Dashboard } from './ui/pages/Dashboard';
import { Attendance } from './ui/pages/Attendance';
import { AttendanceHistory } from './ui/pages/AttendanceHistory';
import { AttendanceReport } from './ui/pages/AttendanceReport';
import { Evaluations } from './ui/pages/Evaluations';
import { GradeReport } from './ui/pages/GradeReport';
import { SystemReset } from './ui/pages/SystemReset';
import { Login } from './ui/pages/Login';
import { PortalAluno } from './ui/pages/PortalAluno';
import { GerarQRCodes } from './ui/pages/GerarQRCodes';
import { ProvasOnline } from './ui/pages/ProvasOnline';
import { ResponderProva } from './ui/pages/ResponderProva';
import { TestePublico } from './ui/pages/TestePublico';
import { supabase } from './data/supabase';

// useAuth removido
export function useAuth() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('[useAuth] getSession result:', !!data.session, 'url:', window.location.pathname);
      setSession(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      console.log('[useAuth] onAuthStateChange:', !!s, 'url:', window.location.pathname);
      setSession(!!s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return session;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = useAuth();
  console.log('[AuthGuard] rendering, session=', session, 'url:', window.location.pathname);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1628]">
        <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) {
    console.log('[AuthGuard] NO SESSION — redirecting to login from:', window.location.pathname);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function LayoutProtegido() {
  return (
    <AuthGuard>
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    </AuthGuard>
  );
}

export default function App() {
  console.log('[App] rendering, url:', window.location.pathname);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/teste" element={<TestePublico />} />
        <Route path="/aluno" element={<PortalAluno />} />
        <Route path="/aluno/:token" element={<PortalAluno />} />
        <Route path="/prova" element={<ProvasOnline />} />
        <Route path="/responder" element={<ResponderProva />} />
        <Route path="/login" element={<Login />} />

        <Route element={<LayoutProtegido />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/history" element={<AttendanceHistory />} />
          <Route path="/report" element={<AttendanceReport />} />
          <Route path="/evaluations" element={<Evaluations />} />
          <Route path="/grades" element={<GradeReport />} />
          <Route path="/reset" element={<SystemReset />} />
          <Route path="/qrcodes" element={<GerarQRCodes />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}