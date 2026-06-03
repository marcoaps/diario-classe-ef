import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

const DISCIPLINAS = [
  'L. Portuguesa', 'Arte', 'E. Fisica', 'L. Inglesa', 'L. Espanhola',
  'Matematica', 'Ciencias', 'Geografia', 'Historia', 'Religiao',
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

const STORAGE_KEY = 'rendimento_ef_2026';

const makeVazio = (): Record<Disciplina, number> =>
  Object.fromEntries(DISCIPLINAS.map(d => [d, 0])) as Record<Disciplina, number>;

const GRUPOS_INICIAIS: GrupoData[] = [
  {
    nome: '6 ANO',
    turmas: [
      { serie: '6 A', total: 36, trans: '-', freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6 B', total: 35, trans: '-', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6 C', total: 37, trans: '1', freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6 D', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6 E', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '6 F', total: 25, trans: '1', freq: 24, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
  {
    nome: '7 ANO',
    turmas: [
      { serie: '7 A', total: 35, trans: '-', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7 B', total: 35, trans: '-', freq: 34, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7 C', total: 35, trans: '-', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7 D', total: 26, trans: '-', freq: 26, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7 E', total: 26, trans: '-', freq: 26, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '7 F', total: 26, trans: '-', freq: 26, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
  {
    nome: '8 ANO',
    turmas: [
      { serie: '8 A', total: 36, trans: '-',  freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8 B', total: 36, trans: '-',  freq: 36, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8 C', total: 34, trans: '+1', freq: 35, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8 D', total: 30, trans: '-',  freq: 30, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8 E', total: 25, trans: '+3', freq: 28, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '8 F', total: 28, trans: '-',  freq: 28, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
  {
    nome: '9 ANO',
    turmas: [
      { serie: '9 A', total: 34, trans: '-', freq: 34, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9 B', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9 C', total: 32, trans: '-', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9 D', total: 34, trans: '-', freq: 34, reprovados: makeVazio(), recuperados: makeVazio() },
      { serie: '9 E', total: 34, trans: '2', freq: 32, reprovados: makeVazio(), recuperados: makeVazio() },
    ],
  },
];

const BIMESTRES = ['1 Bimestre', '2 Bimestre', '3 Bimestre', '4 Bimestre'];

const COR_GRUPO: Record<string, string> = {
  '6 ANO': '#1e3a5f',
  '7 ANO': '#1a3a2a',
  '8 ANO': '#3a1a00',
  '9 ANO': '#2a1a3a',
};

function carregarDados(): GrupoData[][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return BIMESTRES.map(() => JSON.parse(JSON.stringify(GRUPOS_INICIAIS)));
}

function TelaCelular() {
  return (
    <div style={{
      minHeight: '100vh', background: '#0d1b2a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center', fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>&#128421;</div>
      <h2 style={{ color: '#e8eaf6', fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Disponivel apenas no computador
      </h2>
      <p style={{ color: '#90caf9', fontSize: 15, lineHeight: 1.6, maxWidth: 320, marginBottom: 24 }}>
        A pagina de <strong style={{ color: '#e8eaf6' }}>Resultado do Bimestre</strong> contem
        uma tabela extensa. Para melhor visualizacao e edicao, acesse pelo computador.
      </p>
      <div style={{
        background: '#162032', border: '1px solid #1565c0',
        borderRadius: 12, padding: '16px 24px',
        color: '#90caf9', fontSize: 13, lineHeight: 1.8,
      }}>
        <div>&#127760; <strong style={{ color: '#e8eaf6' }}>www.diarioiop.com.br</strong></div>
        <div style={{ marginTop: 6 }}>Menu &#8594; <strong style={{ color: '#e8eaf6' }}>Rendimento</strong></div>
      </div>
    </div>
  );
}

export function RendimentoBimestre() {
  const [isMobile, setIsMobile] = useState(false);
  const [bimestre, setBimestre] = useState(0);
  const [grupos, setGrupos] = useState<GrupoData[][]>(carregarDados);
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ultimoSalvo, setUltimoSalvo] = useState<string | null>(null);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 1024 ||
        /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Carrega timestamp do ultimo salvo
  useEffect(() => {
    const ts = localStorage.getItem(STORAGE_KEY + '_ts');
    if (ts) setUltimoSalvo(ts);
  }, []);

  // Auto-save a cada 30 segundos se houver alteracoes
  useEffect(() => {
    if (!alterado) return;
    const timer = setTimeout(() => {
      salvar(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, [grupos, alterado]);

  const salvar = useCallback((auto = false) => {
    setSalvando(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(grupos));
      const agora = new Date().toLocaleString('pt-BR');
      localStorage.setItem(STORAGE_KEY + '_ts', agora);
      setUltimoSalvo(agora);
      setAlterado(false);
      if (!auto) {
        // Feedback visual rapido
        setTimeout(() => setSalvando(false), 800);
      } else {
        setSalvando(false);
      }
    } catch {
      setSalvando(false);
    }
  }, [grupos]);

  const limpar = () => {
    if (!confirm('Limpar todos os dados? Esta acao nao pode ser desfeita.')) return;
    const zerado = BIMESTRES.map(() => JSON.parse(JSON.stringify(GRUPOS_INICIAIS)));
    setGrupos(zerado);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + '_ts');
    setUltimoSalvo(null);
    setAlterado(false);
  };

  if (isMobile) return <TelaCelular />;

  const dadosAtivos = grupos[bimestre];

  const atualizar = (tipo: 'reprovados' | 'recuperados', gi: number, ti: number, disc: Disciplina, valor: number) => {
    setGrupos(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      const turma = clone[bimestre][gi].turmas[ti];
      if (tipo === 'reprovados') {
        turma.reprovados[disc] = Math.max(0, Math.min(turma.freq, valor));
        if (turma.recuperados[disc] > turma.reprovados[disc])
          turma.recuperados[disc] = turma.reprovados[disc];
      } else {
        turma.recuperados[disc] = Math.max(0, Math.min(turma.reprovados[disc], valor));
      }
      return clone;
    });
    setAlterado(true);
  };

  const atualTrans = (gi: number, ti: number, valor: string) => {
    setGrupos(prev => {
      const clone = JSON.parse(JSON.stringify(prev));
      clone[bimestre][gi].turmas[ti].trans = valor;
      return clone;
    });
    setAlterado(true);
  };

  const totaisGrupo = (turmas: TurmaData[], disc: Disciplina) => ({
    rep: turmas.reduce((s, t) => s + (t.reprovados[disc] || 0), 0),
    apr: turmas.reduce((s, t) => s + (t.freq - (t.reprovados[disc] || 0)), 0),
    rec: turmas.reduce((s, t) => s + (t.recuperados[disc] || 0), 0),
  });

  const totaisGeral = (disc: Disciplina) => ({
    rep: dadosAtivos.flatMap(g => g.turmas).reduce((s, t) => s + (t.reprovados[disc] || 0), 0),
    apr: dadosAtivos.flatMap(g => g.turmas).reduce((s, t) => s + (t.freq - (t.reprovados[disc] || 0)), 0),
    rec: dadosAtivos.flatMap(g => g.turmas).reduce((s, t) => s + (t.recuperados[disc] || 0), 0),
  });

  const resumoSerie = (turmas: TurmaData[]) => {
    const totalAlunos = turmas.reduce((s, t) => s + t.total, 0);
    const totalFreq = turmas.reduce((s, t) => s + t.freq, 0);
    const totalRep = DISCIPLINAS.reduce((s, d) => s + turmas.reduce((ss, t) => ss + (t.reprovados[d] || 0), 0), 0);
    const totalApr = DISCIPLINAS.reduce((s, d) => s + turmas.reduce((ss, t) => ss + (t.freq - (t.reprovados[d] || 0)), 0), 0);
    const totalRec = DISCIPLINAS.reduce((s, d) => s + turmas.reduce((ss, t) => ss + (t.recuperados[d] || 0), 0), 0);
    const pct = totalApr + totalRep > 0 ? Math.round(totalApr / (totalApr + totalRep) * 100) : 100;
    return { totalAlunos, totalFreq, totalRep, totalApr, totalRec, pct };
  };

  const exportarExcel = () => {
    setExportando(true);
    try {
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        ['Escola Estadual Instituto Odilon Pratagi'],
        ['Resultado do ' + BIMESTRES[bimestre] + ' - ENSINO FUNDAMENTAL 2026'],
        [],
        ['Ano/Serie', 'Total', 'Trans.', 'Freq.', ...DISCIPLINAS.flatMap(d => [d + ' Rep', d + ' Apr'])],
      ];
      dadosAtivos.forEach(grupo => {
        rows.push([grupo.nome]);
        grupo.turmas.forEach(t => {
          rows.push([t.serie, t.total, t.trans, t.freq,
            ...DISCIPLINAS.flatMap(d => [t.reprovados[d] || 0, t.freq - (t.reprovados[d] || 0)])]);
          rows.push(['Rec. ' + t.serie, '', '', '',
            ...DISCIPLINAS.flatMap(d => [t.recuperados[d] || 0, ''])]);
        });
        rows.push(['Total Reprovados', '', '', '',
          ...DISCIPLINAS.flatMap(d => [
            grupo.turmas.reduce((s, t) => s + (t.reprovados[d] || 0), 0),
            grupo.turmas.reduce((s, t) => s + (t.freq - (t.reprovados[d] || 0)), 0),
          ])]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, BIMESTRES[bimestre]);
      XLSX.writeFile(wb, 'Rendimento_' + BIMESTRES[bimestre].replace(/\s/g, '_') + '_2026.xlsx');
    } finally { setExportando(false); }
  };

  const gruposFiltrados = abaAtiva ? dadosAtivos.filter(g => g.nome === abaAtiva) : dadosAtivos;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0d1b2a', color: '#e8eaf6',
      fontFamily: 'Arial, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', zIndex: 50,
    }}>
      {/* Header */}
      <div style={{ background: '#0a3055', padding: '10px 24px', borderBottom: '2px solid #1565c0', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#e8eaf6' }}>
          Escola Estadual Instituto Odilon Pratagi
        </h1>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#90caf9' }}>
          Resultado do {BIMESTRES[bimestre]} - Ensino Fundamental - 2026
        </p>
      </div>

      {/* Controles */}
      <div style={{ background: '#162032', padding: '8px 24px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #1e3a5f', flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: '#90caf9', fontWeight: 600 }}>Bimestre:</span>
        {BIMESTRES.map((b, i) => (
          <button key={b} onClick={() => setBimestre(i)} style={{
            padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: bimestre === i ? '#1565c0' : '#1e3a5f',
            color: '#e8eaf6', fontWeight: bimestre === i ? 700 : 400, fontSize: 12,
          }}>{b}</button>
        ))}
        <div style={{ flex: 1 }} />

        {/* Status de salvamento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#78909c' }}>
          {alterado && <span style={{ color: '#ffa726' }}>&#9679; Alteracoes nao salvas</span>}
          {!alterado && ultimoSalvo && <span style={{ color: '#66bb6a' }}>&#10003; Salvo em {ultimoSalvo}</span>}
        </div>

        {/* Botao Salvar */}
        <button onClick={() => salvar(false)} disabled={salvando || !alterado}
          style={{
            padding: '5px 14px', borderRadius: 6, border: 'none', cursor: alterado ? 'pointer' : 'default',
            background: salvando ? '#1b5e20' : alterado ? '#2e7d32' : '#1e3a5f',
            color: '#fff', fontWeight: 600, fontSize: 12,
            opacity: !alterado && !salvando ? 0.5 : 1,
            transition: 'all 0.2s',
          }}>
          {salvando ? '&#10003; Salvo!' : 'Salvar'}
        </button>

        <button onClick={exportarExcel} disabled={exportando} style={{
          padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: '#1565c0', color: '#fff', fontWeight: 600, fontSize: 12,
        }}>
          {exportando ? 'Exportando...' : 'Exportar Excel'}
        </button>

        <button onClick={limpar} style={{
          padding: '5px 12px', borderRadius: 6, border: '1px solid #7b1a1a', cursor: 'pointer',
          background: 'transparent', color: '#ef5350', fontWeight: 600, fontSize: 12,
        }}>
          Limpar
        </button>
      </div>

      {/* Painel resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, padding: '10px 24px', flexShrink: 0 }}>
        {dadosAtivos.map(grupo => {
          const r = resumoSerie(grupo.turmas);
          return (
            <div key={grupo.nome} onClick={() => setAbaAtiva(abaAtiva === grupo.nome ? null : grupo.nome)}
              style={{
                background: '#162032', borderRadius: 8, padding: '10px 14px',
                border: '1px solid ' + (COR_GRUPO[grupo.nome] || '#1e3a5f'),
                cursor: 'pointer', outline: abaAtiva === grupo.nome ? '2px solid #2196f3' : 'none',
              }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#90caf9', marginBottom: 6 }}>{grupo.nome}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', fontSize: 11 }}>
                <span style={{ color: '#78909c' }}>Total</span><span style={{ fontWeight: 700 }}>{r.totalAlunos}</span>
                <span style={{ color: '#78909c' }}>Freq.</span><span style={{ fontWeight: 700 }}>{r.totalFreq}</span>
                <span style={{ color: '#78909c' }}>% Aprov.</span><span style={{ fontWeight: 700, color: r.pct >= 75 ? '#66bb6a' : '#ef5350' }}>{r.pct}%</span>
                <span style={{ color: '#78909c' }}>Reprov.</span><span style={{ fontWeight: 700, color: '#ef5350' }}>{r.totalRep}</span>
                <span style={{ color: '#78909c' }}>Recup.</span><span style={{ fontWeight: 700, color: '#ffa726' }}>{r.totalRec}</span>
              </div>
            </div>
          );
        })}
      </div>

      {abaAtiva && (
        <div style={{ padding: '0 24px 6px', fontSize: 12, color: '#90caf9', flexShrink: 0 }}>
          Filtrando: <strong style={{ color: '#2196f3' }}>{abaAtiva}</strong>
          <button onClick={() => setAbaAtiva(null)} style={{
            marginLeft: 8, padding: '1px 7px', borderRadius: 4, border: 'none',
            background: '#1e3a5f', color: '#90caf9', cursor: 'pointer', fontSize: 11,
          }}>x Ver todos</button>
        </div>
      )}

      {/* Tabela com scroll */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 1200 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th rowSpan={2} style={th}>Turma</th>
              <th rowSpan={2} style={th}>Total</th>
              <th rowSpan={2} style={th}>Trans.</th>
              <th rowSpan={2} style={th}>Freq.</th>
              {DISCIPLINAS.map(d => (
                <th key={d} colSpan={2} style={{ ...th, background: '#0a3055', fontSize: 10 }}>{d}</th>
              ))}
            </tr>
            <tr>
              {DISCIPLINAS.flatMap(d => [
                <th key={d+'r'} style={{ ...th, background: '#7b1a1a', fontSize: 10 }}>Rep.</th>,
                <th key={d+'a'} style={{ ...th, background: '#1b5e20', fontSize: 10 }}>Apr.</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {gruposFiltrados.map(grupo => {
              const gi = dadosAtivos.indexOf(grupo);
              return (
                <React.Fragment key={grupo.nome}>
                  <tr>
                    <td colSpan={4 + DISCIPLINAS.length * 2} style={{
                      background: COR_GRUPO[grupo.nome] || '#1e3a5f',
                      color: '#e8eaf6', fontWeight: 700, fontSize: 12,
                      padding: '6px 12px', borderBottom: '1px solid #2196f3',
                    }}>{grupo.nome}</td>
                  </tr>
                  {grupo.turmas.map((turma, ti) => (
                    <React.Fragment key={turma.serie}>
                      <tr style={{ background: ti % 2 === 0 ? '#111e2e' : '#0f1a28' }}>
                        <td style={td}><strong>{turma.serie}</strong></td>
                        <td style={td}>{turma.total}</td>
                        <td style={{ ...td, padding: 2 }}>
                          <input value={turma.trans} onChange={e => atualTrans(gi, ti, e.target.value)}
                            style={{ width: 36, background: '#1e3a5f', border: '1px solid #2196f3', borderRadius: 3, color: '#e8eaf6', textAlign: 'center', fontSize: 11, padding: '1px 3px' }} />
                        </td>
                        <td style={td}>{turma.freq}</td>
                        {DISCIPLINAS.flatMap(d => {
                          const rep = turma.reprovados[d] || 0;
                          const apr = turma.freq - rep;
                          const alerta = rep > 5;
                          return [
                            <td key={d+'r'} style={{ ...td, padding: 2 }}>
                              <input type="number" min={0} max={turma.freq} value={rep}
                                onChange={e => atualizar('reprovados', gi, ti, d, +e.target.value)}
                                style={{
                                  width: 40, textAlign: 'center', fontSize: 11,
                                  background: alerta ? '#4a0000' : '#1a0a0a',
                                  border: '1px solid ' + (alerta ? '#ef5350' : '#7b1a1a'),
                                  borderRadius: 3, color: alerta ? '#ff8a80' : '#ef9a9a',
                                  padding: '2px 1px', fontWeight: 700,
                                }} />
                            </td>,
                            <td key={d+'a'} style={{ ...td, color: '#66bb6a', fontWeight: 700 }}>{apr}</td>,
                          ];
                        })}
                      </tr>
                      <tr style={{ background: '#0f1500' }}>
                        <td colSpan={4} style={{ ...td, color: '#ffa726', fontSize: 10, fontStyle: 'italic', paddingLeft: 16 }}>
                          Rec. {turma.serie}
                        </td>
                        {DISCIPLINAS.flatMap(d => {
                          const rep = turma.reprovados[d] || 0;
                          const rec = turma.recuperados[d] || 0;
                          return [
                            <td key={d+'rec'} style={{ ...td, padding: 2 }}>
                              <input type="number" min={0} max={rep} value={rec}
                                onChange={e => atualizar('recuperados', gi, ti, d, +e.target.value)}
                                style={{
                                  width: 40, textAlign: 'center', fontSize: 11,
                                  background: '#1a0f00', border: '1px solid #bf360c',
                                  borderRadius: 3, color: '#ffa726', padding: '2px 1px', fontWeight: 700,
                                }} />
                            </td>,
                            <td key={d+'reca'} style={{ ...td, background: '#0a0800' }} />,
                          ];
                        })}
                      </tr>
                    </React.Fragment>
                  ))}
                  <tr style={{ background: '#3b0000' }}>
                    <td colSpan={4} style={{ ...td, color: '#ef5350', fontWeight: 700, paddingLeft: 10 }}>Total Reprovados</td>
                    {DISCIPLINAS.flatMap(d => {
                      const { rep, apr } = totaisGrupo(grupo.turmas, d);
                      return [
                        <td key={d+'tr'} style={{ ...td, color: '#ef5350', fontWeight: 700 }}>{rep}</td>,
                        <td key={d+'ta'} style={{ ...td, color: '#66bb6a', fontWeight: 700 }}>{apr}</td>,
                      ];
                    })}
                  </tr>
                  <tr style={{ background: '#1a0a00' }}>
                    <td colSpan={4} style={{ ...td, color: '#ffa726', fontWeight: 700, paddingLeft: 10 }}>Total Recuperados</td>
                    {DISCIPLINAS.flatMap(d => {
                      const { rec } = totaisGrupo(grupo.turmas, d);
                      return [
                        <td key={d+'rec'} style={{ ...td, color: '#ffa726', fontWeight: 700 }}>{rec}</td>,
                        <td key={d+'reca'} style={{ ...td, background: '#0f0800' }} />,
                      ];
                    })}
                  </tr>
                  <tr><td colSpan={4 + DISCIPLINAS.length * 2} style={{ height: 6, background: '#0d1b2a' }} /></tr>
                </React.Fragment>
              );
            })}
            {!abaAtiva && (
              <>
                <tr style={{ background: '#1a0000' }}>
                  <td colSpan={4} style={{ ...td, color: '#ef5350', fontWeight: 700, fontSize: 12, paddingLeft: 10 }}>TOTAL GERAL - Reprovados</td>
                  {DISCIPLINAS.flatMap(d => {
                    const { rep, apr } = totaisGeral(d);
                    return [
                      <td key={d+'tgr'} style={{ ...td, color: '#ef5350', fontWeight: 700 }}>{rep}</td>,
                      <td key={d+'tga'} style={{ ...td, color: '#66bb6a', fontWeight: 700 }}>{apr}</td>,
                    ];
                  })}
                </tr>
                <tr style={{ background: '#001a00' }}>
                  <td colSpan={4} style={{ ...td, color: '#ffa726', fontWeight: 700, fontSize: 12, paddingLeft: 10 }}>TOTAL GERAL - Recuperados</td>
                  {DISCIPLINAS.flatMap(d => {
                    const { rec } = totaisGeral(d);
                    return [
                      <td key={d+'tgrec'} style={{ ...td, color: '#ffa726', fontWeight: 700 }}>{rec}</td>,
                      <td key={d+'tgreca'} style={{ ...td, background: '#000f00' }} />,
                    ];
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>

        <div style={{ marginTop: 16, background: '#162032', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#90caf9', border: '1px solid #1e3a5f' }}>
          <strong style={{ color: '#e8eaf6' }}>Observacoes:</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Os alunos transferidos com nota no 1 bimestre sao contados apenas do 2 bimestre.</li>
            <li>Total geral: <strong style={{ color: '#e8eaf6' }}>754</strong> alunos | Transferidos: <strong style={{ color: '#e8eaf6' }}>04</strong> | Recebidos: <strong style={{ color: '#e8eaf6' }}>04</strong> | Frequentando: <strong style={{ color: '#e8eaf6' }}>754</strong></li>
            <li>Celulas vermelhas intensas indicam mais de 5 reprovados na disciplina.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  background: '#0a3055', color: '#e8eaf6', padding: '6px 4px',
  border: '1px solid #1e3a5f', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '4px 5px', border: '1px solid #1e3a5f', textAlign: 'center', color: '#e8eaf6',
};

