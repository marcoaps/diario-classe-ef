// Importa para a tabela `notas` os arquivos Notas-{N}BM-{turma}.xlsx exportados
// pelo próprio Diário (Relatórios) — os mesmos valores lançados no Simaed.
// Os valores já vêm com as regras aplicadas (conversão do 3º Bim e arredondamento
// de 0,5): aqui só são lidos, nunca recalculados.
import * as XLSX from 'xlsx';
import { salvarNotas, buscarNotas } from '../data/supabase';

export interface NotasTurmaImportada {
  turma: string;
  bimestre: number;
  arquivo: string;
  modificadoEm: number;
  alunos: { numero: number; nome: string; nota: number | null; nota_texto: string | null; transferido: boolean }[];
}

const semAcentoMaiusculo = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

export async function lerArquivoNotas(file: File): Promise<NotasTurmaImportada> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const linhas = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });

  // "Turma: 6ºF" -> "6F"
  const cab = linhas[1] || [];
  const turma = String(cab[0] ?? '').replace(/^Turma:\s*/i, '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const bimestre = parseInt(String(cab[1] ?? '').replace(/\D/g, ''), 10);
  if (!/^\d[A-Z]$/.test(turma) || !(bimestre >= 1 && bimestre <= 4)) {
    throw new Error(`${file.name}: não parece um arquivo de notas do Diário (turma/bimestre não encontrados).`);
  }

  const iCab = linhas.findIndex(l => l && l[0] === 'No' && l[1] === 'Nome');
  if (iCab < 0) throw new Error(`${file.name}: cabeçalho "No / Nome" não encontrado.`);

  const alunos: NotasTurmaImportada['alunos'] = [];
  for (const l of linhas.slice(iCab + 1)) {
    if (!l || l[0] == null || l[1] == null) continue;
    const numero = Number(l[0]);
    if (!Number.isFinite(numero)) continue;
    const bruto = String(l[9] ?? '').trim();
    const nota = /^\d+([.,]\d+)?$/.test(bruto) ? parseFloat(bruto.replace(',', '.')) : null;
    const transferido = /^transf/i.test(bruto) || /^remanej/i.test(bruto);
    alunos.push({
      numero, nome: String(l[1]).trim(), nota,
      nota_texto: nota === null && !transferido && bruto ? bruto : null, // ex.: "AEE"
      transferido,
    });
  }
  return { turma, bimestre, arquivo: file.name, modificadoEm: file.lastModified, alunos };
}

// Várias versões da mesma turma/bimestre ("(1)", "(2)"…): fica a mais recente.
export function escolherMaisRecentes(lista: NotasTurmaImportada[]): NotasTurmaImportada[] {
  const mapa = new Map<string, NotasTurmaImportada>();
  for (const n of lista) {
    const k = `${n.turma}|${n.bimestre}`;
    const atual = mapa.get(k);
    if (!atual || n.modificadoEm > atual.modificadoEm) mapa.set(k, n);
  }
  return [...mapa.values()].sort((a, b) => a.turma.localeCompare(b.turma, 'pt-BR', { numeric: true }));
}

// Grava mantendo situação/data/faltas que a linha já tinha (só a nota é atualizada).
export async function salvarNotasImportadas(n: NotasTurmaImportada) {
  const existentes = await buscarNotas(n.turma, n.bimestre);
  const porNome = new Map<string, any>(existentes.map((e: any) => [semAcentoMaiusculo(e.nome), e]));
  await salvarNotas(n.turma, n.bimestre, n.alunos.map(a => {
    const atual = porNome.get(semAcentoMaiusculo(a.nome));
    let situacao = atual?.situacao ?? 'Em Curso';
    if (a.transferido && situacao === 'Em Curso') situacao = 'Foi Transferido';
    return {
      numero: a.numero,
      // Reaproveita o nome já gravado para cair no mesmo registro (turma,bimestre,nome).
      nome: atual?.nome ?? a.nome,
      nota: a.nota,
      nota_texto: a.nota_texto ?? atual?.nota_texto ?? null,
      situacao,
      data_situacao: atual?.data_situacao ?? '',
      faltas: atual?.faltas ?? 0,
    };
  }));
}
