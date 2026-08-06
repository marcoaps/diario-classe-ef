import React, { useEffect, useState } from 'react';
import { Plus, UserRound, X } from 'lucide-react';
import { listarPersonagensAtivos, criarPersonagem } from './personagensChargesData';
import { criarPersonagemPadrao, PAPEIS_PERSONAGEM } from './tiposCharges';
import type { PapelPersonagem, Personagem } from './tiposCharges';

const CLASSE_INPUT = 'w-full px-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface';
const CLASSE_LABEL = 'text-xs text-on-surface-variant mb-1 block';

export interface PersonagensSeletorProps {
  selecionadosIds: string[];
  onChangeSelecionados: (ids: string[]) => void;
  desabilitado: boolean;
}

export function PersonagensSeletor({ selecionadosIds, onChangeSelecionados, desabilitado }: PersonagensSeletorProps) {
  const [personagens, setPersonagens] = useState<Personagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mostrandoFormNovo, setMostrandoFormNovo] = useState(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [novo, setNovo] = useState(criarPersonagemPadrao());

  useEffect(() => {
    listarPersonagensAtivos()
      .then(setPersonagens)
      .catch(e => setErro(`Não foi possível carregar o banco de personagens: ${(e as Error).message}`))
      .finally(() => setCarregando(false));
  }, []);

  function alternarSelecao(id: string) {
    if (desabilitado) return;
    onChangeSelecionados(
      selecionadosIds.includes(id) ? selecionadosIds.filter(i => i !== id) : [...selecionadosIds, id]
    );
  }

  function atualizarNovo<K extends keyof ReturnType<typeof criarPersonagemPadrao>>(campo: K, valor: (ReturnType<typeof criarPersonagemPadrao>)[K]) {
    setNovo(prev => ({ ...prev, [campo]: valor }));
  }

  async function salvarNovoPersonagem() {
    if (!novo.nome.trim()) {
      setErro('Preencha ao menos o nome do personagem.');
      return;
    }
    setSalvandoNovo(true);
    setErro('');
    try {
      const criado = await criarPersonagem(novo);
      setPersonagens(prev => [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome)));
      onChangeSelecionados([...selecionadosIds, criado.id]);
      setNovo(criarPersonagemPadrao());
      setMostrandoFormNovo(false);
    } catch (e) {
      setErro(`Erro ao cadastrar personagem: ${(e as Error).message}`);
    } finally {
      setSalvandoNovo(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className={CLASSE_LABEL}>Personagens participantes *</label>
      {erro && <p className="text-xs text-on-error-container bg-error-container rounded-xl px-3 py-2">{erro}</p>}

      {carregando ? (
        <p className="text-xs text-on-surface-variant">Carregando banco de personagens...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {personagens.map(p => {
            const selecionado = selecionadosIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={desabilitado}
                onClick={() => alternarSelecao(p.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                  selecionado
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-background text-on-surface-variant border-outline-variant',
                ].join(' ')}
              >
                <UserRound className="w-3.5 h-3.5" />
                {p.nome}
              </button>
            );
          })}
          <button
            type="button"
            disabled={desabilitado}
            onClick={() => setMostrandoFormNovo(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-outline-variant text-on-surface-variant"
          >
            {mostrandoFormNovo ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {mostrandoFormNovo ? 'Cancelar' : 'Novo personagem'}
          </button>
        </div>
      )}

      {selecionadosIds.length === 0 && !carregando && (
        <p className="text-[11px] text-on-surface-variant">Selecione ao menos 1 personagem para gerar a charge.</p>
      )}

      {mostrandoFormNovo && (
        <div className="bg-background border border-outline-variant rounded-xl p-3 space-y-2 mt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={CLASSE_LABEL}>Nome *</label>
              <input value={novo.nome} onChange={e => atualizarNovo('nome', e.target.value)} className={CLASSE_INPUT} placeholder="Ex: Léo" />
            </div>
            <div>
              <label className={CLASSE_LABEL}>Papel</label>
              <select value={novo.papel} onChange={e => atualizarNovo('papel', e.target.value as PapelPersonagem)} className={CLASSE_INPUT}>
                {PAPEIS_PERSONAGEM.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={CLASSE_LABEL}>Idade</label>
              <input
                type="number"
                value={novo.idade ?? ''}
                onChange={e => atualizarNovo('idade', e.target.value ? Number(e.target.value) : null)}
                className={CLASSE_INPUT}
              />
            </div>
            <div>
              <label className={CLASSE_LABEL}>Sexo</label>
              <input value={novo.sexo} onChange={e => atualizarNovo('sexo', e.target.value)} className={CLASSE_INPUT} placeholder="F / M" />
            </div>
            <div>
              <label className={CLASSE_LABEL}>Altura aprox.</label>
              <input value={novo.alturaAproximada} onChange={e => atualizarNovo('alturaAproximada', e.target.value)} className={CLASSE_INPUT} placeholder="1,55m" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={CLASSE_LABEL}>Cor de pele</label>
              <input value={novo.corPele} onChange={e => atualizarNovo('corPele', e.target.value)} className={CLASSE_INPUT} />
            </div>
            <div>
              <label className={CLASSE_LABEL}>Cabelo</label>
              <input value={novo.tipoCabelo} onChange={e => atualizarNovo('tipoCabelo', e.target.value)} className={CLASSE_INPUT} placeholder="curto, cacheado..." />
            </div>
            <div>
              <label className={CLASSE_LABEL}>Cor do cabelo</label>
              <input value={novo.corCabelo} onChange={e => atualizarNovo('corCabelo', e.target.value)} className={CLASSE_INPUT} />
            </div>
          </div>
          <div>
            <label className={CLASSE_LABEL}>Uniforme/roupa</label>
            <input value={novo.uniforme} onChange={e => atualizarNovo('uniforme', e.target.value)} className={CLASSE_INPUT} placeholder="camiseta azul, calção branco, tênis preto" />
          </div>
          <div>
            <label className={CLASSE_LABEL}>Personalidade</label>
            <input value={novo.personalidade} onChange={e => atualizarNovo('personalidade', e.target.value)} className={CLASSE_INPUT} placeholder="Ex: animado, um pouco impulsivo" />
          </div>
          <button
            type="button"
            onClick={salvarNovoPersonagem}
            disabled={salvandoNovo}
            className="w-full px-3 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-60"
          >
            {salvandoNovo ? 'Salvando...' : 'Salvar e selecionar'}
          </button>
        </div>
      )}
    </div>
  );
}
