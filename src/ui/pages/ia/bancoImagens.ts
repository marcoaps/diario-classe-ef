import { DIAGRAMAS_QUADRA } from './diagramasQuadra';

// Banco de imagens aprovadas pelo professor: pictogramas (ARASAAC), fotos
// (Wikimedia Commons), guardados em public/banco-imagens, e diagramas da quadra
// desenhados por código (diagramasQuadra.ts). Só entra aqui imagem
// que o professor viu e aprovou. Para acrescentar uma, coloque o arquivo em
// public/banco-imagens e crie um item nesta lista (com o crédito certo).
// As tags são palavras sem acento e em minúsculas, usadas para sugerir imagens
// conforme o texto da questão.

export type TipoImagemBanco = 'pictograma' | 'foto' | 'diagrama';

export interface ItemBancoImagem {
  id: string;
  /** Caminho público do arquivo (public/banco-imagens/...) ou, nos diagramas, um data URL SVG. */
  arquivo: string;
  tipo: TipoImagemBanco;
  titulo: string;
  tags: string[];
  /** Crédito que sai no rodapé da prova (exigido pelas licenças). Vazio nos diagramas, que são desenhados aqui. */
  credito: string;
}

const ITENS_DE_ARQUIVO: ItemBancoImagem[] = [
  {
    id: 'pic-34112',
    arquivo: '/banco-imagens/pictogramas/34112.png',
    tipo: 'pictograma',
    titulo: 'Bola de handebol',
    tags: ['bola', 'bola de handebol', 'material', 'equipamento'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-2535',
    arquivo: '/banco-imagens/pictogramas/2535.png',
    tipo: 'pictograma',
    titulo: 'Gol (trave e rede)',
    tags: ['gol', 'trave', 'baliza', 'rede', 'equipamento'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-5067',
    arquivo: '/banco-imagens/pictogramas/5067.png',
    tipo: 'pictograma',
    titulo: 'Quadra de handebol',
    tags: ['quadra', 'campo', 'linhas', 'area', 'espaco', 'dimensoes'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-5079',
    arquivo: '/banco-imagens/pictogramas/5079.png',
    tipo: 'pictograma',
    titulo: 'Jogador de handebol',
    tags: ['jogador', 'atleta', 'uniforme', 'bola na mao'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-34413',
    arquivo: '/banco-imagens/pictogramas/34413.png',
    tipo: 'pictograma',
    titulo: 'Jogadora de handebol',
    tags: ['jogadora', 'atleta', 'uniforme', 'bola na mao'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-10159',
    arquivo: '/banco-imagens/pictogramas/10159.png',
    tipo: 'pictograma',
    titulo: 'Arremesso com marcação',
    tags: ['arremesso', 'atacante', 'defensor', 'defesa', 'disputa', 'jogo', 'salto'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-39837',
    arquivo: '/banco-imagens/pictogramas/39837.png',
    tipo: 'pictograma',
    titulo: 'Goleiro',
    tags: ['goleiro', 'guarda-redes', 'defesa', 'gol'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-35364',
    arquivo: '/banco-imagens/pictogramas/35364.png',
    tipo: 'pictograma',
    titulo: 'Apito do árbitro',
    tags: ['apito', 'arbitro', 'juiz', 'sinal', 'inicio do jogo'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-8371',
    arquivo: '/banco-imagens/pictogramas/8371.png',
    tipo: 'pictograma',
    titulo: 'Cartão vermelho',
    tags: ['cartao vermelho', 'exclusao', 'falta', 'punicao', 'arbitro'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-6829',
    arquivo: '/banco-imagens/pictogramas/6829.png',
    tipo: 'pictograma',
    titulo: 'Passe',
    tags: ['passe', 'passar', 'receber', 'colega', 'equipe'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-39832',
    arquivo: '/banco-imagens/pictogramas/39832.png',
    tipo: 'pictograma',
    titulo: 'Lançar a bola',
    tags: ['lancar', 'arremessar', 'arremesso', 'lancamento', 'jogar a bola'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-6465',
    arquivo: '/banco-imagens/pictogramas/6465.png',
    tipo: 'pictograma',
    titulo: 'Correr',
    tags: ['correr', 'corrida', 'deslocamento', 'contra-ataque'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-39052',
    arquivo: '/banco-imagens/pictogramas/39052.png',
    tipo: 'pictograma',
    titulo: 'Saltar',
    tags: ['saltar', 'salto', 'pular'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-26018',
    arquivo: '/banco-imagens/pictogramas/26018.png',
    tipo: 'pictograma',
    titulo: 'Cronômetro',
    tags: ['cronometro', 'tempo', 'duracao', 'minutos'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-31892',
    arquivo: '/banco-imagens/pictogramas/31892.png',
    tipo: 'pictograma',
    titulo: 'Jogar com a bola',
    tags: ['jogar', 'bola', 'brincar', 'jogo'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-3128',
    arquivo: '/banco-imagens/pictogramas/3128.png',
    tipo: 'pictograma',
    titulo: 'Medalha',
    tags: ['medalha', 'premiacao', 'vencedor', 'campeao'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'foto-bola-quadra',
    arquivo: '/banco-imagens/fotos/foto-bola-quadra.jpg',
    tipo: 'foto',
    titulo: 'Bola de handebol na quadra',
    tags: ['bola', 'bola de handebol', 'equipamento', 'quadra'],
    credito: 'Foto: Armin Kuebelbeck, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-arremesso-suspensao',
    arquivo: '/banco-imagens/fotos/foto-arremesso-suspensao.jpg',
    tipo: 'foto',
    titulo: 'Arremesso em suspensão',
    tags: ['arremesso', 'arremesso em suspensao', 'salto', 'atacante', 'jogo'],
    credito: 'Foto: Carlos Delgado, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-arremesso-marcacao',
    arquivo: '/banco-imagens/fotos/foto-arremesso-marcacao.jpg',
    tipo: 'foto',
    titulo: 'Arremesso com marcação',
    tags: ['arremesso', 'atacante', 'defesa', 'marcacao', 'jogadora', 'disputa'],
    credito: 'Foto: Ailura, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-arremesso-gol',
    arquivo: '/banco-imagens/fotos/foto-arremesso-gol.jpg',
    tipo: 'foto',
    titulo: 'Arremesso em direção ao gol',
    tags: ['gol', 'arremesso', 'goleiro', 'trave', 'rede', 'salto'],
    credito: 'Foto: Armin Kübelbeck, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-quadra-vista-alto',
    arquivo: '/banco-imagens/fotos/foto-quadra-vista-alto.jpg',
    tipo: 'foto',
    titulo: 'Quadra vista de cima, com goleiro',
    tags: ['quadra', 'area do goleiro', 'goleiro', 'linhas', 'visao de cima', 'posicao'],
    credito: 'Foto: Ahodges7, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-arbitro',
    arquivo: '/banco-imagens/fotos/foto-arbitro.jpg',
    tipo: 'foto',
    titulo: 'Árbitro em quadra',
    tags: ['arbitro', 'juiz', 'jogo passivo', 'sinal'],
    credito: 'Foto: Wenflou, Wikimedia Commons, CC0',
  },
  {
    id: 'foto-defesa-ataque',
    arquivo: '/banco-imagens/fotos/foto-defesa-ataque.jpg',
    tipo: 'foto',
    titulo: 'Defesa e ataque',
    tags: ['defesa', 'ataque', 'marcacao', 'jogo', 'contato'],
    credito: 'Foto: Max Petershans, Wikimedia Commons, CC BY-SA 4.0',
  },
];

/** Tudo que aparece no seletor: imagens de arquivo + diagramas da quadra (desenhados por código). */
export const BANCO_IMAGENS: ItemBancoImagem[] = [...ITENS_DE_ARQUIVO, ...DIAGRAMAS_QUADRA];

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Pontuação do item para uma questão: o título da questão (a palavra-chave que
 * nomeia o assunto, ex.: BOLA, ÁRBITRO) pesa mais que o resto do texto, para uma
 * palavra solta como "jogo" não vencer o assunto de verdade.
 */
export function pontuarItemComTitulo(item: ItemBancoImagem, titulo: string, textoQuestao: string): number {
  return pontuarItem(item, textoQuestao) + 3 * pontuarItem(item, titulo);
}

/** Quantas tags do item aparecem no texto da questão (0 = não tem relação). */
export function pontuarItem(item: ItemBancoImagem, textoQuestao: string): number {
  const texto = semAcento(textoQuestao);
  return item.tags.reduce((total, tag) => total + (texto.includes(tag) ? 1 + Math.floor(tag.length / 8) : 0), 0);
}
