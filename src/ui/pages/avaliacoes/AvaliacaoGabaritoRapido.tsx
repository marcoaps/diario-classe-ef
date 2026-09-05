// ============================================================================
// "Criar apenas o Gabarito" — caminho rápido inspirado no GradePen: pra quando
// a prova em si (enunciados, alternativas) já existe em outro documento
// (Word, PDF, apostila) e o professor só precisa de um gabarito + folha de
// respostas com QR pra correção automática, sem digitar nenhuma questão aqui.
//
// Continua usando exatamente o mesmo schema de `avaliacoes` que o formulário
// completo (Avaliacoes.tsx) — só que com enunciado/alternativas vazios, já
// que a folha de respostas (AvaliacaoFolha.tsx) nunca usa esses textos, só os
// números e letras. Por isso nenhuma migração de banco é necessária.
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../../data/supabase';
import { ALTERNATIVAS_PADRAO, arredondar, GRUPOS_CORRETOR } from './tiposCorretorProvas';

const TURMAS = ['6F', '7B', '7C', '7D', '7E', '7F', '8A', '8B', '8C', '8D', '8E', '8F', '9A', '9B', '9C', '9D', '9E', '9F'];
const BIMESTRES = ['1', '2', '3', '4'];

interface LinhaGabarito {
  id: string;
  tipo: 'multipla_escolha' | 'discursiva';
  valor: string;
  /** Só relevante para tipo === 'multipla_escolha'. */
  correta: string;
}

function novaLinha(tipo: LinhaGabarito['tipo'], valor: string): LinhaGabarito {
  return { id: crypto.randomUUID(), tipo, valor, correta: '' };
}

function linhasIniciais(): LinhaGabarito[] {
  // Padrão recomendado pela escola: 8 objetivas + 2 discursivas.
  return [
    ...Array.from({ length: 8 }, () => novaLinha('multipla_escolha', '1.0')),
    ...Array.from({ length: 2 }, () => novaLinha('discursiva', '1.0')),
  ];
}

