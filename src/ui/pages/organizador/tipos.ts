// Organizador de Provas — modelo de dados.
// A prova importada é lida uma única vez para este modelo e nunca é alterada: toda a
// organização (colunas, tamanhos, quebras) acontece só no layout calculado a partir dele.

/** Trecho de texto com o mesmo estilo (negrito/itálico) do original. */
export interface Trecho { t: string; b?: boolean; i?: boolean }

export type Bloco =
  | { tipo: 'texto'; trechos: Trecho[] }
  /** Alternativa (A), B), ...) — mesmo desenho de texto, mas recuada e sem justificar. */
  | { tipo: 'alt'; trechos: Trecho[] }
  /** Imagem já normalizada (JPEG ou PNG em data URL) com o tamanho natural em px. */
  | { tipo: 'imagem'; src: string; w: number; h: number; formato: 'JPEG' | 'PNG' }
  /** Tabela de dados simples (sem células mescladas). */
  | { tipo: 'tabela'; linhas: string[][] };

export interface Questao {
  /** Blocos na ordem original: enunciado, imagens, alternativas... */
  blocos: Bloco[];
}

/** Uma prova completa dentro do arquivo. Arquivo com vários alunos tem uma seção por aluno. */
export interface Secao {
  /** Escola, disciplina, aluno... Fica fora das colunas, no topo de uma página nova. */
  cabecalho: Bloco[];
  questoes: Questao[];
  /** Gabarito, créditos etc. depois da última questão. */
  rodape: Bloco[];
}

export interface Prova {
  nomeArquivo: string;
  secoes: Secao[];
  /** Avisos amigáveis para mostrar ao usuário (imagem não lida, lista numerada...). */
  avisos: string[];
}

export const todosOsBlocos = (p: Prova): Bloco[] => p.secoes.flatMap(s => [...s.cabecalho, ...s.questoes.flatMap(q => q.blocos), ...s.rodape]);
export const totalDeQuestoes = (p: Prova): number => p.secoes.reduce((n, s) => n + s.questoes.length, 0);

export type Fonte = 'Arial' | 'Times New Roman';
export type Margens = 'estreita' | 'normal' | 'larga';
export type TamanhoImagem = 'auto' | 'pequena' | 'media' | 'grande';
export type AlinhamentoImagem = 'centro' | 'esquerda' | 'direita';

export interface Configuracao {
  fonte: Fonte;
  tamanho: number;
  colunas: 1 | 2;
  espacamento: number;
  margens: Margens;
  imagemTamanho: TamanhoImagem;
  imagemAlinhamento: AlinhamentoImagem;
  /** Espaço (pt) acima e abaixo de cada imagem. */
  imagemMargemSup: number;
  imagemMargemInf: number;
  /** Tira a logo/imagens do cabeçalho (economiza espaço no topo de cada prova). */
  removerLogo: boolean;
}

export const CONFIG_PADRAO: Configuracao = {
  fonte: 'Arial',
  tamanho: 12,
  colunas: 2,
  espacamento: 1,
  margens: 'normal',
  imagemTamanho: 'auto',
  imagemAlinhamento: 'centro',
  imagemMargemSup: 3,
  imagemMargemInf: 4,
  removerLogo: true,
};

export const textoPlano = (trechos: Trecho[]): string => trechos.map(t => t.t).join('');

export const ehTexto = (b: Bloco): b is Extract<Bloco, { tipo: 'texto' | 'alt' }> => b.tipo === 'texto' || b.tipo === 'alt';

/** Mensagem amigável + erro técnico só no console (regra do projeto: nada de erro bruto na tela). */
export class ErroAmigavel extends Error {
  constructor(public amigavel: string, causa?: unknown) {
    super(amigavel);
    if (causa) console.error('[Organizador de Provas]', amigavel, causa);
  }
}
