// src/ui/pages/Rendimento.tsx
// Dados atualizados conforme Rendimento_1BIM_2026_Final.xlsx (06/06/2026)

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DisciplinaData { rep: number; apr: number; }
interface TurmaData {
  turma: string; total: number; ativos: number; transf: number; rem: number;
  disc: DisciplinaData[]; // 10 disciplinas na ordem padrão
}

const DISC_NAMES = ["Port.","Arte","Ed.Fís.","Ing.","Esp.","Mat.","Ciênc.","Geog.","Hist.","E.R."];
const DISC_FULL  = ["L. Portuguesa","Arte","Ed. Física","L. Inglesa","L. Espanhola","Matemática","Ciências","Geografia","História","Ens. Religioso"];

// ─── DADOS ───────────────────────────────────────────────────────────────────
// [rep, apr] por disciplina — ordem: Port, Arte, EdFis, Ing, Esp, Mat, Cienc, Geog, Hist, Rel
const DADOS: Record<string, TurmaData[]> = {
  "6º ANO": [
    { turma:"6A", total:33, ativos:32, transf:1, rem:0, disc:[{rep:1,apr:32},{rep:0,apr:33},{rep:0,apr:32},{rep:9,apr:24},{rep:0,apr:33},{rep:4,apr:28},{rep:8,apr:25},{rep:5,apr:25},{rep:0,apr:33},{rep:0,apr:33}] },
    { turma:"6B", total:34, ativos:33, transf:1, rem:0, disc:[{rep:0,apr:32},{rep:1,apr:29},{rep:0,apr:33},{rep:7,apr:25},{rep:0,apr:32},{rep:0,apr:27},{rep:4,apr:28},{rep:1,apr:31},{rep:0,apr:32},{rep:0,apr:32}] },
    { turma:"6C", total:34, ativos:34, transf:0, rem:0, disc:[{rep:1,apr:33},{rep:1,apr:33},{rep:0,apr:30},{rep:8,apr:26},{rep:0,apr:34},{rep:2,apr:31},{rep:9,apr:25},{rep:0,apr:33},{rep:1,apr:33},{rep:0,apr:34}] },
    { turma:"6D", total:30, ativos:29, transf:1, rem:0, disc:[{rep:4,apr:25},{rep:0,apr:29},{rep:0,apr:29},{rep:0,apr:28},{rep:7,apr:21},{rep:3,apr:26},{rep:3,apr:26},{rep:2,apr:27},{rep:0,apr:29},{rep:0,apr:23}] },
    { turma:"6E", total:31, ativos:30, transf:1, rem:0, disc:[{rep:3,apr:25},{rep:2,apr:26},{rep:1,apr:27},{rep:1,apr:27},{rep:3,apr:25},{rep:5,apr:23},{rep:3,apr:25},{rep:2,apr:26},{rep:2,apr:25},{rep:2,apr:25}] },
    { turma:"6F", total:28, ativos:25, transf:3, rem:0, disc:[{rep:8,apr:20},{rep:3,apr:25},{rep:2,apr:26},{rep:3,apr:25},{rep:10,apr:18},{rep:7,apr:21},{rep:11,apr:17},{rep:7,apr:20},{rep:2,apr:25},{rep:5,apr:20}] },
  ],
  "7º ANO": [
    { turma:"7A", total:36, ativos:36, transf:0, rem:0, disc:[{rep:2,apr:34},{rep:2,apr:34},{rep:0,apr:36},{rep:6,apr:30},{rep:1,apr:35},{rep:7,apr:29},{rep:11,apr:25},{rep:8,apr:28},{rep:8,apr:28},{rep:4,apr:30}] },
    { turma:"7B", total:36, ativos:36, transf:0, rem:0, disc:[{rep:2,apr:34},{rep:0,apr:36},{rep:0,apr:36},{rep:5,apr:31},{rep:0,apr:36},{rep:1,apr:34},{rep:5,apr:31},{rep:3,apr:33},{rep:0,apr:35},{rep:2,apr:34}] },
    { turma:"7C", total:37, ativos:35, transf:2, rem:0, disc:[{rep:6,apr:29},{rep:3,apr:32},{rep:0,apr:35},{rep:3,apr:32},{rep:1,apr:34},{rep:11,apr:24},{rep:4,apr:31},{rep:5,apr:30},{rep:3,apr:32},{rep:0,apr:1}] },
    { turma:"7D", total:31, ativos:31, transf:0, rem:0, disc:[{rep:4,apr:27},{rep:2,apr:29},{rep:0,apr:31},{rep:0,apr:31},{rep:0,apr:31},{rep:4,apr:27},{rep:7,apr:24},{rep:2,apr:29},{rep:8,apr:23},{rep:1,apr:26}] },
    { turma:"7E", total:31, ativos:30, transf:1, rem:0, disc:[{rep:4,apr:27},{rep:0,apr:31},{rep:0,apr:31},{rep:0,apr:31},{rep:1,apr:30},{rep:5,apr:26},{rep:9,apr:22},{rep:3,apr:27},{rep:7,apr:23},{rep:3,apr:26}] },
    { turma:"7F", total:32, ativos:30, transf:2, rem:0, disc:[{rep:1,apr:29},{rep:3,apr:27},{rep:1,apr:29},{rep:0,apr:30},{rep:2,apr:28},{rep:2,apr:28},{rep:12,apr:18},{rep:2,apr:28},{rep:9,apr:17},{rep:2,apr:20}] },
  ],
  "8º ANO": [
    { turma:"8A", total:35, ativos:35, transf:0, rem:0, disc:[{rep:0,apr:35},{rep:1,apr:34},{rep:0,apr:34},{rep:2,apr:33},{rep:1,apr:34},{rep:6,apr:28},{rep:7,apr:28},{rep:5,apr:29},{rep:6,apr:28},{rep:1,apr:33}] },
    { turma:"8B", total:36, ativos:36, transf:0, rem:0, disc:[{rep:5,apr:31},{rep:2,apr:34},{rep:1,apr:35},{rep:2,apr:34},{rep:4,apr:32},{rep:12,apr:24},{rep:8,apr:28},{rep:15,apr:21},{rep:8,apr:28},{rep:3,apr:31}] },
    { turma:"8C", total:34, ativos:33, transf:1, rem:0, disc:[{rep:10,apr:22},{rep:1,apr:31},{rep:2,apr:31},{rep:6,apr:26},{rep:11,apr:21},{rep:20,apr:12},{rep:22,apr:10},{rep:18,apr:14},{rep:14,apr:18},{rep:2,apr:30}] },
    { turma:"8D", total:26, ativos:25, transf:1, rem:0, disc:[{rep:5,apr:20},{rep:0,apr:25},{rep:1,apr:24},{rep:1,apr:24},{rep:1,apr:24},{rep:6,apr:19},{rep:6,apr:19},{rep:5,apr:20},{rep:14,apr:11},{rep:5,apr:20}] },
    { turma:"8E", total:25, ativos:24, transf:1, rem:0, disc:[{rep:4,apr:19},{rep:1,apr:22},{rep:2,apr:21},{rep:2,apr:21},{rep:2,apr:21},{rep:9,apr:14},{rep:6,apr:16},{rep:5,apr:18},{rep:12,apr:10},{rep:2,apr:19}] },
    { turma:"8F", total:25, ativos:24, transf:1, rem:0, disc:[{rep:2,apr:22},{rep:1,apr:23},{rep:3,apr:21},{rep:2,apr:22},{rep:3,apr:21},{rep:2,apr:22},{rep:5,apr:19},{rep:6,apr:18},{rep:5,apr:17},{rep:2,apr:18}] },
  ],
  "9º ANO": [
    { turma:"9A", total:35, ativos:34, transf:1, rem:0, disc:[{rep:3,apr:31},{rep:4,apr:30},{rep:1,apr:33},{rep:4,apr:30},{rep:4,apr:30},{rep:9,apr:24},{rep:12,apr:22},{rep:4,apr:30},{rep:7,apr:27},{rep:3,apr:30}] },
    { turma:"9B", total:35, ativos:35, transf:0, rem:0, disc:[{rep:3,apr:32},{rep:4,apr:31},{rep:0,apr:35},{rep:9,apr:26},{rep:3,apr:32},{rep:12,apr:23},{rep:9,apr:26},{rep:7,apr:28},{rep:5,apr:30},{rep:0,apr:0}] },
    { turma:"9C", total:32, ativos:32, transf:0, rem:0, disc:[{rep:2,apr:28},{rep:3,apr:27},{rep:1,apr:29},{rep:0,apr:0},{rep:3,apr:28},{rep:0,apr:0},{rep:8,apr:22},{rep:5,apr:26},{rep:10,apr:20},{rep:0,apr:0}] },
    { turma:"9D", total:32, ativos:31, transf:1, rem:0, disc:[{rep:5,apr:26},{rep:0,apr:31},{rep:0,apr:31},{rep:0,apr:31},{rep:7,apr:23},{rep:0,apr:0},{rep:11,apr:19},{rep:9,apr:22},{rep:11,apr:20},{rep:0,apr:25}] },
    { turma:"9E", total:31, ativos:25, transf:3, rem:0, disc:[{rep:3,apr:23},{rep:3,apr:23},{rep:0,apr:28},{rep:0,apr:27},{rep:4,apr:21},{rep:0,apr:0},{rep:9,apr:18},{rep:3,apr:23},{rep:0,apr:28},{rep:0,apr:26}] },
    { turma:"9F", total:32, ativos:30, transf:2, rem:2, disc:[{rep:1,apr:27},{rep:0,apr:28},{rep:0,apr:30},{rep:0,apr:28},{rep:4,apr:24},{rep:0,apr:0},{rep:5,apr:21},{rep:1,apr:26},{rep:1,apr:27},{rep:0,apr:26}] },
  ],
};