export function AvaliacaoGabaritoRapido() {
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [disciplina, setDisciplina] = useState('Educação Física');
  const [turmaId, setTurmaId] = useState('');
  const [bimestre, setBimestre] = useState('');
  const [dataProva, setDataProva] = useState('');
  const [professor, setProfessor] = useState('');
  const [linhas, setLinhas] = useState<LinhaGabarito[]>(linhasIniciais());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const objetivas = linhas.filter(l => l.tipo === 'multipla_escolha');
  const discursivas = linhas.filter(l => l.tipo === 'discursiva');
  const total = linhas.reduce((soma, l) => soma + (parseFloat(l.valor.replace(',', '.')) || 0), 0);

  // "Trava em valor igual por grupo": mudar o valor de UMA linha propaga pra
  // todas as outras do mesmo tipo — evita a nota sair errada silenciosamente,
  // já que a correção hoje só sabe dividir o total igualmente dentro do grupo.
  function mudarValorGrupo(tipo: LinhaGabarito['tipo'], valor: string) {
    setLinhas(prev => prev.map(l => (l.tipo === tipo ? { ...l, valor } : l)));
  }

  function mudarTipo(id: string, tipo: LinhaGabarito['tipo']) {
    setLinhas(prev => {
      const valorDoGrupo = prev.find(l => l.tipo === tipo)?.valor ?? '1.0';
      return prev.map(l => (l.id === id ? { ...l, tipo, valor: valorDoGrupo, correta: tipo === 'discursiva' ? '' : l.correta } : l));
    });
  }

  function mudarCorreta(id: string, letra: string) {
    setLinhas(prev => prev.map(l => (l.id === id ? { ...l, correta: l.correta === letra ? '' : letra } : l)));
  }

  function adicionarLinha() {
    setLinhas(prev => {
      const valorObjetivas = prev.find(l => l.tipo === 'multipla_escolha')?.valor ?? '1.0';
      return [...prev, novaLinha('multipla_escolha', valorObjetivas)];
    });
  }

  function apagarUltima() {
    setLinhas(prev => prev.slice(0, -1));
  }

  function removerLinha(id: string) {
    setLinhas(prev => prev.filter(l => l.id !== id));
  }

  async function salvar() {
    setErro('');
    if (!titulo.trim()) { setErro('Informe o título da avaliação.'); return; }
    if (!turmaId) { setErro('Selecione uma turma.'); return; }
    if (linhas.length === 0) { setErro('Adicione pelo menos uma questão.'); return; }
    const semGabarito = objetivas.filter(l => !l.correta);
    if (semGabarito.length > 0) { setErro(`${semGabarito.length} questão(ões) de múltipla escolha sem a resposta correta marcada.`); return; }
    const valorObj = parseFloat((objetivas[0]?.valor || '0').replace(',', '.')) || 0;
    const valorDisc = parseFloat((discursivas[0]?.valor || '0').replace(',', '.')) || 0;
    if (objetivas.length > 0 && valorObj <= 0) { setErro('Informe o valor das questões objetivas.'); return; }
    if (discursivas.length > 0 && valorDisc <= 0) { setErro('Informe o valor das questões discursivas.'); return; }

    setSalvando(true);
    const questoesObjetivas = objetivas.map((_, i) => ({
      numero: i + 1,
      enunciado: '',
      alternativas: ALTERNATIVAS_PADRAO.map(letra => ({ letra, texto: '' })),
    }));
    const gabarito: Record<string, string> = {};
    objetivas.forEach((l, i) => { gabarito[String(i + 1)] = l.correta; });
    const questoesSubjetivas: Record<string, string> = {};
    discursivas.forEach((_, i) => { questoesSubjetivas[String(objetivas.length + i + 1)] = ''; });

    const { error } = await supabase.from('avaliacoes').insert({
      titulo: titulo.trim(),
      descricao: null,
      disciplina,
      turma_id: turmaId,
      bimestre: bimestre || null,
      data_prova: dataProva || null,
      professor: professor.trim() || null,
      observacoes: null,
      quantidade_objetivas: objetivas.length,
      quantidade_discursivas: discursivas.length,
      alternativas: [...ALTERNATIVAS_PADRAO],
      gabarito,
      valor_total_objetivas: arredondar(valorObj * objetivas.length, 2),
      valor_total_discursivas: arredondar(valorDisc * discursivas.length, 2),
      questoes_objetivas: questoesObjetivas,
      questoes_subjetivas: questoesSubjetivas,
      texto_apoio: null,
      num_questoes: objetivas.length + discursivas.length,
      valor_questao: valorObj,
    });
    setSalvando(false);
    if (error) { setErro('Erro ao salvar: ' + error.message); return; }
    navigate('/avaliacoes');
  }

  return (
    <div className="py-4 space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-on-surface">Criar apenas o Gabarito</h1>
          <p className="text-xs text-on-surface-variant">Sem digitar enunciado — use quando a prova já existe em outro documento.</p>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-3">
        <div>
          <label className="text-xs text-on-surface-variant mb-1 block">Título *</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Ex: Avaliação de Handebol — 3º Bimestre"
            className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Disciplina</label>
            <input value={disciplina} onChange={e => setDisciplina(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Turma *</label>
            <select value={turmaId} onChange={e => setTurmaId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface">
              <option value="">Selecione...</option>
              <optgroup label="Turmas">
                {TURMAS.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
              <optgroup label="Grupos (várias turmas de uma vez)">
                {GRUPOS_CORRETOR.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Bimestre</label>
            <select value={bimestre} onChange={e => setBimestre(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface">
              <option value="">-</option>
              {BIMESTRES.map(b => <option key={b} value={b}>{b}º</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Data</label>
            <input type="date" value={dataProva} onChange={e => setDataProva(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant mb-1 block">Professor(a)</label>
            <input value={professor} onChange={e => setProfessor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface" />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-container text-on-secondary-container text-xs">
                <th className="px-2 py-2 text-left w-8">Nº</th>
                <th className="px-2 py-2 text-left w-20">Valor</th>
                <th className="px-2 py-2 text-left w-36">Tipo</th>
                <th className="px-2 py-2 text-center">Gabarito</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {linhas.map((l, i) => (
                <tr key={l.id}>
                  <td className="px-2 py-2 text-on-surface-variant text-xs">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <input
                      value={l.valor}
                      onChange={e => mudarValorGrupo(l.tipo, e.target.value)}
                      inputMode="decimal"
                      className="w-16 px-2 py-1 rounded-lg border border-outline-variant bg-background text-xs text-center"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={l.tipo}
                      onChange={e => mudarTipo(l.id, e.target.value as LinhaGabarito['tipo'])}
                      className="w-full px-2 py-1 rounded-lg border border-outline-variant bg-background text-xs"
                    >
                      <option value="multipla_escolha">Múltipla Escolha</option>
                      <option value="discursiva">Discursiva</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    {l.tipo === 'multipla_escolha' ? (
                      <div className="flex items-center justify-center gap-1">
                        {ALTERNATIVAS_PADRAO.map(letra => (
                          <button
                            key={letra}
                            onClick={() => mudarCorreta(l.id, letra)}
                            className={[
                              'w-7 h-7 rounded-full border text-xs font-bold flex items-center justify-center',
                              l.correta === letra ? 'bg-primary text-on-primary border-primary' : 'bg-background text-on-surface-variant border-outline-variant',
                            ].join(' ')}
                          >
                            {letra}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-[11px] text-on-surface-variant">correção manual</p>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => removerLinha(l.id)} className="text-error">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
          <div className="flex gap-2">
            <button onClick={adicionarLinha} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
            <button onClick={apagarUltima} disabled={linhas.length === 0}
              className="px-3 py-1.5 rounded-xl border border-outline-variant text-on-surface-variant text-xs font-semibold disabled:opacity-50">
              Apagar última
            </button>
          </div>
          <p className="text-sm font-bold text-on-surface">Total: {total.toFixed(2).replace('.', ',')}</p>
        </div>
      </div>

      {erro && <div className="text-sm text-error bg-error-container rounded-xl px-3 py-2">{erro}</div>}

      <div className="fixed bottom-16 left-0 right-0 px-4 max-w-md mx-auto">
        <button onClick={salvar} disabled={salvando}
          className="w-full py-3 rounded-2xl bg-primary text-on-primary font-semibold shadow-lg disabled:opacity-60">
          {salvando ? 'Salvando...' : 'Salvar avaliação'}
        </button>
      </div>
    </div>
  );
}
