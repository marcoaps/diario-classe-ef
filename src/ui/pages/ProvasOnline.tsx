import React, { useState, useEffect } from 'react';
import { supabase } from '../../data/supabase';
import { Plus, Trash2, Eye, Copy, CheckCircle, X, FileText, Users } from 'lucide-react';
const turmas = ['6F','7A','7B','7C','7D','7E','8A','8B','8C','8D','8E','8F','9A','9B','9C','9D','9E','9F','9G'];
function gerarCodigo() { return Math.random().toString(36).substring(2,8).toUpperCase(); }
export function ProvasOnline() {
  const [tab, setTab] = useState('lista');
  const [provas, setProvas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiado, setCopiado] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [turma, setTurma] = useState('');
  const [dataLimite, setDataLimite] = useState('');
  const [questoes, setQuestoes] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [provaResultados, setProvaResultados] = useState(null);
  const [resultados, setResultados] = useState([]);
  useEffect(() => { carregarProvas(); }, []);
  const carregarProvas = async () => { setLoading(true); const { data } = await supabase.from('provas').select('*').order('criado_em', { ascending: false }); setProvas(data || []); setLoading(false); };
  const adicionarQuestao = (tipo) => { setQuestoes(prev => [...prev, { id: Math.random().toString(36).substring(2), enunciado: '', tipo, opcoes: tipo === 'multipla_escolha' ? ['','','',''] : [], resposta_correta: '', pontos: 1 }]); };
  const atualizarQuestao = (id, campo, valor) => { setQuestoes(prev => prev.map(q => q.id === id ? { ...q, [campo]: valor } : q)); };
  const atualizarOpcao = (qId, idx, valor) => { setQuestoes(prev => prev.map(q => { if (q.id !== qId) return q; const novasOpcoes = [...q.opcoes]; novasOpcoes[idx] = valor; return { ...q, opcoes: novasOpcoes }; })); };
  const removerQuestao = (id) => { setQuestoes(prev => prev.filter(q => q.id !== id)); };
  const salvarProva = async () => { if (!titulo || !turma || questoes.length === 0) { alert('Preencha titulo, turma e questoes.'); return; } setSalvando(true); try { const codigo = gerarCodigo(); const { data: prova, error } = await supabase.from('provas').insert({ titulo, descricao, turma_id: turma, codigo, data_limite: dataLimite || null }).select().single(); if (error) throw error; const qi = questoes.map((q,i) => ({ prova_id: prova.id, enunciado: q.enunciado, tipo: q.tipo, opcoes: q.tipo === 'multipla_escolha' ? q.opcoes : null, resposta_correta: q.tipo === 'multipla_escolha' ? q.resposta_correta : null, pontos: q.pontos, ordem: i+1 })); await supabase.from('questoes').insert(qi); alert('Prova criada!'); setTitulo(''); setDescricao(''); setTurma(''); setDataLimite(''); setQuestoes([]); setTab('lista'); carregarProvas(); } catch(e) { alert('Erro: '+e.message); } setSalvando(false); };
  const copiarCodigo = (codigo) => { navigator.clipboard.writeText(codigo); setCopiado(codigo); setTimeout(() => setCopiado(null), 2000); };
  const verResultados = async (prova) => { setProvaResultados(prova); const { data } = await supabase.from('respostas').select('*').eq('prova_id', prova.id); setResultados(data || []); setTab('resultados'); };
  const deletarProva = async (id) => { if (!confirm('Deletar?')) return; await supabase.from('provas').delete().eq('id', id); carregarProvas(); };
  const tabClass = (k) => k === tab ? 'flex-1 py-2 rounded-xl text-sm font-bold bg-white text-primary shadow-sm' : 'flex-1 py-2 rounded-xl text-sm font-bold text-gray-500';
  return (
    <div className='p-4 flex flex-col gap-4'>
      <div className='bg-primary rounded-[2rem] p-5 text-white shadow-lg'>
        <h2 className='text-xl font-bold'>Provas Online</h2>
        <p className='text-sm opacity-70 mt-0.5'>Crie e gerencie avaliacoes para os alunos</p>
      </div>
      <div className='flex gap-2 bg-gray-100 rounded-2xl p-1'>
        <button onClick={() => setTab('lista')} className={tabClass('lista')}>Minhas Provas</button>
        <button onClick={() => setTab('criar')} className={tabClass('criar')}>Criar Prova</button>
      </div>
      {tab === 'lista' && (
        <div className='flex flex-col gap-3'>
          {loading && <p className='text-center text-gray-400 text-sm py-4'>Carregando...</p>}
          {!loading && provas.length === 0 && <div className='text-center py-10 text-gray-400'><FileText className='w-12 h-12 mx-auto mb-3 opacity-30'/><p className='font-medium'>Nenhuma prova criada ainda.</p></div>}
          {provas.map(prova => (
            <div key={prova.id} className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3'>
              <div className='flex items-start justify-between'>
                <div><p className='font-bold text-gray-800'>{prova.titulo}</p><p className='text-xs text-gray-400'>Turma {prova.turma_id}</p></div>
                <button onClick={() => deletarProva(prova.id)} className='text-gray-300 hover:text-red-400'><Trash2 className='w-4 h-4'/></button>
              </div>
              <div className='bg-primary/5 rounded-xl px-3 py-2 flex items-center justify-between'>
                <div><p className='text-xs text-gray-400'>Codigo de acesso</p><p className='font-mono font-black text-primary text-lg tracking-widest'>{prova.codigo}</p></div>
                <button onClick={() => copiarCodigo(prova.codigo)} className='text-primary'>{copiado === prova.codigo ? <CheckCircle className='w-5 h-5 text-green-500'/> : <Copy className='w-5 h-5'/>}</button>
              </div>
              <button onClick={() => verResultados(prova)} className='w-full py-2 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center gap-2'><Eye className='w-4 h-4'/> Ver Resultados</button>
            </div>
          ))}
        </div>
      )}
      {tab === 'criar' && (
        <div className='flex flex-col gap-4'>
          <div className='bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm'>
            <p className='font-bold text-gray-700 text-sm'>Informacoes da Prova</p>
            <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder='Titulo da prova' className='w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none'/>
            <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder='Instrucoes (opcional)' rows={2} className='w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none'/>
            <div className='grid grid-cols-2 gap-2'>
              <select value={turma} onChange={e=>setTurma(e.target.value)} className='w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none'><option value=''>Turma</option>{turmas.map(t=><option key={t} value={t}>{t}</option>)}</select>
              <input type='datetime-local' value={dataLimite} onChange={e=>setDataLimite(e.target.value)} className='w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none'/>
            </div>
          </div>
          {questoes.map((q,idx) => (
            <div key={q.id} className='bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 shadow-sm'>
              <div className='flex items-center justify-between'><span className='text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg'>{idx+1}. {q.tipo === 'multipla_escolha' ? 'Multipla Escolha' : 'Dissertativa'}</span><button onClick={() => removerQuestao(q.id)} className='text-gray-300 hover:text-red-400'><X className='w-4 h-4'/></button></div>
              <textarea value={q.enunciado} onChange={e=>atualizarQuestao(q.id,'enunciado',e.target.value)} placeholder='Enunciado...' rows={2} className='w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none'/>
              {q.tipo === 'multipla_escolha' && (<div className='flex flex-col gap-2'>{q.opcoes.map((op,i) => (<div key={i} className='flex items-center gap-2'><button onClick={() => atualizarQuestao(q.id,'resposta_correta',String(i))} className={q.resposta_correta === String(i) ? 'w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center' : 'w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center'}>{q.resposta_correta === String(i) && <CheckCircle className='w-3 h-3 text-white'/>}</button><input value={op} onChange={e=>atualizarOpcao(q.id,i,e.target.value)} placeholder={'Opcao '+String.fromCharCode(65+i)} className='flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none'/></div>))}</div>)}
              <div className='flex items-center gap-2'><label className='text-xs text-gray-500 font-semibold'>Pontos:</label><input type='number' value={q.pontos} onChange={e=>atualizarQuestao(q.id,'pontos',parseFloat(e.target.value))} min='0.5' max='10' step='0.5' className='w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-center outline-none'/></div>
            </div>
          ))}
          <div className='grid grid-cols-2 gap-2'>
            <button onClick={() => adicionarQuestao('multipla_escolha')} className='py-3 rounded-2xl border-2 border-dashed border-primary/30 text-primary font-bold text-sm flex items-center justify-center gap-2'><Plus className='w-4 h-4'/> Multipla Escolha</button>
            <button onClick={() => adicionarQuestao('dissertativa')} className='py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm flex items-center justify-center gap-2'><Plus className='w-4 h-4'/> Dissertativa</button>
          </div>
          <button onClick={salvarProva} disabled={salvando} className='w-full py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 transition-all disabled:opacity-50' style={{background:'linear-gradient(135deg,#1a3a7c,#3b6fd4)'}}>{salvando ? 'Salvando...' : 'Publicar Prova'}</button>
        </div>
      )}
      {tab === 'resultados' && provaResultados && (
        <div className='flex flex-col gap-3'>
          <div className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm'><p className='font-bold text-gray-800'>{provaResultados.titulo}</p><p className='text-xs text-gray-400'>{resultados.length} respostas</p></div>
          {resultados.length === 0 && <div className='text-center py-8 text-gray-400'><Users className='w-10 h-10 mx-auto mb-2 opacity-30'/><p className='text-sm'>Nenhuma resposta ainda.</p></div>}
          {resultados.map(r => (<div key={r.id} className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between'><div><p className='font-bold text-gray-800 text-sm'>{r.aluno_nome}</p><p className='text-xs text-gray-400'>No {r.aluno_numero}</p></div><div className={r.nota >= 6 ? 'text-xl font-black text-green-500' : 'text-xl font-black text-red-500'}>{r.nota != null ? r.nota.toFixed(1) : '--'}</div></div>))}
          <button onClick={() => { setTab('lista'); setProvaResultados(null); setResultados([]); }} className='w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm'>Voltar</button>
        </div>
      )}
    </div>
  );
}
