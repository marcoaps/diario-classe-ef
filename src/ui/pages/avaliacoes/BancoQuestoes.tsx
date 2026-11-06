// Tela do Banco de Questões: lista o que foi salvo pelo Gerador de Questões,
// permite filtrar, excluir e exportar (PDF/Word) as questões marcadas.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Database, FileDown, FileText, Loader2, Trash2 } from 'lucide-react';
import { excluirQuestaoBanco, listarBancoQuestoes, type ItemBancoQuestoes } from './bancoQuestoesData';
import { exportarQuestoesPDF, exportarQuestoesWord } from './exportarQuestoesGerador';
import { criarParametrosPadrao } from './tiposGeradorQuestoes';

const ROTULO_DIFICULDADE: Record<string, string> = {
  muito_facil: 'Muito fácil', facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', misto: 'Misto',
};

export function BancoQuestoes() {
  const navigate = useNavigate();
  const [itens, setItens] = useState<ItemBancoQuestoes[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [ano, setAno] = useState('');
  const [aberta, setAberta] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [exportando, setExportando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try { setItens(await listarBancoQuestoes()); }
    catch (e) { setErro(`Não foi possível carregar o banco: ${(e as Error).message}`); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter(i =>
      (!ano || String(i.anoEscolar) === ano) &&
      (!t || `${i.questao.enunciado} ${i.questao.conteudo} ${i.questao.habilidadeBncc}`.toLowerCase().includes(t)));
  }, [itens, busca, ano]);

  function alternarMarca(id: string) {
    setMarcadas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function excluir(id: string) {
    if (!window.confirm('Excluir esta questão do banco?')) return;
    try {
      await excluirQuestaoBanco(id);
      setItens(prev => prev.filter(i => i.id !== id));
      setMarcadas(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) { setErro(`Erro ao excluir: ${(e as Error).message}`); }
  }

  async function exportar(formato: 'pdf' | 'word') {
    const sel = itens.filter(i => marcadas.has(i.id));
    if (sel.length === 0) return;
    setExportando(true);
    try {
      const base = criarParametrosPadrao();
      const params = {
        ...base,
        componenteCurricular: sel[0].componenteCurricular,
        anoEscolar: sel[0].anoEscolar,
        conteudo: [...new Set(sel.map(s => s.questao.conteudo))].slice(0, 2).join(' / '),
      };
      const questoes = sel.map(s => s.questao);
      const opcoes = { incluirGabarito: true, incluirComentariosDistratores: false, incluirNaoConformesOficial: true };
      if (formato === 'pdf') await exportarQuestoesPDF(questoes, params, opcoes);
      else await exportarQuestoesWord(questoes, params, opcoes);
    } catch (e) { setErro(`Erro ao exportar: ${(e as Error).message}`); }
    finally { setExportando(false); }
  }

  return (
    <div className="py-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/avaliacoes')} className="p-1 rounded-lg text-on-surface-variant" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Database className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-on-surface">Banco de Questões</h1>
      </div>

      <div className="flex gap-2">
        <input
          value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por palavra, conteúdo ou habilidade"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm"
        />
        <select value={ano} onChange={e => setAno(e.target.value)} className="px-2 py-2 rounded-xl border border-outline-variant bg-surface text-sm">
          <option value="">Todos os anos</option>
          {[6, 7, 8, 9].map(a => <option key={a} value={a}>{a}º ano</option>)}
        </select>
      </div>

      {marcadas.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-secondary-container text-on-secondary-container px-3 py-2 rounded-xl text-sm">
          <span className="font-semibold">{marcadas.size} marcada(s)</span>
          <button disabled={exportando} onClick={() => exportar('pdf')} className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-on-primary font-semibold">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button disabled={exportando} onClick={() => exportar('word')} className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-on-primary font-semibold">
            <FileText className="w-4 h-4" /> Word
          </button>
          <button onClick={() => setMarcadas(new Set())} className="ml-auto underline">Limpar</button>
        </div>
      )}

      {erro && <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-xl">{erro}</div>}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {itens.length === 0 ? 'Nenhuma questão salva ainda. Gere questões e use "Salvar no Banco de Questões".' : 'Nenhuma questão encontrada com esse filtro.'}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-on-surface-variant">{filtrados.length} questão(ões)</p>
          {filtrados.map(i => {
            const q = i.questao;
            const open = aberta === i.id;
            return (
              <div key={i.id} className="bg-surface rounded-2xl border border-outline-variant px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={marcadas.has(i.id)} onChange={() => alternarMarca(i.id)} className="mt-1" aria-label="Marcar questão" />
                  <button className="flex-1 min-w-0 text-left" onClick={() => setAberta(open ? null : i.id)}>
                    <p className={`text-sm text-on-surface ${open ? '' : 'line-clamp-2'}`}>{q.enunciado}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {i.componenteCurricular} · {i.anoEscolar}º ano · {q.conteudo}{q.habilidadeBncc ? ` · ${q.habilidadeBncc}` : ''} · {ROTULO_DIFICULDADE[q.dificuldade] ?? q.dificuldade}
                    </p>
                  </button>
                  <ChevronDown className={`w-4 h-4 mt-1 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
                {open && (
                  <div className="mt-2 pl-6 space-y-1.5">
                    {q.contexto && <p className="text-xs italic text-on-surface-variant border border-outline-variant rounded-lg px-2 py-1">{q.contexto}</p>}
                    {q.alternativas?.map(a => (
                      <p key={a.letra} className={`text-sm ${a.correta ? 'font-semibold text-primary' : 'text-on-surface'}`}>
                        {a.letra}) {a.texto}{a.correta ? '  ✓' : ''}
                      </p>
                    ))}
                    {!q.alternativas && q.respostaCorreta && <p className="text-sm text-primary font-semibold">Resposta: {q.respostaCorreta}</p>}
                    <button onClick={() => excluir(i.id)} className="flex items-center gap-1 text-xs text-error pt-1">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir do banco
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
