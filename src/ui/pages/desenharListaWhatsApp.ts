// Desenha a lista de uma turma como imagem (PNG) para postar no WhatsApp.
export interface ListaWhatsApp {
  turma: string;
  bimestre: number;
  alunos: { numero: number | null; nome: string }[];
  /** Data da prova já formatada (dd/mm); vazio omite a linha. */
  dataProva: string;
  /** Data em que a lista foi consultada (dd/mm). */
  atualizadaEm: string;
}

const FAMILIA = '"Plus Jakarta Sans", Inter, sans-serif';
const LARGURA = 1080;
const MARGEM = 64;
const CABECALHO = 300;
const LINHA = 64;

export async function desenharListaWhatsApp(d: ListaWhatsApp): Promise<Blob> {
  // Sem a fonte carregada o canvas usaria a fonte padrão.
  await Promise.all([500, 700, 800].map(p => document.fonts.load(`${p} 40px ${FAMILIA}`))).catch(() => {});

  const rodape = d.dataProva ? 290 : 220;
  const altura = CABECALHO + 24 + d.alunos.length * LINHA + 24 + rodape;
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = altura;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Este navegador não conseguiu desenhar a imagem.');

  const texto = (t: string, x: number, y: number, peso: number, tam: number, cor: string, maximo = LARGURA - 2 * MARGEM) => {
    c.font = `${peso} ${tam}px ${FAMILIA}`;
    c.fillStyle = cor;
    c.fillText(t, x, y, maximo);
  };
  c.textBaseline = 'middle';
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, LARGURA, altura);

  c.fillStyle = '#0B6B3A';
  c.fillRect(0, 0, LARGURA, CABECALHO);
  texto(`Educação Física · ${d.bimestre}º bimestre`, MARGEM, 68, 500, 36, '#FFFFFF');
  texto(`Turma ${d.turma}`, MARGEM, 158, 800, 100, '#FFFFFF');
  const total = d.alunos.length === 1 ? '1 aluno' : `${d.alunos.length} alunos`;
  texto(`Prova impressa · ${total}`, MARGEM, 248, 700, 42, '#FFFFFF');

  d.alunos.forEach((a, i) => {
    const topo = CABECALHO + 24 + i * LINHA;
    if (i % 2 === 1) {
      c.fillStyle = '#F1F6F3';
      c.fillRect(0, topo, LARGURA, LINHA);
    }
    const meio = topo + LINHA / 2 + 2;
    c.textAlign = 'right';
    texto(a.numero == null ? '-' : String(a.numero), MARGEM + 52, meio, 700, 34, '#4D6155', 60);
    c.textAlign = 'left';
    texto(a.nome, MARGEM + 84, meio, 500, 38, '#17251C', LARGURA - 2 * MARGEM - 84);
  });

  const base = altura - rodape;
  c.fillStyle = '#E3F2EA';
  c.fillRect(0, base, LARGURA, rodape);
  let y = base + 54;
  if (d.dataProva) {
    texto(`Prova em ${d.dataProva}`, MARGEM, y + 6, 800, 52, '#0B4F2C');
    y += 76;
  }
  texto('Fez a prova online?', MARGEM, y, 700, 40, '#0B4F2C');
  texto('Seu nome sai da próxima lista.', MARGEM, y + 54, 500, 40, '#0B4F2C');
  texto(`Lista atualizada em ${d.atualizadaEm}`, MARGEM, y + 118, 500, 30, '#3F5A4A');

  return new Promise((ok, falha) =>
    canvas.toBlob(b => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}
