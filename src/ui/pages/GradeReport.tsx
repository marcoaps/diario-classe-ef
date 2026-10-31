import React, { useState, useEffect } from "react";
import { cn } from "../AppLayout";
import { X, FileDown, Save, Upload, Loader2 } from "lucide-react";
import { salvarNotas, buscarNotas, sincronizarNomesAlunos, supabase } from "../../data/supabase";
import { buscarRemanejados, ehTransferenciaErroneaDeImportacao, chaveNomeSituacao, chavesCanonicasDeNomesCompativeis } from "../../domain/situacaoAluno";
import { bimestreAtual } from "../../domain/useRelatorioFrequencia";
import { formatarNome } from "../../utils/formatarNome";
import { lerArquivoNotas, escolherMaisRecentes, salvarNotasImportadas, type NotasTurmaImportada } from "../../domain/importarNotasExcel";

const TURMAS = ["6F", "7B", "7C", "7D", "7E", "7F", "8A", "8B", "8C", "8D", "8E", "8F", "9A", "9B", "9C", "9D", "9E", "9F"];

// Mapeamento bimestre -> meses (para calcular faltas)
const MESES_BIMESTRE: Record<number, number[]> = {
  1: [2, 3, 4],    // fev, mar, abr
  2: [5, 6, 7],    // mai, jun, jul
  3: [8, 9, 10],   // ago, set, out
  4: [10, 11, 12], // out, nov, dez
};

function situacaoAbrev(situacao?: string | null): string {
  const s = (situacao ?? '').toLowerCase();
  if (s.includes('transferi')) return 'Transf.';
  if (s.includes('remanej')) return 'Remanej.';
  return 'Fora';
}

interface AlunoNota {
  num: number;
  nome: string;
  nota: number | null;
  situacao: string;
  data_situacao: string;
  faltas?: number;
}

async function buscarFaltasBimestre(turma: string, bimestre: number): Promise<Record<string, number>> {
  try {
    const meses = MESES_BIMESTRE[bimestre] || [];
    const ano = new Date().getFullYear();

    // Busca alunos da turma
    const { data: alunosData } = await supabase
      .from('alunos')
      .select('id, nome')
      .eq('turma_id', turma);
    if (!alunosData || alunosData.length === 0) return {};

    const ids = alunosData.map((a: any) => a.id);

    // Busca registros de frequencia no periodo do bimestre
    const datas = meses.flatMap(m => {
      const inicio = `${ano}-${String(m).padStart(2, '0')}-01`;
      const fim = `${ano}-${String(m).padStart(2, '0')}-31`;
      return [inicio, fim];
    });
    const dataInicio = datas[0];
    const dataFim = datas[datas.length - 1];

    const { data: freqData } = await supabase
      .from('frequencia')
      .select('aluno_id, presente')
      .in('aluno_id', ids)
      .gte('data', dataInicio)
      .lte('data', dataFim);

    if (!freqData) return {};

    // Conta faltas por aluno. Cada registro = 2 aulas de 2h no mesmo dia
    // (turma dividida em dois horários) — mesma regra de
    // useRelatorioFrequencia.ts, pra bater com Relatório de Frequência/
    // Alunos para a Prova/Portal do Aluno.
    const faltasPorId: Record<string, number> = {};
    freqData.forEach((r: any) => {
      if (!r.presente) {
        faltasPorId[r.aluno_id] = (faltasPorId[r.aluno_id] || 0) + 2;
      }
    });

    // Mapeia id -> nome -> faltas
    const faltasPorNome: Record<string, number> = {};
    alunosData.forEach((a: any) => {
      faltasPorNome[a.nome.toUpperCase()] = faltasPorId[a.id] || 0;
    });

    return faltasPorNome;
  } catch (err) {
    console.error('Erro ao buscar faltas:', err);
    return {};
  }
}

