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
import { CentralAluno } from './ui/pages/CentralAluno';
import { IAHub } from './ui/pages/ia/IAHub';
import { IAPlanoAula } from './ui/pages/ia/IAPlanoAula';
import { IASequencia } from './ui/pages/ia/IASequencia';
import { IAPlanejamentoAnual } from './ui/pages/ia/IAPlanejamentoAnual';
import { IARoteiro } from './ui/pages/ia/IARoteiro';
import { IAPlanoMensal } from './ui/pages/ia/IAPlanoMensal';
import { IAProvasIA } from './ui/pages/ia/IAProvasIA';
import { IAAtividadesLudicas } from './ui/pages/ia/IAAtividadesLudicas';
import { IAAtividadesAdaptadas } from './ui/pages/ia/IAAtividadesAdaptadas';
import { IAIdeiasAvaliacoes } from './ui/pages/ia/IAIdeiasAvaliacoes';
import { DiarioAulas } from './ui/pages/DiarioAulas';
import { IAProvaOficial } from './ui/pages/ia/IAProvaOficial';
import { RendimentoBimestre } from './ui/pages/RendimentoBimestre';
import { Avaliacoes } from './ui/pages/avaliacoes/Avaliacoes';
import { AvaliacaoFolha } from './ui/pages/avaliacoes/AvaliacaoFolha';
import { AvaliacaoCorrigir } from './ui/pages/avaliacoes/AvaliacaoCorrigir';
import { AvaliacaoResultados } from './ui/pages/avaliacoes/AvaliacaoResultados';
import { GeradorQuestoes } from './ui/pages/avaliacoes/GeradorQuestoes';
import Torneio from './ui/pages/Torneio';
import { InscricaoTime } from './ui/pages/InscricaoTime';
import { AgendaHoje } from './ui/pages/AgendaHoje';
import { supabase } from './data/supabase';

export function useAuth() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => listener.subscription.unsubscribe();
  }, []);
  return session;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const session = useAuth();
  if (session === null) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1628]">
      <div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/teste" element={<TestePublico />} />
        <Route path="/aluno" element={<PortalAluno />} />
        <Route path="/aluno/:token" element={<PortalAluno />} />
        <Route path="/responder" element={<ResponderProva />} />
        <Route path="/login" element={<Login />} />
        <Route path="/torneio/inscricao/:token" element={<InscricaoTime />} />
        <Route path="/agenda" element={<AgendaHoje />} />

        <Route element={<LayoutProtegido />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/history" element={<AttendanceHistory />} />
          <Route path="/report" element={<AttendanceReport />} />
          <Route path="/evaluations" element={<Evaluations />} />
          <Route path="/grades" element={<GradeReport />} />
          <Route path="/reset" element={<SystemReset />} />
          <Route path="/provas" element={<ProvasOnline />} />
          <Route path="/qrcodes" element={<GerarQRCodes />} />
          <Route path="/alunos" element={<CentralAluno />} />
          <Route path="/rendimento" element={<RendimentoBimestre />} />
          <Route path="/torneio" element={<Torneio />} />

          {/* Modulo Avaliacoes com QR Code */}
          <Route path="/avaliacoes" element={<Avaliacoes />} />
          <Route path="/avaliacoes/folha/:id" element={<AvaliacaoFolha />} />
          <Route path="/avaliacoes/corrigir/:id" element={<AvaliacaoCorrigir />} />
          <Route path="/avaliacoes/resultados/:id" element={<AvaliacaoResultados />} />
          <Route path="/avaliacoes/gerador" element={<GeradorQuestoes />} />

          {/* Rotas IA */}
          <Route path="/ia" element={<IAHub />} />
          <Route path="/ia/plano-aula" element={<IAPlanoAula />} />
          <Route path="/ia/sequencia" element={<IASequencia />} />
          <Route path="/ia/planejamento-anual" element={<IAPlanejamentoAnual />} />
          <Route path="/ia/roteiro" element={<IARoteiro />} />
          <Route path="/ia/plano-mensal" element={<IAPlanoMensal />} />
          <Route path="/ia/provas" element={<IAProvasIA />} />
          <Route path="/ia/prova-oficial" element={<IAProvaOficial />} />
          <Route path="/ia/atividades-ludicas" element={<IAAtividadesLudicas />} />
          <Route path="/ia/atividades-adaptadas" element={<IAAtividadesAdaptadas />} />
          <Route path="/ia/ideias-avaliacoes" element={<IAIdeiasAvaliacoes />} />
          <Route path="/diario-aulas" element={<DiarioAulas />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
