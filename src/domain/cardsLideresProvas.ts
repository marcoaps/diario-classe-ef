import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { coletarProvasDoBimestre } from './relatorioGeralProvas';
import type { Bimestre } from './useRelatorioFrequencia';

const VERDE = '#0B6B3A';
const VERDE_CLARO = '#E3F2EA';
const TEXTO = '#1E293B';
const FONTE = 'Arial, Helvetica, sans-serif';

const W = 1080;
const MARGEM = 64;
const ALTURA_LINHA = 58;

function desenharCard(turma: string, bimestre: Bimestre, nomes: string[], hoje: string): Promise<Blob> {
  const topo = 250;
  const subtitulo = 120;
  const rodape = 150;
  const H = topo + subtitulo + nomes.length * ALTURA_LINHA + rodape;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Cabeçalho
  ctx.fillStyle = VERDE;
  ctx.fillRect(0, 0, W, topo);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 34px ${FONTE}`;
  ctx.fillText(`Educação Física · ${bimestre}º Bimestre`, MARGEM, 84);
  ctx.font = `800 118px ${FONTE}`;
  ctx.fillText(`Turma ${turma}`, MARGEM, 200);

  // Subtítulo
  ctx.fillStyle = VERDE_CLARO;
  ctx.fillRect(MARGEM - 16, topo + 28, W - (MARGEM - 16) * 2, 70);
  ctx.fillStyle = VERDE;
  ctx.font = `800 38px ${FONTE}`;
  ctx.fillText(`Farão a prova (${nomes.length})`, MARGEM, topo + 76);

  // Nomes
  let y = topo + subtitulo + 40;
  nomes.forEach((nome, i) => {
    ctx.fillStyle = '#94A3B8';
    ctx.font = `700 30px ${FONTE}`;
    ctx.fillText(String(i + 1).padStart(2, '0'), MARGEM, y);
    ctx.fillStyle = TEXTO;
    ctx.font = `600 38px ${FONTE}`;
    // Reduz a fonte se o nome for muito largo.
    let tam = 38;
    while (ctx.measureText(nome).width > W - MARGEM * 2 - 70 && tam > 24) { tam -= 2; ctx.font = `600 ${tam}px ${FONTE}`; }
    ctx.fillText(nome, MARGEM + 70, y);
    if (i < nomes.length - 1) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(MARGEM, y + 14, W - MARGEM * 2, 2);
    }
    y += ALTURA_LINHA;
  });

  // Rodapé
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, H - rodape + 30, W, rodape - 30);
  ctx.fillStyle = '#475569';
  ctx.font = `600 28px ${FONTE}`;
  ctx.fillText('E.E. Instituto Odilon Pratagi · Prof. Marco Antonio', MARGEM, H - 64);
  ctx.font = `400 24px ${FONTE}`;
  ctx.fillText(`Lista atualizada em ${hoje}`, MARGEM, H - 28);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar imagem'))), 'image/png'));
}

// Um card (PNG) por turma com os nomes de quem fará a prova, para postar no grupo
// de líderes. Alunos do AEE entram na mesma lista, SEM marcação de AEE nem
// diagnóstico: é um grupo de alunos e essa informação não deve ser exposta.
export async function gerarCardsLideresProvas(bimestre: Bimestre) {
  const secoes = await coletarProvasDoBimestre(bimestre);
  const d = new Date();
  const hoje = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const zip = new JSZip();
  let n = 0;
  for (const s of secoes) {
    const todos = [...s.comum, ...s.adaptada]
      .sort((a, b) => (a.numero ?? 1e9) - (b.numero ?? 1e9) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((l) => l.nome);
    if (todos.length === 0) continue;
    const rotulo = `${s.turma[0]}º${s.turma.slice(1)}`;
    zip.file(`Card-${s.turma}-Prova-${bimestre}Bim.png`, await desenharCard(rotulo, bimestre, todos, hoje));
    n += 1;
  }
  if (n === 0) throw new Error('Nenhuma turma com alunos na prova.');
  saveAs(await zip.generateAsync({ type: 'blob' }), `Cards-Lideres-Prova-${bimestre}Bim.zip`);
  return n;
}
