import { useState } from 'react';
import { BookOpen, FileText, Loader2, Download, ChevronDown, ChevronUp, GraduationCap, Info } from 'lucide-react';
import { getCurriculumData, formatCurriculumForPrompt, getAnoFromTurma } from '../../../data/curriculumData';

// ─── Turmas disponíveis ──────────────────────────────────────────────────────
const TURMAS = [
  '6F',
  '7B','7C','7D','7E','7F',
  '8A','8B','8C','8D','8E','8F',
  '9A','9B','9C','9D','9E','9F',
];

const BIMESTRES = ['1','2','3','4'];
const BIMESTRE_LABELS: Record<string, string> = {
  '1': '1º Bimestre',
  '2': '2º Bimestre',
  '3': '3º Bimestre',
  '4': '4º Bimestre',
};

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface FormData {
  turma: string;
  bimestre: string;
  tema: string;
  numAulas: string;
  observacoes: string;
  usarPlanoCurso: boolean;
}

interface Sequencia {
  turma: string;
  bimestre: string;
  tema: string;
  conteudo: string;
  geradaEm: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export default function IASequencia() {
  const [form, setForm] = useState<FormData>({
    turma: '',
    bimestre: '',
    tema: '',
    numAulas: '4',
    observacoes: '',
    usarPlanoCurso: true,
  });
  const [loading, setLoading] = useState(false);
  const [sequencia, setSequencia] = useState<Sequencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [showCurriculumPreview, setShowCurriculumPreview] = useState(false);

  // Dados do plano de curso para a turma/bimestre selecionados
  const curriculumPreview = form.turma && form.bimestre
    ? getCurriculumData(form.turma, form.bimestre)
    : null;

  const anoSelecionado = getAnoFromTurma(form.turma);

  // ── Gera a sequência didática ──────────────────────────────────────────────
  async function gerarSequencia() {
    if (!form.turma || !form.bimestre || !form.tema) {
      setErro('Preencha turma, bimestre e tema.');
      return;
    }
    setErro(null);
    setLoading(true);
    setSequencia(null);

    try {
      // Monta contexto do plano de curso, se disponível e habilitado
      let contextoPlanoCurso = '';
      if (form.usarPlanoCurso && curriculumPreview) {
        contextoPlanoCurso = formatCurriculumForPrompt(
          curriculumPreview,
          anoSelecionado,
          form.bimestre
        );
      }

      const prompt = `Você é um professor experiente de Educação Física do Ensino Fundamental Anos Finais.
Crie uma sequência didática detalhada para a seguinte situação:

TURMA: ${form.turma} (${anoSelecionado}º ano)
BIMESTRE: ${BIMESTRE_LABELS[form.bimestre]}
TEMA / CONTEÚDO: ${form.tema}
NÚMERO DE AULAS: ${form.numAulas}
${form.observacoes ? `OBSERVAÇÕES DO PROFESSOR: ${form.observacoes}` : ''}

${contextoPlanoCurso ? `\n${contextoPlanoCurso}\n\nIMPORTANTE: A sequência didática DEVE estar alinhada ao Plano de Curso Oficial acima. Utilize os objetivos, habilidades, objetos de conhecimento, propostas de atividades e formas de avaliação do plano como base para estruturar a sequência.` : ''}

A sequência didática deve ter a seguinte estrutura:

## SEQUÊNCIA DIDÁTICA
**Turma:** ${form.turma} | **Bimestre:** ${BIMESTRE_LABELS[form.bimestre]}
**Tema:** ${form.tema}
**Número de Aulas:** ${form.numAulas}

### OBJETIVOS DE APRENDIZAGEM
(Liste de 3 a 5 objetivos específicos para esta sequência)

### HABILIDADES TRABALHADAS
(Liste as habilidades da BNCC / Plano de Curso contempladas)

### OBJETOS DE CONHECIMENTO
(Liste os conteúdos conceituais, procedimentais e atitudinais)

### DESENVOLVIMENTO DA SEQUÊNCIA

#### Aula 1 – [Título da Aula]
**Duração:** 50 minutos
**Objetivo:** ...
**Aquecimento (10 min):** ...
**Parte Principal (30 min):** ...
**Volta à Calma / Roda de Conversa (10 min):** ...
**Materiais:** ...

(Repita para cada aula planejada)

### AVALIAÇÃO
(Descreva as formas de avaliação alinhadas ao plano de curso)

### RECURSOS NECESSÁRIOS
(Liste os materiais necessários para toda a sequência)

### REFERÊNCIAS / OBSERVAÇÕES PEDAGÓGICAS
(Dicas adicionais para o professor)

Seja específico, prático e adequado à realidade de uma escola pública. Use linguagem clara e direta.`;

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      const texto = data?.content?.[0]?.text || '';

      if (!texto) throw new Error('Resposta vazia da IA.');

      setSequencia({
        turma: form.turma,
        bimestre: BIMESTRE_LABELS[form.bimestre],
        tema: form.tema,
        conteudo: texto,
        geradaEm: new Date().toLocaleString('pt-BR'),
      });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }

  // ── Download como .txt ─────────────────────────────────────────────────────
  function baixarSequencia() {
    if (!sequencia) return;
    const blob = new Blob([sequencia.conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sequencia_${sequencia.turma}_${sequencia.bimestre.replace(/\s+/g, '_')}_${sequencia.tema.replace(/\s+/g, '_').slice(0, 30)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Renderização ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">

        {/* Cabeçalho */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gerador de Sequência Didática</h1>
              <p className="text-sm text-gray-500">Plano de Curso 2026 integrado automaticamente</p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuração da Sequência</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Turma */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Turma *</label>
              <select
                value={form.turma}
                onChange={e => setForm(f => ({ ...f, turma: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Selecione a turma...</option>
                {TURMAS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Bimestre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bimestre *</label>
              <select
                value={form.bimestre}
                onChange={e => setForm(f => ({ ...f, bimestre: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Selecione o bimestre...</option>
                {BIMESTRES.map(b => (
                  <option key={b} value={b}>{BIMESTRE_LABELS[b]}</option>
                ))}
              </select>
            </div>

            {/* Tema */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tema / Conteúdo *</label>
              <input
                type="text"
                value={form.tema}
                onChange={e => setForm(f => ({ ...f, tema: e.target.value }))}
                placeholder="Ex: Jogos cooperativos, Handebol, Dança de rua..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Número de aulas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de Aulas</label>
              <select
                value={form.numAulas}
                onChange={e => setForm(f => ({ ...f, numAulas: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {['2','3','4','5','6','8','10'].map(n => (
                  <option key={n} value={n}>{n} aulas</option>
                ))}
              </select>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
              <input
                type="text"
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                placeholder="Restrições, foco especial, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Toggle: usar plano de curso */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <div className="flex items-center">
              <input
                id="usarPlanoCurso"
                type="checkbox"
                checked={form.usarPlanoCurso}
                onChange={e => setForm(f => ({ ...f, usarPlanoCurso: e.target.checked }))}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
            </div>
            <label htmlFor="usarPlanoCurso" className="flex items-center gap-2 text-sm text-indigo-800 cursor-pointer">
              <GraduationCap className="w-4 h-4" />
              <span className="font-medium">Usar Plano de Curso Oficial 2026</span>
              <span className="text-indigo-600 text-xs">(alinha objetivos, habilidades e avaliação ao currículo da SEEC/AC)</span>
            </label>
          </div>

          {/* Preview do Plano de Curso */}
          {form.usarPlanoCurso && curriculumPreview && (
            <div className="mb-4 border border-indigo-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowCurriculumPreview(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
                  <Info className="w-4 h-4" />
                  <span>
                    Plano de Curso: {anoSelecionado}º Ano — {BIMESTRE_LABELS[form.bimestre]}
                  </span>
                  <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full">
                    {curriculumPreview.objetosConhecimento.length} conteúdos
                  </span>
                </div>
                {showCurriculumPreview ? (
                  <ChevronUp className="w-4 h-4 text-indigo-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-600" />
                )}
              </button>

              {showCurriculumPreview && (
                <div className="p-4 text-xs text-gray-700 space-y-3 max-h-96 overflow-y-auto">
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">🎯 Objetivos / Capacidades</p>
                    <ul className="space-y-1">
                      {curriculumPreview.objetivos.slice(0, 3).map((o, i) => (
                        <li key={i} className="text-gray-600 pl-3 border-l-2 border-indigo-200">{o}</li>
                      ))}
                      {curriculumPreview.objetivos.length > 3 && (
                        <li className="text-indigo-500 italic">+ {curriculumPreview.objetivos.length - 3} objetivos...</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">📚 Objetos de Conhecimento</p>
                    <div className="flex flex-wrap gap-1">
                      {curriculumPreview.objetosConhecimento.map((o, i) => (
                        <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{o}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">📋 Formas de Avaliação</p>
                    <ul className="space-y-1">
                      {curriculumPreview.formasAvaliacao.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-gray-600 pl-3 border-l-2 border-green-200">{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alerta: plano não encontrado */}
          {form.usarPlanoCurso && form.turma && form.bimestre && !curriculumPreview && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              ⚠️ Plano de curso não encontrado para {anoSelecionado}º ano / {BIMESTRE_LABELS[form.bimestre]}. A sequência será gerada sem o currículo oficial.
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Botão Gerar */}
          <button
            onClick={gerarSequencia}
            disabled={loading || !form.turma || !form.bimestre || !form.tema}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Gerando sequência...</span>
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5" />
                <span>Gerar Sequência Didática</span>
              </>
            )}
          </button>
        </div>

        {/* Resultado */}
        {sequencia && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Cabeçalho do resultado */}
            <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold text-lg">Sequência Didática Gerada</h2>
                <p className="text-indigo-200 text-sm">
                  {sequencia.turma} • {sequencia.bimestre} • {sequencia.tema}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-200 text-xs">{sequencia.geradaEm}</span>
                <button
                  onClick={baixarSequencia}
                  className="flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar</span>
                </button>
              </div>
            </div>

            {/* Conteúdo renderizado como markdown simples */}
            <div className="p-6 prose prose-sm max-w-none overflow-x-auto">
              <MarkdownRenderer content={sequencia.conteudo} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Renderizador de markdown simples ────────────────────────────────────────
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-2 border-b pb-1 border-gray-200">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-semibold text-indigo-700 mt-4 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith('#### ')) {
          return <h4 key={i} className="text-base font-semibold text-gray-800 mt-3 mb-1">{line.slice(5)}</h4>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold text-gray-800">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4 text-gray-700 list-disc">{renderInline(line.slice(2))}</li>;
        }
        if (/^\d+\. /.test(line)) {
          return <li key={i} className="ml-4 text-gray-700 list-decimal">{renderInline(line.replace(/^\d+\. /, ''))}</li>;
        }
        if (line.trim() === '') {
          return <div key={i} className="h-2" />;
        }
        return <p key={i} className="text-gray-700 leading-relaxed">{renderInline(line)}</p>;
      })}
    </div>
  );
}

// Inline: **bold** e *italic*
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) parts.push(<strong key={match.index}>{match[1]}</strong>);
    else if (match[2]) parts.push(<em key={match.index}>{match[2]}</em>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
