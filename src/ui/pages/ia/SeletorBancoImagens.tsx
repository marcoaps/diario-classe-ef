import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { BANCO_IMAGENS, pontuarItem } from './bancoImagens';
import type { ItemBancoImagem, TipoImagemBanco } from './bancoImagens';

interface Props {
  /** Texto da questão (título, contexto, pergunta): usado para sugerir imagens. */
  textoQuestao: string;
  onEscolher: (item: ItemBancoImagem) => void;
  onFechar: () => void;
}

const FILTROS: { valor: TipoImagemBanco | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todas' },
  { valor: 'pictograma', rotulo: 'Pictogramas' },
  { valor: 'foto', rotulo: 'Fotos' },
  { valor: 'diagrama', rotulo: 'Diagramas' },
];

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Janela para escolher uma imagem do banco. As mais ligadas à questão aparecem primeiro. */
export function SeletorBancoImagens({ textoQuestao, onEscolher, onFechar }: Props) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<TipoImagemBanco | 'todos'>('todos');

  const itens = useMemo(() => {
    const termo = semAcento(busca.trim());
    return BANCO_IMAGENS
      .map((item, ordem) => ({ item, ordem, pontos: pontuarItem(item, textoQuestao) }))
      .filter(({ item }) => filtro === 'todos' || item.tipo === filtro)
      .filter(({ item }) => !termo || semAcento(`${item.titulo} ${item.tags.join(' ')}`).includes(termo))
      .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem);
  }, [busca, filtro, textoQuestao]);

  const semBusca = !busca.trim();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Banco de imagens"
    >
      <div
        className="bg-surface w-full sm:max-w-3xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-outline-variant">
          <p className="text-sm font-bold text-on-surface">Banco de imagens</p>
          <button onClick={onFechar} className="p-1 rounded-lg text-on-surface-variant" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-outline-variant">
          <div className="relative">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar: bola, gol, quadra, árbitro, passe..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-outline-variant bg-background text-sm text-on-surface"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            {FILTROS.map(f => (
              <button
                key={f.valor}
                onClick={() => setFiltro(f.valor)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${filtro === f.valor ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'}`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          {itens.length === 0 ? (
            <p className="text-sm text-on-surface-variant text-center py-8">Nenhuma imagem encontrada para essa busca.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {itens.map(({ item, pontos }) => (
                <button
                  key={item.id}
                  onClick={() => onEscolher(item)}
                  className="text-left rounded-xl border border-outline-variant overflow-hidden bg-background hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="aspect-[3/2] bg-white flex items-center justify-center">
                    <img src={item.arquivo} alt={item.titulo} loading="lazy" className="w-full h-full object-contain" />
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-semibold text-on-surface leading-tight">{item.titulo}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {item.tipo === 'foto' ? 'Foto' : item.tipo === 'diagrama' ? 'Diagrama' : 'Pictograma'}{semBusca && pontos > 0 ? ' · sugerida' : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="px-4 py-2 text-[10px] text-on-surface-variant border-t border-outline-variant">
          Os créditos das fotos e pictogramas escolhidos saem sozinhos no fim da prova (impressão e Word). Diagramas não precisam de crédito.
        </p>
      </div>
    </div>
  );
}
