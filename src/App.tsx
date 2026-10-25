import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store';
import { AppLayout } from './ui/AppLayout';
const Dashboard = lazy(() => import('./ui/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Attendance = lazy(() => import('./ui/pages/Attendance').then(m => ({ default: m.Attendance })));
const MarcarGenero = lazy(() => import('./ui/pages/MarcarGenero').then(m => ({ default: m.MarcarGenero })));
const AttendanceHistory = lazy(() => import('./ui/pages/AttendanceHistory').then(m => ({ default: m.AttendanceHistory })));
const AttendanceReport = lazy(() => import('./ui/pages/AttendanceReport').then(m => ({ default: m.AttendanceReport })));
const Evaluations = lazy(() => import('./ui/pages/Evaluations').then(m => ({ default: m.Evaluations })));
const GradeReport = lazy(() => import('./ui/pages/GradeReport').then(m => ({ default: m.GradeReport })));
const Trabalhos = lazy(() => import('./ui/pages/Trabalhos').then(m => ({ default: m.Trabalhos })));
const SystemReset = lazy(() => import('./ui/pages/SystemReset').then(m => ({ default: m.SystemReset })));
import { Login } from './ui/pages/Login';
const PortalAluno = lazy(() => import('./ui/pages/PortalAluno').then(m => ({ default: m.PortalAluno })));
const GerarQRCodes = lazy(() => import('./ui/pages/GerarQRCodes').then(m => ({ default: m.GerarQRCodes })));
const ProvasOnline = lazy(() => import('./ui/pages/ProvasOnline').then(m => ({ default: m.ProvasOnline })));
const ResponderProva = lazy(() => import('./ui/pages/ResponderProva').then(m => ({ default: m.ResponderProva })));
const TestePublico = lazy(() => import('./ui/pages/TestePublico').then(m => ({ default: m.TestePublico })));
const CentralAluno = lazy(() => import('./ui/pages/CentralAluno').then(m => ({ default: m.CentralAluno })));
const IAHub = lazy(() => import('./ui/pages/ia/IAHub').then(m => ({ default: m.IAHub })));
const IAPlanoAula = lazy(() => import('./ui/pages/ia/IAPlanoAula').then(m => ({ default: m.IAPlanoAula })));
const IASequencia = lazy(() => import('./ui/pages/ia/IASequencia').then(m => ({ default: m.IASequencia })));
const IAEsportesInvasao = lazy(() => import('./ui/pages/ia/IAEsportesInvasao').then(m => ({ default: m.IAEsportesInvasao })));
const IAPlanejamentoAnual = lazy(() => import('./ui/pages/ia/IAPlanejamentoAnual').then(m => ({ default: m.IAPlanejamentoAnual })));
const IARoteiro = lazy(() => import('./ui/pages/ia/IARoteiro').then(m => ({ default: m.IARoteiro })));
const IAPlanoMensal = lazy(() => import('./ui/pages/ia/IAPlanoMensal').then(m => ({ default: m.IAPlanoMensal })));
const IAProvasIA = lazy(() => import('./ui/pages/ia/IAProvasIA').then(m => ({ default: m.IAProvasIA })));
const IAAtividadesLudicas = lazy(() => import('./ui/pages/ia/IAAtividadesLudicas').then(m => ({ default: m.IAAtividadesLudicas })));
const IAAtividadesAdaptadas = lazy(() => import('./ui/pages/ia/IAAtividadesAdaptadas').then(m => ({ default: m.IAAtividadesAdaptadas })));
const IAIdeiasAvaliacoes = lazy(() => import('./ui/pages/ia/IAIdeiasAvaliacoes').then(m => ({ default: m.IAIdeiasAvaliacoes })));
const OrganizadorProvas = lazy(() => import('./ui/pages/organizador/OrganizadorProvas').then(m => ({ default: m.OrganizadorProvas })));
const DiarioAulas = lazy(() => import('./ui/pages/DiarioAulas').then(m => ({ default: m.DiarioAulas })));
const IAProvaOficial = lazy(() => import('./ui/pages/ia/IAProvaOficial').then(m => ({ default: m.IAProvaOficial })));
const RendimentoBimestre = lazy(() => import('./ui/pages/RendimentoBimestre').then(m => ({ default: m.RendimentoBimestre })));
const Avaliacoes = lazy(() => import('./ui/pages/avaliacoes/Avaliacoes').then(m => ({ default: m.Avaliacoes })));
const AvaliacaoFolha = lazy(() => import('./ui/pages/avaliacoes/AvaliacaoFolha').then(m => ({ default: m.AvaliacaoFolha })));
const AvaliacaoCorrigir = lazy(() => import('./ui/pages/avaliacoes/AvaliacaoCorrigir').then(m => ({ default: m.AvaliacaoCorrigir })));
const AvaliacaoResultados = lazy(() => import('./ui/pages/avaliacoes/AvaliacaoResultados').then(m => ({ default: m.AvaliacaoResultados })));
const AvaliacaoCorrecoes = lazy(() => import('./ui/pages/avaliacoes/AvaliacaoCorrecoes').then(m => ({ default: m.AvaliacaoCorrecoes })));
const AvaliacaoFormatar = lazy(() => import('./ui/pages/avaliacoes/AvaliacaoFormatar').then(m => ({ default: m.AvaliacaoFormatar })));
const ExerciciosFixacao = lazy(() => import('./ui/pages/exercicios/ExerciciosFixacao').then(m => ({ default: m.ExerciciosFixacao })));
const ExercicioFormatar = lazy(() => import('./ui/pages/exercicios/ExercicioFormatar').then(m => ({ default: m.ExercicioFormatar })));
const GeradorQuestoes = lazy(() => import('./ui/pages/avaliacoes/GeradorQuestoes').then(m => ({ default: m.GeradorQuestoes })));
const AvaliacaoGabaritoRapido = lazy(() => import('./ui/pages/avaliacoes/AvaliacaoGabaritoRapido').then(m => ({ default: m.AvaliacaoGabaritoRapido })));
const GeradorCharges = lazy(() => import('./ui/pages/charges/GeradorCharges').then(m => ({ default: m.GeradorCharges })));
const ChargesHistorico = lazy(() => import('./ui/pages/charges/ChargesHistorico').then(m => ({ default: m.ChargesHistorico })));
const InterclassesIOP = lazy(() => import('./ui/pages/InterclassesIOP'));
const InscricaoAlunosPublico = lazy(() => import('./ui/pages/InscricaoAlunosPublico').then(m => ({ default: m.InscricaoAlunosPublico })));
const SumulaJanela = lazy(() => import('./ui/pages/interclasses/SumulaJanela').then(m => ({ default: m.SumulaJanela })));
const ConfrontosPublico = lazy(() => import('./ui/pages/interclasses/ConfrontosPublico').then(m => ({ default: m.ConfrontosPublico })));
const InscricaoTime = lazy(() => import('./ui/pages/InscricaoTime').then(m => ({ default: m.InscricaoTime })));
const RodizioFutsal = lazy(() => import('./ui/pages/rodizio/RodizioFutsal').then(m => ({ default: m.RodizioFutsal })));
const AgendaHoje = lazy(() => import('./ui/pages/AgendaHoje').then(m => ({ default: m.AgendaHoje })));
const AlunosProva = lazy(() => import('./ui/pages/AlunosProva').then(m => ({ default: m.AlunosProva })));
const LideresProva = lazy(() => import('./ui/pages/LideresProva').then(m => ({ default: m.LideresProva })));
const AlunosEspeciais = lazy(() => import('./ui/pages/AlunosEspeciais').then(m => ({ default: m.AlunosEspeciais })));
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
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" /></div>}>
      <Routes>
        <Route path="/teste" element={<TestePublico />} />
        <Route path="/aluno" element={<PortalAluno />} />
        <Route path="/aluno/:token" element={<PortalAluno />} />
        <Route path="/responder" element={<ResponderProva />} />
        <Route path="/login" element={<Login />} />
        <Route path="/torneio/inscricao/:token" element={<InscricaoTime />} />
        <Route path="/interclasses/inscricao" element={<InscricaoAlunosPublico />} />
        <Route path="/interclasses/resultados" element={<ConfrontosPublico />} />
        <Route path="/agenda" element={<AgendaHoje />} />
        <Route path="/lideres-prova" element={<LideresProva />} />
        <Route path="/lideres-prova/:turma" element={<LideresProva />} />

        <Route element={<LayoutProtegido />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/genero" element={<MarcarGenero />} />
          <Route path="/alunos-especiais" element={<AlunosEspeciais />} />
          <Route path="/history" element={<AttendanceHistory />} />
          <Route path="/report" element={<AttendanceReport />} />
          <Route path="/evaluations" element={<Evaluations />} />
          <Route path="/grades" element={<GradeReport />} />
          <Route path="/trabalhos" element={<Trabalhos />} />
          <Route path="/reset" element={<SystemReset />} />
          <Route path="/provas" element={<ProvasOnline />} />
          <Route path="/qrcodes" element={<GerarQRCodes />} />
          <Route path="/alunos" element={<CentralAluno />} />
          <Route path="/rendimento" element={<RendimentoBimestre />} />
          <Route path="/torneio" element={<InterclassesIOP />} />
          <Route path="/interclasses/sumula/:jogoId" element={<SumulaJanela />} />
          <Route path="/rodizio" element={<RodizioFutsal />} />

          {/* Modulo Avaliacoes com QR Code */}
          <Route path="/avaliacoes" element={<Avaliacoes />} />
          <Route path="/avaliacoes/folha/:id" element={<AvaliacaoFolha />} />
          <Route path="/avaliacoes/corrigir/:id" element={<AvaliacaoCorrigir />} />
          <Route path="/avaliacoes/resultados/:id" element={<AvaliacaoResultados />} />
          <Route path="/avaliacoes/correcoes/:id" element={<AvaliacaoCorrecoes />} />
          <Route path="/avaliacoes/formatar/:id" element={<AvaliacaoFormatar />} />
          <Route path="/prova-alunos" element={<AlunosProva />} />
          <Route path="/avaliacoes/gerador" element={<GeradorQuestoes />} />
          <Route path="/avaliacoes/gabarito-rapido" element={<AvaliacaoGabaritoRapido />} />

          {/* Exercicios de Fixacao — conteudo livre, poucas questoes, mesmo cabecalho/Formatar */}
          <Route path="/exercicios" element={<ExerciciosFixacao />} />
          <Route path="/exercicios/formatar/:id" element={<ExercicioFormatar />} />

          {/* Rotas IA */}
          <Route path="/ia" element={<IAHub />} />
          <Route path="/ia/plano-aula" element={<IAPlanoAula />} />
          <Route path="/ia/sequencia" element={<IASequencia />} />
          <Route path="/ia/esportes-invasao" element={<IAEsportesInvasao />} />
          <Route path="/ia/planejamento-anual" element={<IAPlanejamentoAnual />} />
          <Route path="/ia/roteiro" element={<IARoteiro />} />
          <Route path="/ia/plano-mensal" element={<IAPlanoMensal />} />
          <Route path="/ia/provas" element={<IAProvasIA />} />
          <Route path="/ia/prova-oficial" element={<IAProvaOficial />} />
          <Route path="/ia/atividades-ludicas" element={<IAAtividadesLudicas />} />
          <Route path="/ia/atividades-adaptadas" element={<IAAtividadesAdaptadas />} />
          <Route path="/ia/ideias-avaliacoes" element={<IAIdeiasAvaliacoes />} />
          <Route path="/ia/organizador-provas" element={<OrganizadorProvas />} />
          <Route path="/ia/charges" element={<GeradorCharges />} />
          <Route path="/ia/charges/historico" element={<ChargesHistorico />} />
          <Route path="/diario-aulas" element={<DiarioAulas />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
