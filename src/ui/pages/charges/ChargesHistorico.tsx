import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, FolderOpen } from 'lucide-react';
import { buscarChargesHistorico, duplicarChargeHistorico } from './chargesDidaticasData';
import type { AtividadeCharge } from './tiposCharges';

export function ChargesHistorico() {
  const navigate = useNavigate();
  const [atividades, setAtividades] = useState<AtividadeCharge[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    buscarChargesHistorico()
      .then(setAtividades)
      .catch(e => setErro(`Erro ao carregar histórico: ${(e as Error).message}`))
      .finally(() => setCarregando(false));
  }

  useEffect(() => { carregar(); }, []);

  async function handleDuplicar(id: string) {
    setDuplicandoId(id);
    try {
      await duplicarChargeHistorico(id);
      carregar();
    } catch (e) {
      setErro(`Erro ao duplicar: ${(e as Error).message}`);
    } finally {
      setDuplicandoId(null);
    }
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/ia/charges')} className="p-1 rounded-lg text-on-surface-variant">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-on-surface">Histórico de Charges</h1>
      </div>

      {erro && <div className="bg-error-container text-on-error-container text-xs px-3 py-2 rounded-xl">{erro}</div>}

      {carregando ? (
        <p className="text-sm text-on-surface-variant">Carregando...</p>
      ) : atividades.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhuma charge salva ainda.</p>
      ) : (
        <div className="space-y-3">
          {atividades.map(atividade => (
            <div key={atividade.id} className="bg-surface border border-outline-variant rounded-2xl p-4 space-y-2">
              <p className="text-sm font-bold text-on-surface">{atividade.roteiro.tituloRoteiro || 'Charge sem título'}</p>
              <p className="text-xs text-on-surface-variant">
                {atividade.parametros.anoEscolar}º ano · {atividade.parametros.conteudo} · {atividade.parametros.numeroQuadros} quadro(s)
              </p>
              <p className="text-[11px] text-on-surface-variant">{new Date(atividade.criadoEm).toLocaleDateString('pt-BR')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/ia/charges?id=${atividade.id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Abrir
                </button>
                <button
                  onClick={() => handleDuplicar(atividade.id)}
                  disabled={duplicandoId === atividade.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold disabled:opacity-60"
                >
                  <Copy className="w-3.5 h-3.5" /> {duplicandoId === atividade.id ? 'Duplicando...' : 'Duplicar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
