// Tipos compartilhados entre as telas que geram Sequência Didática via IA
// (Gerador de Sequência genérico e a aba dedicada de Esportes de Invasão).

export interface SituacaoAprendizagem {
  numero: number;
  titulo: string;
  objetivo: string;
  desenvolvimento: string;
  adaptacao: string;
  imageQuery: string;
  imageUrl?: string;
  imageAuthor?: string;
  imageBase64?: string;
  imageType?: string;
}

export interface Habilidade {
  codigo: string;
  descricao: string;
}

export interface Estacao {
  numero: number;
  fundamento: string;
  objetivo: string;
  passoAPasso: string;
  imageQuery: string;
  imageUrl?: string;
  imageAuthor?: string;
  imageBase64?: string;
  imageType?: string;
}

export interface Sequencia {
  objetivos: string;
  habilidades: Habilidade[];
  objetos_conhecimento: string[];
  aquecimento: string;
  situacoes: SituacaoAprendizagem[];
  estacoes?: Estacao[];
  valores_atitudinais: string;
  instrumentos_avaliacao: string;
  recursos: string;
  referencias: string[];
}
