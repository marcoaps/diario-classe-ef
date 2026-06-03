import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';

// ── Tipos ────────────────────────────────────────────────────────────────────
const DISCIPLINAS = [
  'L. Portuguesa', 'Arte', 'E. Física', 'L. Inglesa', 'L. Espanhola',
  'Matemática', 'Ciências', 'Geografia', 'História', 'Religião',
] as const;

type Disciplina = typeof DISCIPLINAS[number];

interface TurmaData {
  serie: string;
  total: number;
  trans: string;
  freq: number;
  reprovados: Record<Disciplina, number>;
  recuperados: Record<Disciplina, number>;
}

interface GrupoData {
  nome: string;
  turmas: TurmaData[];
}

// ── Dados iniciais ────────────────────────────────────────────────────────────
const makeVazio = (): Record<Disciplina, number> =>
  Object.fromEntries(DISCIPLINAS.map(d => [d, 0])) as Record<Disciplina, number>;

const GRUPOS_INICIAIS: GrupoData[] = [
  {
    nome: '6º ANO',
    turmas: [
      { serie: '6º A', total: 36, trans: '-', freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6º B', total: 35, trans: '-', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6º C', total: 37, trans: '1', freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6º D', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6º E', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6º F', total: 25, trans: '1', freq: 24, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
  {
    nome: '7º ANO',
    turmas: [
      { serie: '7º A', total: 35, trans: '-', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7º B', total: 35, trans: '-', freq: 34, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7º C', total: 35, trans: '-', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7º D', total: 26, trans: '-', freq: 26, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7º E', total: 26, trans: '-', freq: 26, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7º F', total: 26, trans: '-', freq: 26, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
  {
    nome: '8º ANO',
    turmas: [
      { serie: '8º A', total: 36, trans: '-',  freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8º B', total: 36, trans: '-',  freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8º C', total: 34, trans: '+1', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8º D', total: 30, trans: '-',  freq: 30, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8º E', total: 25, trans: '+3', freq: 28, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8º F', total: 28, trans: '-',  freq: 28, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
  {
    nome: '9º ANO',
    turmas: [
      { serie: '9º A', total: 34, trans: '-', freq: 34, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9º B', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9º C', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9º D', total: 34, trans: '-', freq: 34, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9º E', total: 34, trans: '2', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
];

const BIMESTRES = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'];

const COR_GRUPO: Record<string, string> = {
  '6º ANO': '#1e3a5f',
  '7º ANO': '#1a3a2a',
  '8º ANO': '#3a1a00',
  '9º ANO': '#2a1a3a',
};

// ── Componente principal ──────────────────────────────────────────────────────
export function RendimentoBimestre() {
  const [bimestre, setBimestre] = useState(0);
  const [grupos, setGrupos] = useState<GrupoData[][]>(
    BIMESTRES.map(() => JSON.parse(JSON.stringify(GRUPOS_INICIAIS)))
  );
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const dadosAtivos = grupos[bimestre];

  // ── Atualiza valor ──────────────────────────────────────────────────────────
  const atualizar = (
    tipo: 'reprovados' | 'recuperados',
    grupoIdx: number,
    turmaIdx: number,
    disc: Disciplina,
    valor: number
  ) => {
    setGrupos(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const turma = clone[bimestre][grupoIdx].turmas[turmaIdx];
      const rep = turma.reprovados[disc];
      if (tipo === 'reprovados') {
        turma.reprovados[disc] = Math.max(0, Math.min(turma.freq, valor));
        // Ajusta recuperados se necessário
        if (turma.recuperados[disc] > turma.reprovados[disc]) {
          turma.recuperados[disc] = turma.reprovados[disc];
        }
      } else {
        turma.recuperados[disc] = Math.max(0, Math.min(rep, valor));
      }
      return clone;
    });
  };

  const atualTrans = (grupoIdx: number, turmaIdx: number, valor: string) => {
    setGrupos(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[bimestre][grupoIdx].turmas[turmaIdx].trans = valor;
      return clone;
    });
  };

  // ── Totais por grupo ────────────────────────────────────────────────────────
  const totaisGrupo = (turmas: TurmaData[], disc: Disciplina) => {
    const rep = turmas.reduce((s, t) => s + (t.reprovados[disc] || 0), 0);
    const apr = turmas.reduce((s, t) => s + (t.freq - (t.reprovados[disc] || 0)), 0);
    const rec = turmas.reduce((s, t) => s + (t.recuperados[disc] || 0), 0);
    return { rep, apr, rec };
  };

  const totaisGeral = (disc: Disciplina) => {
    const rep = dadosAtivos.flatMap(g => g.turmas).reduce((s, t) => s + (t.reprovados[disc] || 0), 0);
    const apr = dadosAtivos.flatMap(g => g.turmas).reduce((s, t) => s + (t.freq - (t.reprovados[disc] || 0)), 0);
    const rec = dadosAtivos.flatMap(g => g.turmas).reduce((s, t) => s + (t.recuperados[disc] || 0), 0);
    return { rep, apr, rec };
  };

  // ── Painel resumo por série ─────────────────────────────────────────────────
  const resumoSerie = (turmas: TurmaData[]) => {
    const totalAlunos = turmas.reduce((s, t) => s + t.total, 0);
    const totalFreq = turmas.reduce((s, t) => s + t.freq, 0);
    const totalRep = DISCIPLINAS.reduce((s, d) =>
      s + turmas.reduce((ss, t) => ss + (t.reprovados[d] || 0), 0), 0);
    const totalApr = DISCIPLINAS.reduce((s, d) =>
      s + turmas.reduce((ss, t) => ss + (t.freq - (t.reprovados[d] || 0)), 0), 0);
    const totalRec = DISCIPLINAS.reduce((s, d) =>
      s + turmas.reduce((ss, t) => ss + (t.recuperados[d] || 0), 0), 0);
    const pct = totalApr + totalRep > 0
      ? Math.round(totalApr / (totalApr + totalRep) * 100)
      : 100;
    return { totalAlunos, totalFreq, totalRep, totalApr, totalRec, pct };
  };

  // ── Exportar Excel ──────────────────────────────────────────────────────────
  const exportarExcel = () => {
    setExportando(true);
    try {
      const wb = XLSX.utils.book_new();
      const dados: any[][] = [
        ['Escola Estadual Instituto Odilon Pratagi'],
        [`Resultado do ${BIMESTRES[bimestre]} – ENSINO FUNDAMENTAL 2026`],
        [],
        ['Ano/Série', 'Total', 'Trans.', 'Freq.', ...DISCIPLINAS.flatMap(d => [d + ' Rep', d + ' Apr'])],
      ];
      dadosAtivos.forEach(grupo => {
        dados.push([grupo.nome]);
        grupo.turmas.forEach(t => {
          dados.push([
            t.serie, t.total, t.trans, t.freq,
            ...DISCIPLINAS.flatMap(d => [
              t.reprovados[d] || 0,
              t.freq - (t.reprovados[d] || 0),
            ]),
          ]);
          dados.push([
            `↳ Rec. ${t.serie}`, '', '', '',
            ...DISCIPLINAS.flatMap(d => [t.recuperados[d] || 0, '']),
          ]);
        });
        const tRep = DISCIPLINAS.flatMap(d => {
          const r = grupo.turmas.reduce((s, t) => s + (t.reprovados[d] || 0), 0);
          const a = grupo.turmas.reduce((s, t) => s + (t.freq - (t.reprovados[d] || 0)), 0);
          return [r, a];
        });
        dados.push(['Total Reprovados', '', '', '', ...tRep]);
      });
      const ws = XLSX.utils.aoa_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, ws, BIMESTRES[bimestre]);
      XLSX.writeFile(wb, `Rendimento_${BIMESTRES[bimestre].replace(/\s/g,'_')}_2026.xlsx`);
    } finally {
      setExportando(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const gruposFiltrados = abaAtiva
    ? dadosAtivos.filter(g => g.nome === abaAtiva)
    : dadosAtivos;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1b2a', color: '#e8eaf6', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#0a3055', padding: '16px 24px', borderBottom: '2px solid #1565c0' }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e8eaf6' }}>
          Escola Estadual Instituto Odilon Pratagi
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#90caf9' }}>
          Resultado do {BIMESTRES[bimestre]} – Ensino Fundamental – 2026
        </p>
      </div>

      {/* Controles */}
      <div style={{ background: '#162032', padding: '12px 24px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #1e3a5f' }}>
        <span style={{ fontSize: 13, color: '#90caf9', fontWeight: 600 }}>Bimestre:</span>
        {BIMESTRES.map((b, i) => (
          <button key={b} onClick={() => setBimestre(i)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: bimestre === i ? '#1565c0' : '#1e3a5f',
              color: '#e8eaf6', fontWeight: bimestre === i ? 700 : 400, fontSize: 13,
              transition: 'all 0.2s',
            }}>
            {b}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={exportarExcel} disabled={exportando}
          style={{
            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: '#2e7d32', color: '#fff', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          📊 {exportando ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      {/* Painel resumo por série */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '16px 24px' }}>
        {dadosAtivos.map(grupo => {
          const r = resumoSerie(grupo.turmas);
          return (
            <div key={grupo.nome} style={{
              background: '#162032', borderRadius: 10, padding: '14px 16px',
              border: `1px solid ${COR_GRUPO[grupo.nome] || '#1e3a5f'}`,
              cursor: 'pointer',
              outline: abaAtiva === grupo.nome ? '2px solid #2196f3' : 'none',
            }} onClick={() => setAbaAtiva(abaAtiva === grupo.nome ? null : grupo.nome)}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#90caf9', marginBottom: 10 }}>{grupo.nome}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: 12 }}>
                <span style={{ color: '#78909c' }}>Total</span>
                <span style={{ fontWeight: 700, color: '#e8eaf6' }}>{r.totalAlunos}</span>
                <span style={{ color: '#78909c' }}>Freq.</span>
                <span style={{ fontWeight: 700, color: '#e8eaf6' }}>{r.totalFreq}</span>
                <span style={{ color: '#78909c' }}>% Aprov.</span>
                <span style={{ fontWeight: 700, color: r.pct >= 75 ? '#66bb6a' : '#ef5350' }}>{r.pct}%</span>
                <span style={{ color: '#78909c' }}>Reprov.</span>
                <span style={{ fontWeight: 700, color: '#ef5350' }}>{r.totalRep}</span>
                <span style={{ color: '#78909c' }}>Aprov.</span>
                <span style={{ fontWeight: 700, color: '#66bb6a' }}>{r.totalApr}</span>
                <span style={{ color: '#78909c' }}>Recup.</span>
                <span style={{ fontWeight: 700, color: '#ffa726' }}>{r.totalRec}</span>
              </div>
            </div>
          );
        })}
      </div>

      {abaAtiva && (
        <div style={{ padding: '0 24px 8px', fontSize: 13, color: '#90caf9' }}>
          Filtrando: <strong style={{ color: '#2196f3' }}>{abaAtiva}</strong>
          <button onClick={() => setAbaAtiva(null)} style={{
            marginLeft: 10, padding: '2px 8px', borderRadius: 4, border: 'none',
            background: '#1e3a5f', color: '#90caf9', cursor: 'pointer', fontSize: 12,
          }}>✕ Ver todos</button>
        </div>
      )}

      {/* Tabela principal */}
      <div style={{ padding: '0 24px 40px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1200 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={thStyle}>Turma</th>
              <th rowSpan={2} style={thStyle}>Total</th>
              <th rowSpan={2} style={thStyle}>Trans.</th>
              <th rowSpan={2} style={thStyle}>Freq.</th>
              {DISCIPLINAS.map(d => (
                <th key={d} colSpan={2} style={{ ...thStyle, background: '#0a3055', fontSize: 11 }}>{d}</th>
              ))}
            </tr>
            <tr>
              {DISCIPLINAS.flatMap(d => [
                <th key={d + 'r'} style={{ ...thStyle, background: '#7b1a1a', fontSize: 11 }}>Rep.</th>,
                <th key={d + 'a'} style={{ ...thStyle, background: '#1b5e20', fontSize: 11 }}>Apr.</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {gruposFiltrados.map((grupo, gi) => {
              const realGi = dadosAtivos.indexOf(grupo);
              return (
                <React.Fragment key={grupo.nome}>
                  {/* Header do grupo */}
                  <tr>
                    <td colSpan={4 + DISCIPLINAS.length * 2} style={{
                      background: COR_GRUPO[grupo.nome] || '#1e3a5f',
                      color: '#e8eaf6', fontWeight: 700, fontSize: 13,
                      padding: '8px 12px', borderBottom: '1px solid #2196f3',
                    }}>
                      {grupo.nome}
                    </td>
                  </tr>

                  {/* Turmas */}
                  {grupo.turmas.map((turma, ti) => (
                    <React.Fragment key={turma.serie}>
                      {/* Linha Reprovados */}
                      <tr style={{ background: ti % 2 === 0 ? '#111e2e' : '#0f1a28' }}>
                        <td style={tdStyle}><strong>{turma.serie}</strong></td>
                        <td style={tdStyle}>{turma.total}</td>
                        <td style={{ ...tdStyle, padding: 2 }}>
                          <input
                            value={turma.trans}
                            onChange={e => atualTrans(realGi, ti, e.target.value)}
                            style={{ width: 40, background: '#1e3a5f', border: '1px solid #2196f3', borderRadius: 3, color: '#e8eaf6', textAlign: 'center', fontSize: 12, padding: '2px 4px' }}
                          />
                        </td>
                        <td style={tdStyle}>{turma.freq}</td>
                        {DISCIPLINAS.flatMap(d => {
                          const rep = turma.reprovados[d] || 0;
                          const apr = turma.freq - rep;
                          const alerta = rep > 5;
                          return [
                            <td key={d + 'r'} style={{ ...tdStyle, padding: 2 }}>
                              <input
                                type="number" min={0} max={turma.freq}
                                value={rep}
                                onChange={e => atualizar('reprovados', realGi, ti, d, +e.target.value)}
                                style={{
                                  width: 44, textAlign: 'center', fontSize: 12,
                                  background: alerta ? '#4a0000' : '#1a0a0a',
                                  border: `1px solid ${alerta ? '#ef5350' : '#7b1a1a'}`,
                                  borderRadius: 4, color: alerta ? '#ff8a80' : '#ef9a9a',
                                  padding: '3px 2px', fontWeight: 700,
                                }}
                              />
                            </td>,
                            <td key={d + 'a'} style={{ ...tdStyle, color: '#66bb6a', fontWeight: 700 }}>
                              {apr}
                            </td>,
                          ];
                        })}
                      </tr>

                      {/* Linha Recuperados */}
                      <tr style={{ background: '#0f1500' }}>
                        <td colSpan={4} style={{ ...tdStyle, color: '#ffa726', fontSize: 11, fontStyle: 'italic', paddingLeft: 20 }}>
                          ↳ Rec. {turma.serie}
                        </td>
                        {DISCIPLINAS.flatMap(d => {
                          const rep = turma.reprovados[d] || 0;
                          const rec = turma.recuperados[d] || 0;
                          return [
                            <td key={d + 'rec'} style={{ ...tdStyle, padding: 2 }}>
                              <input
                                type="number" min={0} max={rep}
                                value={rec}
                                onChange={e => atualizar('recuperados', realGi, ti, d, +e.target.value)}
                                style={{
                                  width: 44, textAlign: 'center', fontSize: 12,
                                  background: '#1a0f00', border: '1px solid #bf360c',
                                  borderRadius: 4, color: '#ffa726', padding: '3px 2px', fontWeight: 700,
                                }}
                              />
                            </td>,
                            <td key={d + 'reca'} style={{ ...tdStyle, background: '#0a0800' }} />,
                          ];
                        })}
                      </tr>
                    </React.Fragment>
                  ))}

                  {/* Total Reprovados */}
                  <tr style={{ background: '#3b0000' }}>
                    <td colSpan={4} style={{ ...tdStyle, color: '#ef5350', fontWeight: 700, paddingLeft: 12 }}>
                      Total Reprovados
                    </td>
                    {DISCIPLINAS.flatMap(d => {
                      const { rep, apr } = totaisGrupo(grupo.turmas, d);
                      return [
                        <td key={d + 'tr'} style={{ ...tdStyle, color: '#ef5350', fontWeight: 700 }}>{rep}</td>,
                        <td key={d + 'ta'} style={{ ...tdStyle, color: '#66bb6a', fontWeight: 700 }}>{apr}</td>,
                      ];
                    })}
                  </tr>

                  {/* Total Recuperados */}
                  <tr style={{ background: '#1a0a00' }}>
                    <td colSpan={4} style={{ ...tdStyle, color: '#ffa726', fontWeight: 700, paddingLeft: 12 }}>
                      Total Recuperados
                    </td>
                    {DISCIPLINAS.flatMap(d => {
                      const { rec } = totaisGrupo(grupo.turmas, d);
                      return [
                        <td key={d + 'rec'} style={{ ...tdStyle, color: '#ffa726', fontWeight: 700 }}>{rec}</td>,
                        <td key={d + 'reca'} style={{ ...tdStyle, background: '#0f0800' }} />,
                      ];
                    })}
                  </tr>

                  <tr><td colSpan={4 + DISCIPLINAS.length * 2} style={{ height: 8, background: '#0d1b2a' }} /></tr>
                </React.Fragment>
              );
            })}

            {/* Total Geral */}
            {!abaAtiva && (
              <>
                <tr style={{ background: '#1a0000' }}>
                  <td colSpan={4} style={{ ...tdStyle, color: '#ef5350', fontWeight: 700, fontSize: 13, paddingLeft: 12 }}>
                    TOTAL GERAL – Reprovados
                  </td>
                  {DISCIPLINAS.flatMap(d => {
                    const { rep, apr } = totaisGeral(d);
                    return [
                      <td key={d + 'tgr'} style={{ ...tdStyle, color: '#ef5350', fontWeight: 700 }}>{rep}</td>,
                      <td key={d + 'tga'} style={{ ...tdStyle, color: '#66bb6a', fontWeight: 700 }}>{apr}</td>,
                    ];
                  })}
                </tr>
                <tr style={{ background: '#001a00' }}>
                  <td colSpan={4} style={{ ...tdStyle, color: '#66bb6a', fontWeight: 700, fontSize: 13, paddingLeft: 12 }}>
                    TOTAL GERAL – Recuperados
                  </td>
                  {DISCIPLINAS.flatMap(d => {
                    const { rec } = totaisGeral(d);
                    return [
                      <td key={d + 'tgrec'} style={{ ...tdStyle, color: '#ffa726', fontWeight: 700 }}>{rec}</td>,
                      <td key={d + 'tgreca'} style={{ ...tdStyle, background: '#000f00' }} />,
                    ];
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Rodapé */}
        <div style={{ marginTop: 24, background: '#162032', borderRadius: 10, padding: '16px 20px', fontSize: 13, color: '#90caf9', border: '1px solid #1e3a5f' }}>
          <strong style={{ color: '#e8eaf6' }}>Observações:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Os alunos transferidos com nota no 1º bimestre são contados apenas do 2º bimestre.</li>
            <li>Total geral: <strong style={{ color: '#e8eaf6' }}>754</strong> alunos &nbsp;|&nbsp; Transferidos: <strong style={{ color: '#e8eaf6' }}>04</strong> &nbsp;|&nbsp; Recebidos: <strong style={{ color: '#e8eaf6' }}>04</strong> &nbsp;|&nbsp; Frequentando: <strong style={{ color: '#e8eaf6' }}>754</strong></li>
            <li>Células vermelhas intensas indicam mais de 5 reprovados na disciplina.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Estilos base ──────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  background: '#0a3055',
  color: '#e8eaf6',
  padding: '8px 6px',
  border: '1px solid #1e3a5f',
  fontWeight: 700,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 2,
};

const tdStyle: React.CSSProperties = {
  padding: '5px 6px',
  border: '1px solid #1e3a5f',
  textAlign: 'center',
  color: '#e8eaf6',
};