const SERIES = Object.keys(DADOS);

// ─── Utilitários ─────────────────────────────────────────────────────────────
function pct(rep: number, apr: number) {
  const total = rep + apr;
  return total > 0 ? (apr / total) * 100 : 0;
}
function serieSummary(turmas: TurmaData[]) {
  const total = turmas.reduce((s,t) => s+t.total, 0);
  const ativos = turmas.reduce((s,t) => s+t.ativos, 0);
  const transf = turmas.reduce((s,t) => s+t.transf, 0);
  const disc = DISC_NAMES.map((_,di) => ({
    rep: turmas.reduce((s,t) => s + (t.disc[di]?.rep ?? 0), 0),
    apr: turmas.reduce((s,t) => s + (t.disc[di]?.apr ?? 0), 0),
  }));
  return { total, ativos, transf, disc };
}
function situacao(turma: TurmaData): "BOM" | "ATEN." | "CRIT." {
  const totRep = turma.disc.reduce((s,d) => s+d.rep, 0);
  const totApr = turma.disc.reduce((s,d) => s+d.apr, 0);
  const p = pct(totRep, totApr);
  if (p >= 90) return "BOM";
  if (p >= 70) return "ATEN.";
  return "CRIT.";
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
function exportExcel() {
  const wb = XLSX.utils.book_new();
  for (const serie of SERIES) {
    const rows: (string|number)[][] = [
      ["TURMA","TOTAL","ATIVOS","TRANSF.",...DISC_FULL.flatMap(d => [`${d} Rep.`,`${d} Apr.`])]
    ];
    for (const t of DADOS[serie]) {
      rows.push([t.turma, t.total, t.ativos, t.transf,
        ...t.disc.flatMap(d => [d.rep, d.apr])]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, serie);
  }
  XLSX.writeFile(wb, "Rendimento_EF_1BIM_2026.xlsx");
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function Rendimento() {
  const [serie, setSerie] = useState(SERIES[0]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    return (
      <div style={S.mobileBlock}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🖥️</div>
        <h2 style={{ color: "#FFD700", fontSize: 20, margin: "0 0 10px" }}>Acesso restrito</h2>
        <p style={{ color: "#AAA", fontSize: 14, maxWidth: 300, lineHeight: 1.6, textAlign:"center" }}>
          A página de Rendimento está disponível apenas em computadores.
        </p>
      </div>
    );
  }

  const turmas = DADOS[serie];
  const sm = serieSummary(turmas);

  return (
    <div style={S.root}>
      {/* Cabeçalho */}
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Rendimento Escolar — Educação Física 2026</h1>
          <p style={S.sub}>E.E. Instituto Odilon Pratagi · 1º Bimestre · Aprovação ≥ 7,0</p>
        </div>
        <button style={S.btnExport} onClick={exportExcel}>📊 Exportar Excel</button>
      </div>

      {/* Seletor de série */}
      <div style={S.serieRow}>
        {SERIES.map(s => (
          <button key={s}
            style={{ ...S.serieBtn, ...(s === serie ? S.serieBtnActive : {}) }}
            onClick={() => setSerie(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* Painel resumo da série */}
      <div style={S.summaryPanel}>
        <div style={S.summaryCard}>
          <div style={{ ...S.summaryVal, color:"#FFF" }}>{sm.total}</div>
          <div style={S.summaryLabel}>Total</div>
        </div>
        <div style={S.summaryCard}>
          <div style={{ ...S.summaryVal, color:"#FFF" }}>{sm.ativos}</div>
          <div style={S.summaryLabel}>Ativos</div>
        </div>
        <div style={S.summaryCard}>
          <div style={{ ...S.summaryVal, color:"#FFA500" }}>{sm.transf}</div>
          <div style={S.summaryLabel}>Transferidos</div>
        </div>
        {sm.disc.map((d, di) => {
          const p = pct(d.rep, d.apr);
          return (
            <div key={di} style={S.summaryCard}>
              <div style={{ ...S.summaryVal, fontSize:18, color: p >= 90 ? "#00CC66" : p >= 70 ? "#FFD700" : "#FF4444" }}>
                {p.toFixed(1)}%
              </div>
              <div style={S.summaryLabel}>{DISC_NAMES[di]}</div>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div style={{ overflowX:"auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th} rowSpan={2}>TURMA</th>
              <th style={S.th} rowSpan={2}>ATIVOS</th>
              <th style={S.th} rowSpan={2}>TRANSF.</th>
              <th style={{ ...S.th, color:"#FFD700" }} rowSpan={2}>SIT.</th>
              {DISC_NAMES.map(d => (
                <th key={d} style={{ ...S.th, background:"#1560BD" }} colSpan={2}>{d}</th>
              ))}
            </tr>
            <tr>
              {DISC_NAMES.flatMap(d => [
                <th key={`${d}-r`} style={{ ...S.thSub, color:"#FF4444" }}>Rep.</th>,
                <th key={`${d}-a`} style={{ ...S.thSub, color:"#00CC66" }}>Apr.</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {turmas.map((t, i) => {
              const sit = situacao(t);
              const sitColor = sit === "BOM" ? "#00CC66" : sit === "ATEN." ? "#FFD700" : "#FF4444";
              return (
                <tr key={t.turma} style={{ background: i%2===0 ? "#122044" : "#0D1B3E" }}>
                  <td style={{ ...S.td, color:"#FFD700", fontWeight:700 }}>{t.turma}</td>
                  <td style={S.td}>{t.ativos}</td>
                  <td style={{ ...S.td, color: t.transf>0 ? "#FFA500" : "#AAA" }}>{t.transf||"-"}</td>
                  <td style={{ ...S.td, color: sitColor, fontWeight:700 }}>{sit}</td>
                  {t.disc.map((d, di) => {
                    const total = d.rep + d.apr;
                    return [
                      <td key={`${di}-r`} style={{ ...S.td, color: d.rep>0 ? "#FF4444" : "#AAA",
                        background: d.rep>0 ? "#2A0000" : undefined, fontWeight: d.rep>0 ? 700 : 400 }}>
                        {total > 0 ? d.rep : "S/N"}
                      </td>,
                      <td key={`${di}-a`} style={{ ...S.td, color:"#00CC66", fontWeight:700 }}>
                        {total > 0 ? d.apr : "S/N"}
                      </td>,
                    ];
                  })}
                </tr>
              );
            })}
            {/* Linha de total */}
            <tr style={{ background:"#1A2E6E" }}>
              <td style={{ ...S.td, color:"#FFD700", fontWeight:700 }} colSpan={4}>TOTAL {serie}</td>
              {sm.disc.map((d, di) => {
                const p2 = pct(d.rep, d.apr);
                return [
                  <td key={`t${di}-r`} style={{ ...S.td, color:"#FF4444", fontWeight:700 }}>{d.rep}</td>,
                  <td key={`t${di}-a`} style={{ ...S.td, color:"#00CC66", fontWeight:700 }}>
                    {d.apr} <span style={{ fontSize:10, color: p2>=90?"#00CC66":p2>=70?"#FFD700":"#FF4444" }}>
                      ({p2.toFixed(0)}%)
                    </span>
                  </td>,
                ];
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div style={S.footer}>
        SIT.: <span style={{color:"#00CC66"}}>BOM ≥90%</span> |{" "}
        <span style={{color:"#FFD700"}}>ATEN. 70–90%</span> |{" "}
        <span style={{color:"#FF4444"}}>CRIT. &lt;70%</span> |{" "}
        S/N = Sem nota (transferido/remanejado) · Dados: 1º Bimestre 2026
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root:       { minHeight:"100vh", background:"#0D1B3E", color:"#FFF", fontFamily:"Arial,sans-serif", padding:"20px 28px" },
  mobileBlock:{ minHeight:"100vh", background:"#0D1B3E", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:32 },
  header:     { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18, borderBottom:"2px solid #1E90FF", paddingBottom:14 },
  h1:         { margin:0, fontSize:20, fontWeight:700, color:"#FFF" },
  sub:        { margin:"4px 0 0", fontSize:12, color:"#AAA" },
  btnExport:  { background:"#00CC66", border:"none", color:"#000", borderRadius:6, padding:"8px 18px", cursor:"pointer", fontWeight:700, fontSize:13 },
  serieRow:   { display:"flex", gap:10, marginBottom:18 },
  serieBtn:   { background:"#122044", border:"1px solid #1A2E6E", color:"#AAA", borderRadius:8, padding:"9px 22px", cursor:"pointer", fontSize:13, fontWeight:600 },
  serieBtnActive: { background:"#1E90FF", color:"#FFF", border:"1px solid #1E90FF", boxShadow:"0 0 12px #1E90FF66" },
  summaryPanel:{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" },
  summaryCard: { background:"#1A2E6E", borderRadius:8, padding:"8px 14px", textAlign:"center", minWidth:80, border:"1px solid #1E3A8A" },
  summaryVal:  { fontSize:22, fontWeight:800, lineHeight:1 },
  summaryLabel:{ fontSize:10, color:"#AAA", marginTop:3, textTransform:"uppercase" },
  table:       { width:"100%", borderCollapse:"collapse", fontSize:12 },
  th:          { background:"#1E90FF", color:"#FFF", padding:"7px 8px", textAlign:"center", border:"1px solid #113366", fontWeight:700, whiteSpace:"nowrap" },
  thSub:       { background:"#1A2E6E", padding:"5px 7px", textAlign:"center", border:"1px solid #113366", fontWeight:700, fontSize:11 },
  td:          { padding:"6px 8px", textAlign:"center", border:"1px solid #1A3A7A", fontSize:12 },
  footer:      { marginTop:16, paddingTop:10, borderTop:"1px solid #1A2E6E", color:"#555E7A", fontSize:11, textAlign:"center" },
};
