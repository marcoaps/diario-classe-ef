import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calendar, ClipboardList, Route,
  CalendarDays, FileQuestion, Gamepad2, Accessibility, Lightbulb, ChevronRight
} from 'lucide-react';

const FERRAMENTAS = [
  {
    rota: '/ia/plano-aula',
    titulo: 'Gerador de Planos de Aula',
    descricao: 'Crie planos de aula completos alinhados à BNCC com objetivos, metodologia e avaliação.',
    icon: BookOpen,
    cor: 'from-blue-600 to-blue-500',
    tag: 'BNCC',
  },
  {
    rota: '/ia/sequencia',
    titulo: 'Gerador de Sequências Didáticas',
    descricao: 'Elabore sequências didáticas para desenvolver habilidades ao longo de várias aulas.',
    icon: ClipboardList,
    cor: 'from-emerald-600 to-emerald-500',
    tag: 'PLANEJAMENTO',
  },
  {
    rota: '/ia/planejamento-anual',
    titulo: 'Gerador de Planejamento Anual',
    descricao: 'Crie planejamentos anuais bimestrais completos com integração automática à BNCC.',
    icon: Calendar,
    cor: 'from-indigo-600 to-indigo-500',
    tag: 'BNCC',
    novo: true,
  },
  {
    rota: '/ia/roteiro',
    titulo: 'Gerador de Roteiros de Aula',
    descricao: 'Otimize seu planejamento com roteiros detalhados, incluindo sequência didática e gestão do tempo.',
    icon: Route,
    cor: 'from-cyan-600 to-cyan-500',
    tag: 'PLANEJAMENTO',
  },
  {
    rota: '/ia/plano-mensal',
    titulo: 'Gerador de Plano Mensal',
    descricao: 'Planeje todo o mês com objetivos, conteúdos e atividades organizadas semana a semana.',
    icon: CalendarDays,
    cor: 'from-violet-600 to-violet-500',
    tag: 'PLANEJAMENTO',
  },
  {
    rota: '/ia/provas',
    titulo: 'Gerador de Provas e Avaliações',
    descricao: 'Crie provas e avaliações personalizadas com questões objetivas e dissertativas.',
    icon: FileQuestion,
    cor: 'from-red-600 to-red-500',
    tag: 'AVALIAÇÕES',
  },
  {
    rota: '/ia/atividades-ludicas',
    titulo: 'Gerador de Atividades Lúdicas',
    descricao: 'Gere atividades lúdicas e jogos pedagógicos para tornar as aulas mais dinâmicas.',
    icon: Gamepad2,
    cor: 'from-orange-500 to-amber-500',
    tag: 'ATIVIDADES',
  },
  {
    rota: '/ia/atividades-adaptadas',
    titulo: 'Gerador de Atividades Adaptadas',
    descricao: 'Crie atividades adaptadas para alunos com necessidades educacionais especiais.',
    icon: Accessibility,
    cor: 'from-teal-600 to-teal-500',
    tag: 'INCLUSÃO',
    novo: true,
  },
  {
    rota: '/ia/ideias-avaliacoes',
    titulo: 'Ideias para Avaliações Adaptadas',
    descricao: 'Gere ideias criativas de avaliação adaptadas ao perfil e necessidades dos alunos.',
    icon: Lightbulb,
    cor: 'from-yellow-500 to-amber-400',
    tag: 'AVALIAÇÕES',
  },
];

export function IAHub() {
  const navigate = useNavigate();
  return (
    <div className="p-4 flex flex-col gap-4 pb-36">
      {/* Header */}
      <div className="rounded-[2rem] p-5 text-white shadow-lg relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4c1d95, #7c3aed)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -ml-5 -mb-5" />
        <div className="relative z-10">
          <p className="text-purple-200 text-xs font-black uppercase tracking-widest mb-1">Assistente Pedagógico</p>
          <h2 className="text-xl font-black">Ferramentas com IA ✨</h2>
          <p className="text-sm text-white/70 mt-1">Planejamento e avaliação para Educação Física</p>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {FERRAMENTAS.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.rota}
              onClick={() => navigate(f.rota)}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.cor} flex items-center justify-center shrink-0 shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{f.tag}</span>
                  {f.novo && (
                    <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">NOVO</span>
                  )}
                </div>
                <p className="font-black text-gray-800 text-sm leading-tight">{f.titulo}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{f.descricao}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-300 pb-2">Powered by Claude AI · Instituto Odilon Pratagi</p>
    </div>
  );
}