export function GradeReport() {
  const [view, setView] = useState<"notas" | "desempenho" | "grafico">("notas");
  const [bimestre, setBimestre] = useState<1 | 2 | 3 | 4>(() => bimestreAtual());
  const [turma, setTurma] = useState("7B");
  const [alunos, setAlunos] = useState<AlunoNota[]>([]);
  const [desempenho, setDesempenho] = useState<any[]>([]);
  const [grafico, setGrafico] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [showExcel, setShowExcel] = useState(false);
  const [excelTurmas, setExcelTurmas] = useState<NotasTurmaImportada[]>([]);
  const [excelMsg, setExcelMsg] = useState<string | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  const handleExcelFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setExcelBusy(true); setExcelMsg(null);
    const lidos: NotasTurmaImportada[] = [];
    const erros: string[] = [];
    for (const f of files) {
      try { lidos.push(await lerArquivoNotas(f)); } catch (err: any) { erros.push(err.message); }
    }
    setExcelTurmas(escolherMaisRecentes(lidos));
    setExcelMsg(erros.length ? erros.join("\n") : null);
    setExcelBusy(false);
    e.target.value = "";
  };

  const salvarExcel = async () => {
    setExcelBusy(true);
    const ok: string[] = [];
    const falhas: string[] = [];
    for (const t of excelTurmas) {
      try { await salvarNotasImportadas(t); ok.push(t.turma); } catch (err: any) { falhas.push(t.turma + ": " + err.message); }
    }
    setExcelBusy(false);
    setExcelMsg("Salvas: " + (ok.join(", ") || "nenhuma") + "." + (falhas.length ? "\nFalharam: " + falhas.join(" | ") : ""));
    if (!falhas.length) setExcelTurmas([]);
    carregarNotas();
  };

  useEffect(() => {
    if (view === "notas") carregarNotas();
    else if (view === "desempenho") carregarDesempenho();
    else carregarGrafico();
  }, [turma, bimestre, view]);

  const carregarNotas = async () => {
    setIsLoading(true);
    try {
      const data = await buscarNotas(turma, bimestre);
      if (data.length === 0) { setAlunos([]); return; }

      // Busca faltas do app para o bimestre
      const faltasPorNome = await buscarFaltasBimestre(turma, bimestre);

      // "Foi Transferido" sem data em aluno remanejado de outra turma é erro de
      // importação do Simaed (ver situacaoAluno.ts) — mostra como Em Curso.
      const remanejados = await buscarRemanejados();
      const situacaoReal = (d: any) =>
        ehTransferenciaErroneaDeImportacao({ nome: d.nome, turma, situacao: d.situacao, data_situacao: d.data_situacao }, remanejados)
          ? 'Em Curso' : (d.situacao || 'Em Curso');

      setAlunos(data.map((d: any) => ({
        num: d.numero,
        nome: d.nome,
        nota: d.nota,
        situacao: situacaoReal(d),
        data_situacao: d.data_situacao || '',
        faltas: faltasPorNome[d.nome?.toUpperCase()] ?? (d.faltas ?? 0),
      })));
      setSaved(true);
    } catch (e) {
      setAlunos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarDesempenho = async () => {
    setIsLoading(true);
    try {
      const [b1, b2, b3, b4, { data: cadastro }] = await Promise.all([
        buscarNotas(turma, 1),
        buscarNotas(turma, 2),
        buscarNotas(turma, 3),
        buscarNotas(turma, 4),
        supabase.from("alunos").select("nome, turma_id"),
      ]);
      // O nome muda entre bimestres (MAIÚSCULAS x Normal, acentos), então junta pela
      // chave sem acento/caixa — antes juntava pelo nome exato e o aluno saía em
      // duas linhas. Ignora quem só consta no cadastro de OUTRA turma (lista de
      // outra sala gravada por engano) e, havendo mais de uma linha do aluno no
      // mesmo bimestre (nota e nota_ef separadas), fica com a que tem nota.
      const chavesProprias = new Set((cadastro || []).filter((a: any) => a.turma_id === turma).map((a: any) => chaveNomeSituacao(a.nome)));
      const chavesOutras = new Set((cadastro || []).filter((a: any) => a.turma_id !== turma).map((a: any) => chaveNomeSituacao(a.nome)));
      // Nome completo/abreviado ou com erro de digitação em outro bimestre (mesmo nº de chamada).
      const canonicas = chavesCanonicasDeNomesCompativeis(
        [b1, b2, b3, b4].flat().map((a: any) => ({ chave: chaveNomeSituacao(a.nome), numero: a.numero })),
        chavesProprias,
      );
      const porBim = [b1, b2, b3, b4].map((lista: any[]) => {
        const m = new Map<string, any>();
        lista.forEach(a => {
          const chaveOriginal = chaveNomeSituacao(a.nome);
          const k = canonicas.get(chaveOriginal) ?? chaveOriginal;
          if (!chavesProprias.has(k) && !chavesProprias.has(chaveOriginal) && (chavesOutras.has(k) || chavesOutras.has(chaveOriginal))) return;
          const atual = m.get(k);
          if (!atual || (atual.nota == null && a.nota != null)) m.set(k, a);
        });
        return m;
      });
      const chaves = new Set(porBim.flatMap(m => Array.from(m.keys())));
      const resultado = Array.from(chaves).map(chave => {
        const a1 = porBim[0].get(chave);
        const a2 = porBim[1].get(chave);
        const a3 = porBim[2].get(chave);
        const a4 = porBim[3].get(chave);
        const nome = (a1 ?? a2 ?? a3 ?? a4).nome;
        const notas = [a1?.nota, a2?.nota, a3?.nota, a4?.nota];
        const validas = notas.filter(n => n !== null && n !== undefined) as number[];
        const total = validas.reduce((s, n) => s + n, 0);
        const media = validas.length > 0 ? total / validas.length : null;
        const num = a1?.numero || a2?.numero || a3?.numero || a4?.numero;
        return { num, nome, b1: a1?.nota, b2: a2?.nota, b3: a3?.nota, b4: a4?.nota, total, media };
      });
      resultado.sort((a, b) => (a.num || 999) - (b.num || 999));
      setDesempenho(resultado);
    } catch (e) {
      setDesempenho([]);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarGrafico = async () => {
    setIsLoading(true);
    try {
      const resultados = await Promise.all(
        TURMAS.map(async t => {
          const data = await buscarNotas(t, bimestre);
          if (data.length === 0) return null;
          const media = data.reduce((s: number, a: any) => s + Number(a.nota || 0), 0) / data.length;
          return { turma: t, media: parseFloat(media.toFixed(1)) };
        })
      );
      setGrafico(resultados.filter(Boolean));
    } catch (e) {
      setGrafico([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const toBase64 = (file: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
      const base64 = await toBase64(file);
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 8000,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: "Extraia os dados dos alunos deste PDF da RELACAO DE NOTAS E CONCEITOS. Retorne SOMENTE um array JSON valido, sem markdown, sem explicacoes, sem texto extra. Formato exato: [{\"num\":1,\"nome\":\"NOME COMPLETO\",\"nota\":7.0,\"situacao\":\"Em Curso\",\"data_situacao\":\"\"}]. Para alunos transferidos use: {\"situacao\":\"Foi Transferido\",\"data_situacao\":\"28/05/2026\"}. Use aspas duplas. Numeros decimais com ponto. Se nao houver data da situacao deixe string vazia." }
            ]
          }]
        })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error("API erro " + resp.status);
      let text = json.content[0].text;
      let clean = text.replace(/```json|```/g, "").trim();
      const lastBracket = clean.lastIndexOf("}");
      if (lastBracket !== -1 && !clean.endsWith("]")) {
        clean = clean.substring(0, lastBracket + 1) + "]";
      }
      const notas = JSON.parse(clean);

      // Busca faltas do app para cruzar
      const faltasPorNome = await buscarFaltasBimestre(turma, bimestre);
      const alunosComFaltas = notas.map((a: any) => ({
        ...a,
        situacao: a.situacao || 'Em Curso',
        data_situacao: a.data_situacao || '',
        faltas: faltasPorNome[a.nome?.toUpperCase()] ?? 0,
      }));

      setAlunos(alunosComFaltas);
      setSaved(false);
      setShowImport(false);
    } catch (e: any) {
      alert("Erro: " + (e?.message || JSON.stringify(e)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSalvar = async () => {
    setIsSaving(true);
    setSyncMsg(null);
    try {
      await salvarNotas(
        turma,
        bimestre,
        alunos.map(a => ({
          numero: a.num,
          nome: a.nome,
          nota: a.nota,
          situacao: a.situacao,
          data_situacao: a.data_situacao,
          faltas: a.faltas ?? 0,
        }))
      );

      // Corrige nomes/sobrenomes dos alunos da turma com base no PDF carregado
      try {
        const { changed, failed } = await sincronizarNomesAlunos(
          turma,
          alunos.map(a => ({ numero: a.num, nome: a.nome }))
        );
        if (changed > 0 || failed > 0) {
          setSyncMsg(
            failed > 0
              ? `${changed} nome(s) corrigido(s) na turma, ${failed} falharam`
              : `${changed} nome(s) corrigido(s) na turma`
          );
        }
      } catch (syncErr: any) {
        setSyncMsg('Notas salvas, mas erro ao corrigir nomes: ' + syncErr.message);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const fmtNota = (n: any) => {
    if (n === null || n === undefined) return "-";
    return Number(n).toFixed(1).replace(".", ",");
  };

  const getBarColor = (media: number) => {
    if (media >= 7) return "#16a34a";
    if (media >= 5) return "#2563eb";
    if (media >= 3) return "#d97706";
    return "#dc2626";
  };

  // Gera PDF no layout do Simaed
  const gerarPdfSimaed = async () => {
    if (alunos.length === 0) return;
    setGerandoPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pW = 210;
      const mL = 15;
      const mR = 15;
      const mT = 15;
      const usableW = pW - mL - mR;

      const cinza = '#F5F5F5';
      const azulEscuro = '#1F2937';
      const borda = '#CCCCCC';
      const azulHeader = '#E8F0FE';

      let y = mT;

      // Tenta carregar brasao
      let brasaoLoaded = false;
      try {
        const res = await fetch('/brasao-acre.png');
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let b64 = '';
          const chunk = 8192;
          for (let i = 0; i < bytes.length; i += chunk) {
            b64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const imgData = 'data:image/png;base64,' + btoa(b64);
          doc.addImage(imgData, 'PNG', mL, y, 18, 18);
          brasaoLoaded = true;
        }
      } catch (_) {}

      // Cabecalho institucional
      const cxTexto = brasaoLoaded ? mL + 22 : mL;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(azulEscuro);
      doc.text('ESTADO DO ACRE', pW / 2, y + 4, { align: 'center' });
      doc.text('SECRETARIA DE ESTADO DE EDUCACAO E CULTURA', pW / 2, y + 9, { align: 'center' });
      doc.text('ESC INSTITUTO ODILON PRATAGI', pW / 2, y + 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('RUA 12 DE OUTUBRO, 205, PREDIO, RAIMUNDO CHAAR, 69932-970, Brasileia/AC', pW / 2, y + 19, { align: 'center' });
      doc.text('iop.escola@yahoo.com.br', pW / 2, y + 23, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('RELACAO DE NOTAS E CONCEITOS', pW / 2, y + 29, { align: 'center' });
      y += 30;

      // Borda ao redor do cabecalho institucional
      doc.setDrawColor(borda);
      doc.rect(mL, mT - 2, usableW, y - mT + 2, 'S');

      y += 2;

      // Info turma
      doc.setFillColor(cinza);
      doc.rect(mL, y, usableW, 18, 'F');
      doc.setDrawColor(borda);
      doc.rect(mL, y, usableW, 18, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(azulEscuro);
      doc.text('Tipo de ensino:  ENSINO REGULAR', mL + 4, y + 6);
      doc.text(`Serie/etapa:  ${turma.replace(/(\d+)([A-Z])/, '$1o Ano')}`, mL + usableW * 0.55, y + 6);
      doc.text('Turno:  TARDE', mL + 4, y + 12);
      doc.text(`Turma:  ${turma.replace(/(\d+)([A-Z])/, '$1o $2')}`, mL + usableW * 0.55, y + 12);
      doc.text('Disciplina:  EDUCACAO FISICA', mL + 4, y + 18);
      y += 16;

      // Header bimestre
      doc.setFillColor(azulHeader);
      doc.rect(mL, y, usableW, 8, 'F');
      doc.setDrawColor(borda);
      doc.rect(mL, y, usableW, 8, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(azulEscuro);
      doc.text(`Divisao do periodo letivo:  ${bimestre}o BIMESTRE`, pW / 2, y + 4.8, { align: 'center' });
      y += 8;

      // Colunas da tabela
      const colNum = 12;
      const colSituacao = 38;
      const colData = 28;
      const colFaltas = 14;
      const colNota = 16;
      const colNome = usableW - colNum - colNota - colFaltas - colSituacao - colData;
      const altRow = 7;

      const pos = { y };

      const desenharHeader = () => {
        doc.setFillColor('#D1D5DB');
        doc.rect(mL, pos.y, usableW, altRow, 'F');
        doc.setDrawColor(borda);
        let xh = mL;
        [colNum, colNome, colNota, colFaltas, colSituacao, colData].forEach(w => {
          doc.rect(xh, pos.y, w, altRow, 'S');
          xh += w;
        });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(azulEscuro);
        xh = mL;
        doc.text('Num.', xh + colNum / 2, pos.y + 4.8, { align: 'center' }); xh += colNum;
        doc.text('Nome do aluno', xh + 4, pos.y + 4.8); xh += colNome;
        doc.text('Nota', xh + colNota / 2, pos.y + 4.8, { align: 'center' }); xh += colNota;
        doc.text('Faltas', xh + colFaltas / 2, pos.y + 4.8, { align: 'center' }); xh += colFaltas;
        doc.text('Situacao do Aluno', xh + 4, pos.y + 4.8); xh += colSituacao;
        doc.text('Data Situacao', xh + 4, pos.y + 4.8);
        pos.y += altRow;
      };

      desenharHeader();

      // Linhas dos alunos
      alunos.forEach((aluno, idx) => {
        if (pos.y + altRow > 282) {
          doc.addPage();
          pos.y = mT;
          desenharHeader();
        }

        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
        doc.setFillColor(bg);
        doc.rect(mL, pos.y, usableW, altRow, 'F');
        doc.setDrawColor(borda);

        let xc = mL;
        [colNum, colNome, colNota, colFaltas, colSituacao, colData].forEach(w => {
          doc.rect(xc, pos.y, w, altRow, 'S');
          xc += w;
        });

        const transferido = /transferi|remanej/.test(aluno.situacao?.toLowerCase() ?? '');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(azulEscuro);

        xc = mL;
        doc.text(String(aluno.num || ''), xc + colNum / 2, pos.y + 4.8, { align: 'center' });
        xc += colNum;

        const nomeDisplay = aluno.nome?.length > 32
          ? aluno.nome.substring(0, 32) + '.'
          : aluno.nome || '';
        doc.text(nomeDisplay.toUpperCase(), xc + 2, pos.y + 4.8);
        xc += colNome;

        if (transferido) {
          doc.setTextColor('#DC2626');
          doc.setFont('helvetica', 'bold');
          doc.text(situacaoAbrev(aluno.situacao), xc + colNota / 2, pos.y + 4.8, { align: 'center' });
          doc.setTextColor(azulEscuro);
          doc.setFont('helvetica', 'normal');
        } else {
          doc.text(fmtNota(aluno.nota), xc + colNota / 2, pos.y + 4.8, { align: 'center' });
        }
        xc += colNota;

        doc.text(transferido ? '-' : String(aluno.faltas ?? 0), xc + colFaltas / 2, pos.y + 4.8, { align: 'center' });
        xc += colFaltas;

        if (transferido) {
          doc.setTextColor('#DC2626');
          doc.setFont('helvetica', 'bold');
        }
        doc.text(aluno.situacao || 'Em Curso', xc + 2, pos.y + 4.8);
        doc.setTextColor(azulEscuro);
        doc.setFont('helvetica', 'normal');
        xc += colSituacao;

        if (transferido && aluno.data_situacao) {
          doc.setTextColor('#DC2626');
        }
        doc.text(aluno.data_situacao || '', xc + 2, pos.y + 4.8);
        doc.setTextColor(azulEscuro);

        pos.y += altRow;
      });

      const nomeTurma = turma.replace(/([0-9]+)([A-Z])/, '$1o-$2'); // eslint-disable-line
      doc.save('Notas-' + bimestre + 'oBimestre-' + nomeTurma + '.pdf');
    } catch (err) {
      alert('Erro ao gerar PDF.');
      console.error(err);
    } finally {
      setGerandoPdf(false);
    }
  };

  const getStatus = (nota: number) => {
    if (nota >= 5) return { text: "Aprovado", color: "text-green-600" };
    if (nota >= 3) return { text: "Rec.", color: "text-yellow-600" };
    return { text: "Reprov.", color: "text-red-600" };
  };

  const BAR_H = 220;
  const BAR_W = 30;
  const GAP = 10;

  // Resumo da turma (só alunos ativos com nota)
  const ativosNotas = alunos.filter(a => !/transferi|remanej/.test(a.situacao?.toLowerCase() ?? ''));
  const comNota = ativosNotas.filter(a => a.nota !== null);
  const mediaTurma = comNota.length ? comNota.reduce((s, a) => s + (a.nota as number), 0) / comNota.length : null;
  const aprovados = comNota.filter(a => (a.nota as number) >= 5).length;
  const transferidosTotal = alunos.length - ativosNotas.length;
  const serieAtual = turma.charAt(0);
  const series = Array.from(new Set(TURMAS.map(t => t.charAt(0))));

  // Cor da nota por faixa (verde ≥ 9, dourado 5–8,9, laranja 3–4,9, vermelho < 3)
  const notaChip = (nota: number | null) => {
    if (nota === null) return "text-on-surface-variant bg-[#EEF2EF]";
    if (nota >= 10) return "text-white bg-[#0B6B3A]";
    if (nota >= 9) return "text-[#0B6B3A] bg-[#E3F2EA]";
    if (nota >= 5) return "text-[#9A6A00] bg-[#FDF3DC]";
    if (nota >= 3) return "text-[#B45309] bg-[#FFEDD5]";
    return "text-[#B42318] bg-[#FDECEA]";
  };

  return (
    <div className="flex flex-col h-full bg-background relative" id="report-content">
      <div className="p-4 pt-3 border-b border-outline-variant sticky top-0 bg-background/90 backdrop-blur-md z-10 print:hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold tracking-tight text-on-surface">Notas</h2>
          {view === "notas" && alunos.length > 0 && saved && (
            <span className="text-[11px] font-extrabold text-[#0B6B3A] bg-[#E3F2EA] px-2.5 py-1.5 rounded-full">✓ Salvo</span>
          )}
        </div>

        <div className="flex w-full p-1 bg-surface-container rounded-2xl mb-3">
          {[["notas", "Notas"], ["desempenho", "Desempenho"], ["grafico", "Gráfico"]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v as any)}
              className={cn("flex-1 h-10 text-center rounded-[10px] text-[13px] transition-all",
                view === v ? "bg-white text-primary font-extrabold shadow-sm" : "bg-transparent text-on-surface-variant font-semibold")}>
              {l}
            </button>
          ))}
        </div>

        {view !== "grafico" && (
          <div className="mb-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold tracking-[0.08em] text-on-surface-variant">{serieAtual}º ANO</span>
            <div className="flex gap-1.5">
              {TURMAS.filter(t => t.charAt(0) === serieAtual).map(t => (
                <button key={t} onClick={() => setTurma(t)}
                  className={cn("flex-1 py-2.5 rounded-[10px] text-[13px] transition-all",
                    turma === t ? "bg-[#0B6B3A] text-white font-extrabold" : "bg-surface-container text-on-surface font-bold")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {series.map(s => (
                <button key={s} onClick={() => { if (s !== serieAtual) setTurma(TURMAS.find(t => t.charAt(0) === s)!); }}
                  className={cn("px-2.5 py-1.5 rounded-full text-xs font-bold border transition-all",
                    serieAtual === s ? "border-[#0B6B3A] text-[#0B6B3A] bg-[#E3F2EA]" : "border-[#D3DCD7] text-on-surface-variant")}>
                  {s}º
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex p-[3px] h-11 bg-surface-container rounded-xl">
          {[1, 2, 3, 4].map(b => (
            <button key={b} onClick={() => setBimestre(b as any)}
              className={cn("flex-1 text-center rounded-[9px] text-[13px] transition-all",
                bimestre === b ? "bg-[#0B6B3A] text-white font-extrabold" : "bg-transparent text-on-surface-variant font-bold")}>
              {b}º Bim
            </button>
          ))}
        </div>
      </div>

      {view === "notas" && (
        <div className="mx-4 mt-3.5 bg-[#0B4F2E] text-white rounded-[20px] p-4 flex flex-col gap-3.5 print:hidden">
          {alunos.length > 0 && (
            <div className="flex gap-2.5">
              <div className="flex-1">
                <p className="text-xs text-[#B9D9C7]">Média da turma</p>
                <p className="text-[30px] font-extrabold tracking-tight leading-tight">{mediaTurma !== null ? mediaTurma.toFixed(1).replace(".", ",") : "—"}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#B9D9C7]">Aprovados</p>
                <p className="text-[30px] font-extrabold tracking-tight leading-tight text-[#F2B632]">{aprovados}<span className="text-base text-[#B9D9C7]">/{comNota.length}</span></p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-[#B9D9C7]">Transferidos</p>
                <p className="text-[30px] font-extrabold tracking-tight leading-tight">{transferidosTotal}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)}
              className="flex-1 h-[46px] bg-[#F2B632] text-[#2B1F00] rounded-[13px] text-sm font-extrabold active:scale-95 transition-all flex items-center justify-center gap-2">
              <Upload className="w-[18px] h-[18px]" /> Carregar PDF
            </button>
            <button onClick={() => { setShowExcel(true); setExcelTurmas([]); setExcelMsg(null); }}
              className="h-[46px] px-3.5 border border-white/35 text-white rounded-[13px] text-[13px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5">
              <FileDown className="w-4 h-4" /> Excel
            </button>
            {alunos.length > 0 && !saved && (
              <button onClick={handleSalvar} disabled={isSaving}
                className="h-[46px] px-3.5 bg-white text-[#0B4F2E] rounded-[13px] text-[13px] font-extrabold active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar"}
              </button>
            )}
            {alunos.length > 0 && (
              <button
                onClick={gerarPdfSimaed}
                disabled={gerandoPdf}
                aria-label="Baixar PDF das notas"
                className="w-[46px] h-[46px] border border-white/35 text-white rounded-[13px] active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
              >
                {gerandoPdf ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <FileDown className="w-[18px] h-[18px]" />}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-4 pb-20">
        {isLoading ? (
          <div className="text-center p-10 text-gray-500">Carregando...</div>
        ) : view === "notas" ? (
          alunos.length > 0 ? (
            <>
              {syncMsg && <div className="mb-2 text-xs text-center text-blue-600 font-semibold">{syncMsg}</div>}
              <div className="bg-white rounded-[20px] border border-outline-variant overflow-hidden">
                {/* Header da lista */}
                <div className="flex items-center px-3.5 py-2.5 bg-[#F6F8F7] border-b border-surface-container text-[11px] font-extrabold tracking-[0.06em] text-on-surface-variant">
                  <span className="w-6 shrink-0">Nº</span>
                  <span className="flex-1">ALUNO</span>
                  <span className="w-12 text-center">FALTAS</span>
                  <span className="w-16 text-right">NOTA</span>
                </div>
                <div className="flex flex-col divide-y divide-surface-container">
                  {alunos.map(aluno => {
                    const transferido = /transferi|remanej/.test(aluno.situacao?.toLowerCase() ?? '');
                    const status = !transferido && aluno.nota !== null ? getStatus(aluno.nota!) : null;
                    return (
                      <div key={aluno.nome} className="px-3.5 py-3 flex items-center gap-1">
                        <span className="text-xs text-on-surface-variant w-6 shrink-0">{aluno.num}</span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className={cn("text-sm font-bold truncate", transferido ? "text-on-surface-variant line-through" : "text-on-surface")}>{formatarNome(aluno.nome)}</span>
                          {transferido ? (
                            <span className="text-[11px] text-[#B42318] font-semibold">{situacaoAbrev(aluno.situacao)}{aluno.data_situacao ? ` · ${aluno.data_situacao}` : ''}</span>
                          ) : status ? (
                            <span className="text-[11px] text-on-surface-variant">{status.text}</span>
                          ) : null}
                        </span>
                        <span className="w-12 text-center text-[13px] text-on-surface-variant shrink-0">
                          {transferido ? '-' : (aluno.faltas ?? 0)}
                        </span>
                        <span className="w-16 flex justify-end shrink-0">
                          {transferido ? (
                            <span className="text-[11px] font-extrabold text-on-surface-variant bg-[#E7ECE9] px-2 py-1.5 rounded-lg">{situacaoAbrev(aluno.situacao)}</span>
                          ) : (
                            <span className={cn("text-sm font-extrabold px-2.5 py-1.5 rounded-lg", notaChip(aluno.nota))}>{fmtNota(aluno.nota)}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado. Carregue um PDF do Simaed.</div>
          )
        ) : view === "desempenho" ? (
          desempenho.length > 0 ? (
            <div className="bg-surface rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-2 text-left font-bold text-gray-600">N</th>
                      <th className="p-2 text-left font-bold text-gray-600">Nome</th>
                      <th className="p-2 text-center font-bold text-gray-600">1B</th>
                      <th className="p-2 text-center font-bold text-gray-600">2B</th>
                      <th className="p-2 text-center font-bold text-gray-600">3B</th>
                      <th className="p-2 text-center font-bold text-gray-600">4B</th>
                      <th className="p-2 text-center font-bold text-gray-600">Med</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {desempenho.map(aluno => {
                      const media = aluno.media;
                      const mediaColor = media === null ? "text-gray-400" : media >= 5 ? "text-green-600" : media >= 3 ? "text-yellow-600" : "text-red-600";
                      return (
                        <tr key={aluno.nome} className="hover:bg-gray-50/50">
                          <td className="p-2 font-mono text-gray-400">{aluno.num}</td>
                          <td className="p-2 font-semibold text-textPrimary max-w-[100px] truncate">{formatarNome(aluno.nome)}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b1)}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b2)}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b3)}</td>
                          <td className="p-2 text-center text-blue-600 font-bold">{fmtNota(aluno.b4)}</td>
                          <td className={cn("p-2 text-center font-bold", mediaColor)}>{fmtNota(media)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado. Carregue os PDFs dos bimestres primeiro.</div>
          )
        ) : (
          grafico.length > 0 ? (
            <div className="bg-surface rounded-3xl border border-gray-200 p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">Media por Turma -- {bimestre}o Bimestre</h3>
              <div className="overflow-x-auto">
                <svg width={grafico.length * (BAR_W + GAP) + 40} height={BAR_H + 40}>
                  {grafico.map((item, i) => {
                    const x = 20 + i * (BAR_W + GAP);
                    const barH = (item.media / 10) * BAR_H;
                    const y = BAR_H - barH;
                    return (
                      <g key={item.turma}>
                        <rect x={x} y={y} width={BAR_W} height={barH} fill={getBarColor(item.media)} rx={4} />
                        <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="bold">
                          {item.media.toFixed(1).replace(".", ",")}
                        </text>
                        <text x={x + BAR_W / 2} y={BAR_H + 14} textAnchor="middle" fontSize={9} fill="#6b7280">
                          {item.turma}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="flex justify-center gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> 7,0</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> 5,0</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> 3,0</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> 3,0</span>
              </div>
            </div>
          ) : (
            <div className="text-center p-10 text-gray-500">Nenhum dado. Carregue PDFs das turmas primeiro.</div>
          )
        )}
      </div>

      {showExcel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold">Importar notas do Diário (Excel)</h3>
              <button onClick={() => setShowExcel(false)}><X /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Selecione de uma vez os arquivos <b>Notas-3BM-….xlsx</b> de todas as turmas (os mesmos lançados no Simaed).
              Se houver várias versões da mesma turma, vale a mais recente. Situação e faltas já cadastradas são mantidas.
            </p>
            <input type="file" multiple accept=".xlsx" onChange={handleExcelFiles} disabled={excelBusy}
              className="w-full p-3 border border-gray-300 rounded-xl mb-3" />
            {excelBusy ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /> : null}
            {excelTurmas.length > 0 && (
              <>
                <table className="w-full text-sm mb-3">
                  <thead><tr className="text-left text-xs text-gray-500"><th>Turma</th><th>Bim</th><th>Alunos</th><th>Com nota</th><th>Arquivo</th></tr></thead>
                  <tbody>
                    {excelTurmas.map(t => (
                      <tr key={t.turma + t.bimestre} className="border-t">
                        <td className="font-bold">{t.turma}</td><td>{t.bimestre}º</td><td>{t.alunos.length}</td>
                        <td>{t.alunos.filter(a => a.nota !== null).length}</td>
                        <td className="text-[10px] text-gray-500 truncate max-w-[140px]">{t.arquivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={salvarExcel} disabled={excelBusy}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-bold disabled:opacity-50">
                  Salvar {excelTurmas.length} turma(s)
                </button>
              </>
            )}
            {excelMsg && <p className="text-sm mt-3 whitespace-pre-line text-gray-700">{excelMsg}</p>}
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Carregar PDF -- Turma {turma} | {bimestre}o Bim</h3>
              <button onClick={() => setShowImport(false)}><X /></button>
            </div>
            {isProcessing ? (
              <div className="text-center py-10">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                <p className="text-lg font-bold">Analisando PDF...</p>
                <p className="text-sm text-gray-500">Extraindo notas, situacao e faltas...</p>
              </div>
            ) : (
              <input type="file" accept="application/pdf" onChange={handleFileUpload}
                className="w-full p-3 border border-gray-300 rounded-xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
