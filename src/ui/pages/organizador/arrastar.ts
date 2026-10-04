// Organizador de Provas — arrastar e soltar. Lê os arquivos E as pastas soltos na tela, para que o
// usuário arraste o .doc e a pasta "..._arquivos" (imagens que o Word guarda ao lado) de uma vez.

const EXTENSOES_PROVA = ['docx', 'doc', 'html', 'htm', 'pdf', 'txt'];
const ehImagem = (f: File): boolean => f.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name);
const ehProva = (f: File): boolean => EXTENSOES_PROVA.includes((f.name.split('.').pop() || '').toLowerCase());

const lerArquivo = (e: FileSystemFileEntry): Promise<File> => new Promise((ok, falha) => e.file(ok, falha));
const lerLote = (r: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => new Promise((ok, falha) => r.readEntries(ok, falha));

async function percorrer(entrada: FileSystemEntry, saida: File[]): Promise<void> {
  if (entrada.isFile) { saida.push(await lerArquivo(entrada as FileSystemFileEntry)); return; }
  const leitor = (entrada as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const lote = await lerLote(leitor); // o navegador devolve a pasta em lotes
    if (lote.length === 0) break;
    for (const filho of lote) await percorrer(filho, saida);
  }
}

/** Todos os arquivos soltos, entrando nas pastas. (As entradas são lidas antes de qualquer await.) */
export async function lerSoltos(dt: Pick<DataTransfer, 'items' | 'files'>): Promise<File[]> {
  const entradas = Array.from(dt.items ?? [])
    .filter(i => i.kind === 'file')
    .map(i => (i as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() ?? null)
    .filter((e): e is FileSystemEntry => e !== null);
  if (entradas.length === 0) return Array.from(dt.files ?? []);
  const arquivos: File[] = [];
  for (const e of entradas) await percorrer(e, arquivos);
  return arquivos;
}

/** Separa o que foi solto na prova (documento) e nas imagens que a acompanham. */
export function separarSoltos(arquivos: File[]): { prova: File | null; imagens: File[] } {
  return { prova: arquivos.find(ehProva) ?? null, imagens: arquivos.filter(ehImagem) };
}
