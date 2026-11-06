// Tela do Banco de Questões: lista o que foi salvo pelo Gerador de Questões,
// no mesmo visual do caderno de prova (Questão N sublinhado, letras em círculo),
// permite filtrar, excluir e baixar (PDF/Word) as questões marcadas.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Database, FileDown, FileText, Loader2, Trash2 } from 'lucide-react';
import { excluirQuestaoBanco, listarBancoQuestoes, type ItemBancoQuestoes } from './bancoQuestoesData';
import { exportarQuestoesPDF, exportarQuestoesWord } from './exportarQuestoesGerador';
import { criarParametrosPadrao } from './tiposGeradorQuestoes';

const ROTULO_DIFICULDADE: Record<string, string> = {
  muito_facil: 'Muito fácil', facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', misto: 'Misto',
};

const AZUL = '#1e3a5f';

function LetraCirculo({ letra, destaque }: { letra: string; destaque?: boolean }) {
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center rounded-full font-bold"
      style={{
        width: 20, height: 20, fontSize: 11, color: destaque ? '#fff' : AZUL,
        background: destaque ? AZUL : 'transparent', border: `1.5px solid ${AZUL}`,
      }}
    >
      {letra}
    </span>
  );
}

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

  const todasFiltradasMarcadas = filtrados.length > 0 && filtrados.every(i => marcadas.has(i.id));

  function alternarMarca(id: string) {
    setMarcadas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function alternarTodas() {
    setMarcadas(prev => {
      const n = new Set(prev);
      if (todasFiltradasMarcadas) filtrados.forEach(i => n.delete(i.id));
      else filtrados.forEach(i => n.add(i.id));
      return n;
    });
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
    // Mantém a ordem em que aparecem na tela (a prova sai na mesma sequência).
    const sel = filtrados.filter(i => marcadas.has(i.id));
    if (sel.length === 0) return;
    setExportando(true);
    setErro('');
    try {
      const params = {
        ...criarParametrosPadrao(),
        componenteCurricular: sel[0].componenteCurricular,
        anoEscolar: sel[0].anoEscolar,
        conteudo: [...new Set(sel.map(s => s.questao.conteudo))].slice(0, 2).join(' / '),
      };
      const questoes = sel.map(s => s.questao);
      const opcoes = { incluirGabarito: true, incluirComentariosDistratores: false, incluirNaoConformesOficial: true };
      if (formato === 'pdf') await exportarQuestoesPDF(questoes, params, opcoes);
      else await exportarQuestoesWord(questoes, params, opcoes);
    } catch (e) { setErro(`Erro ao baixar: ${(e as Error).message}`); }
    finally { setExportando(false); }
  }

  const semMarcadas = marcadas.size === 0;
  const botaoBaixar = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-sm font-semibold disabled:opacity-40';

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

      {/* Barra de ações sempre visível: marcar e baixar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 flex-wrap bg-surface-container-low border border-outline-variant px-3 py-2 rounded-xl text-sm">
        <label className="flex items-center gap-1.5 font-semibold text-on-surface cursor-pointer">
          <input type="checkbox" checked={todasFiltradasMarcadas} onChange={alternarTodas} disabled={filtrados.length === 0} />
          Marcar todas ({filtrados.length})
        </label>
        <span className="text-on-surface-variant">{semMarcadas ? 'Marque as questões para montar a prova' : `${marcadas.size} marcada(s)`}</span>
        <div className="flex gap-2 ml-auto">
          <button disabled={exportando || semMarcadas} onClick={() => exportar('pdf')} className={botaoBaixar}>
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Baixar PDF
          </button>
          <button disabled={exportando || semMarcadas} onClick={() => exportar('word')} className={botaoBaixar}>
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Baixar Word
          </button>
        </div>
        {!semMarcadas && <button onClick={() => setMarcadas(new Set())} className="underline text-on-surface-variant">Limpar</button>}
      </div>

      {erro && <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-xl">{erro}</div>}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-on-surface-variant"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {itens.length === 0 ? 'Nenhuma questão salva ainda. Gere questões e use "Salvar no Banco de Questões".' : 'Nenhuma questão encontrada com esse filtro.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((i, n) => {
            const q = i.questao;
            const open = aberta === i.id;
            return (
              <div key={i.id} className="bg-surface rounded-2xl border border-outline-variant px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={marcadas.has(i.id)} onChange={() => alternarMarca(i.id)} className="mt-1" aria-label={`Marcar questão ${n + 1}`} />
                  <button className="flex-1 min-w-0 text-left" onClick={() => setAberta(open ? null : i.id)}>
                    <p className="font-bold text-sm pb-0.5 mb-1.5" style={{ color: AZUL, borderBottom: `1.5px solid ${AZUL}` }}>
                      Questão {n + 1}
                    </p>
                    <p className={`text-sm text-on-surface ${open ? '' : 'line-clamp-2'}`}>{q.enunciado}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {i.componenteCurricular} · {i.anoEscolar}º ano · {q.conteudo} · {ROTULO_DIFICULDADE[q.dificuldade] ?? q.dificuldade}
                    </p>
                    {open && q.habilidadeBncc && <p className="text-xs text-on-surface-variant mt-0.5">{q.habilidadeBncc}</p>}
                  </button>
                  <ChevronDown className={`w-4 h-4 mt-1 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
                {open && (
                  <div className="mt-2 pl-6 space-y-1">
                    {q.contexto && <p className="text-xs italic text-on-surface-variant border border-outline-variant rounded-lg px-2 py-1 mb-1">{q.contexto}</p>}
                    {q.alternativas?.map(a => (
                      <div key={a.letra} className="flex items-start gap-2 py-1.5 border-b border-outline-variant/70">
                        <LetraCirculo letra={a.letra} destaque={a.correta} />
                        <span className={`text-sm ${a.correta ? 'font-semibold text-on-surface' : 'text-on-surface'}`}>{a.texto}</span>
                      </div>
                    ))}
                    {!q.alternativas && q.respostaCorreta && <p className="text-sm text-primary font-semibold">Resposta: {q.respostaCorreta}</p>}
                    <button onClick={() => excluir(i.id)} className="flex items-center gap-1 text-xs text-error pt-1.5">
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
