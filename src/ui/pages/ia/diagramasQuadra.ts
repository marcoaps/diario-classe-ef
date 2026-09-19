// Diagramas da quadra de handebol desenhados por código (SVG), com as medidas
// oficiais: quadra 40 x 20 m, gol de 3 m, linha da área do goleiro a 6 m,
// linha de tiro livre (tracejada) a 9 m e linha de 7 m. Não usam IA: saem sempre
// certos e iguais. Cada diagrama entra no banco de imagens como um item comum.
//
// As variações NÃO trazem nomes escritos (exceto "medidas", "distâncias" e
// "posições com nomes"), pra o professor poder perguntar "que linha é esta?"
// sem a imagem entregar a resposta.

import type { ItemBancoImagem } from './bancoImagens';

const COR = {
  piso: '#EDBE68',
  area: '#55B7E8',
  areaDestaque: '#FF8A65',
  linha: '#FFFFFF',
  destaque: '#E53935',
  trave: '#D32F2F',
  rede: '#CFD8DC',
  jogador: '#1E63B5',
  goleiro: '#2E9E4F',
  texto: '#1F2937',
  cota: '#374151',
};

type Destaque = 'area6' | 'linha9' | 'linha7' | 'gol' | 'central' | 'lateral' | 'fundo' | 'substituicao' | null;

// Jogador desenhado como bolinha: atacante (azul), defensor (vermelho), goleiro (verde) ou neutro (cinza).
interface Marcador { x: number; y: number; tipo: 'atq' | 'def' | 'gol' | 'neutro' }
const COR_MARCADOR: Record<Marcador['tipo'], string> = { atq: '#1E63B5', def: '#D32F2F', gol: '#2E9E4F', neutro: '#6B7280' };

function desenharMarcadores(marcadores: Marcador[]): string {
  return marcadores
    .map(m => `<circle cx="${m.x}" cy="${m.y}" r="0.75" fill="${COR_MARCADOR[m.tipo]}" stroke="#FFFFFF" stroke-width="0.14"/>`)
    .join('');
}

function desenharBola(b: { x: number; y: number }): string {
  return `<circle cx="${b.x}" cy="${b.y}" r="0.42" fill="#F57C00" stroke="#7C2D00" stroke-width="0.1"/>`;
}

const Y_TRAVE_1 = 8.5;   // gol de 3 m centrado na largura de 20 m
const Y_TRAVE_2 = 11.5;

// Contorno da linha a `r` metros do gol: dois quartos de círculo (centrados nas
// traves) ligados por um trecho reto de 3 m — é o formato das linhas de 6 e 9 m.
function caminhoLinha(r: number): string {
  return `M 0 ${Y_TRAVE_1 - r} A ${r} ${r} 0 0 1 ${r} ${Y_TRAVE_1} L ${r} ${Y_TRAVE_2} A ${r} ${r} 0 0 1 0 ${Y_TRAVE_2 + r}`;
}

// Um lado da quadra com o gol em x = 0 (a quadra inteira espelha este lado).
function ladoDaQuadra(destaque: Destaque): string {
  const d6 = destaque === 'area6';
  const d9 = destaque === 'linha9';
  const d7 = destaque === 'linha7';
  const dGol = destaque === 'gol';
  return `
    <path d="${caminhoLinha(6)} Z" fill="${d6 ? COR.areaDestaque : COR.area}" stroke="${d6 ? COR.destaque : COR.linha}" stroke-width="${d6 ? 0.34 : 0.14}" stroke-linejoin="round"/>
    <path d="${caminhoLinha(9)}" fill="none" stroke="${d9 ? COR.destaque : COR.linha}" stroke-width="${d9 ? 0.34 : 0.14}" stroke-dasharray="0.7 0.5" clip-path="url(#recorte)"/>
    <line x1="7" y1="9.5" x2="7" y2="10.5" stroke="${d7 ? COR.destaque : COR.linha}" stroke-width="${d7 ? 0.4 : 0.16}" stroke-linecap="butt"/>
    ${d7 ? '<circle cx="7" cy="10" r="1.15" fill="none" stroke="#E53935" stroke-width="0.2"/>' : ''}
    <rect x="-1" y="${Y_TRAVE_1}" width="1" height="3" fill="${COR.rede}" stroke="${COR.trave}" stroke-width="0.2"/>
    ${dGol ? `<rect x="-1.7" y="${Y_TRAVE_1 - 0.7}" width="2.4" height="4.4" rx="0.6" fill="none" stroke="${COR.destaque}" stroke-width="0.24"/>` : ''}`;
}

function texto(x: number, y: number, conteudo: string, opcoes: { tamanho?: number; ancora?: 'start' | 'middle' | 'end'; rotacao?: number } = {}): string {
  const { tamanho = 0.95, ancora = 'middle', rotacao } = opcoes;
  const giro = rotacao ? ` transform="rotate(${rotacao} ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${tamanho}" font-weight="bold" text-anchor="${ancora}" fill="${COR.texto}" stroke="#FFFFFF" stroke-width="${tamanho * 0.28}" paint-order="stroke" stroke-linejoin="round"${giro}>${conteudo}</text>`;
}

function seta(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COR.cota}" stroke-width="0.14" marker-start="url(#ponta)" marker-end="url(#ponta)"/>`;
}

function definicoes(largura: number): string {
  return `<defs>
    <clipPath id="recorte"><rect x="0" y="0" width="${largura}" height="20"/></clipPath>
    <marker id="ponta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="0.9" markerHeight="0.9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="${COR.cota}"/></marker>
  </defs>`;
}

function moldura(viewBox: string, corpo: string, largura: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="${viewBox}">
  <rect x="-100" y="-100" width="300" height="300" fill="#FFFFFF"/>
  ${definicoes(largura)}
  ${corpo}
</svg>`;
}

// ---------- meia quadra (gol à esquerda) ----------

interface Jogador { x: number; y: number; nome: string; goleiro?: boolean }

// Ataque em 3-3 visto de cima, atacando o gol da esquerda: quem ataca olha para a
// esquerda, então o lado direito do jogador fica em cima (y menor).
const POSICOES: Jogador[] = [
  { x: 0.9, y: 10, nome: 'Goleiro', goleiro: true },
  { x: 6.7, y: 10, nome: 'Pivô' },
  { x: 5.2, y: 1.6, nome: 'Ponta direita' },
  { x: 5.2, y: 18.4, nome: 'Ponta esquerda' },
  { x: 10.2, y: 5.4, nome: 'Armador direito' },
  { x: 10.2, y: 14.6, nome: 'Armador esquerdo' },
  { x: 11.6, y: 10, nome: 'Armador central' },
];

function meiaQuadra(opcoes: { destaque?: Destaque; distancias?: boolean; posicoes?: 'sem-nomes' | 'com-nomes'; marcadores?: Marcador[]; bola?: { x: number; y: number } }): string {
  const { destaque = null, distancias = false, posicoes, marcadores, bola } = opcoes;
  let extra = '';
  if (distancias) {
    extra += texto(4.7, 3.6, '6 m', { ancora: 'start' });
    extra += texto(7.2, 1.0, '9 m', { ancora: 'start' });
    extra += texto(7.35, 10.35, '7 m', { ancora: 'start' });
  }
  if (posicoes) {
    for (const j of POSICOES) {
      extra += `<circle cx="${j.x}" cy="${j.y}" r="0.75" fill="${j.goleiro ? COR.goleiro : COR.jogador}" stroke="#FFFFFF" stroke-width="0.14"/>`;
      if (posicoes === 'com-nomes') {
        const acimaDoCirculo = j.nome === 'Pivô' || j.nome === 'Armador central';
        extra += acimaDoCirculo
          ? texto(j.x, j.y + (j.nome === 'Pivô' ? -1.15 : 1.75), j.nome, { tamanho: 0.85 })
          : texto(j.x + 1.1, j.y + 0.3, j.nome, { tamanho: 0.85, ancora: 'start' });
      }
    }
  }
  if (marcadores) extra += desenharMarcadores(marcadores);
  if (bola) extra += desenharBola(bola);
  const corpo = `
  <g>
    <rect x="0" y="0" width="20" height="20" fill="${COR.piso}"/>
    ${ladoDaQuadra(destaque)}
    <rect x="0" y="0" width="20" height="20" fill="none" stroke="${COR.linha}" stroke-width="0.2"/>
    ${extra}
  </g>`;
  return moldura('-8 -2 36 24', corpo, 20);
}

// ---------- quadra inteira ----------

function quadraInteira(opcoes: { destaque?: Destaque; medidas?: boolean }): string {
  const { destaque = null, medidas = false } = opcoes;
  const central = destaque === 'central';
  const ladoDireito = destaque === 'gol' || destaque === 'area6' || destaque === 'linha9' || destaque === 'linha7' ? destaque : null;
  const D = COR.destaque;
  let destaques = '';
  if (destaque === 'lateral') {
    destaques = `<line x1="0" y1="0" x2="40" y2="0" stroke="${D}" stroke-width="0.5"/><line x1="0" y1="20" x2="40" y2="20" stroke="${D}" stroke-width="0.5"/>`;
  } else if (destaque === 'fundo') {
    destaques = `<line x1="0" y1="0" x2="0" y2="20" stroke="${D}" stroke-width="0.5"/><line x1="40" y1="0" x2="40" y2="20" stroke="${D}" stroke-width="0.5"/>`;
  } else if (destaque === 'substituicao') {
    // 4,5 m de cada lado da linha central, na lateral do banco.
    destaques = `<line x1="15.5" y1="20" x2="24.5" y2="20" stroke="${D}" stroke-width="0.7"/><line x1="15.5" y1="19.2" x2="15.5" y2="20.8" stroke="${D}" stroke-width="0.3"/><line x1="24.5" y1="19.2" x2="24.5" y2="20.8" stroke="${D}" stroke-width="0.3"/>`;
  }
  let cotas = '';
  if (medidas) {
    cotas = `
      ${seta(0, -2.4, 40, -2.4)} ${texto(20, -3.1, '40 m', { tamanho: 1.4 })}
      ${seta(41.4, 0, 41.4, 20)} ${texto(43.0, 10.5, '20 m', { tamanho: 1.4, rotacao: -90 })}`;
  }
  const corpo = `
  <g>
    <rect x="0" y="0" width="40" height="20" fill="${COR.piso}"/>
    <g>${ladoDaQuadra(ladoDireito)}</g>
    <g transform="translate(40 0) scale(-1 1)">${ladoDaQuadra(null)}</g>
    <line x1="20" y1="0" x2="20" y2="20" stroke="${central ? COR.destaque : COR.linha}" stroke-width="${central ? 0.42 : 0.16}"/>
    <rect x="0" y="0" width="40" height="20" fill="none" stroke="${COR.linha}" stroke-width="0.2"/>
    ${destaques}
    ${cotas}
  </g>`;
  return moldura('-4 -6 48 32', corpo, 40);
}

// ---------- gol visto de frente, com medidas (3 m x 2 m) ----------

function golComMedidas(): string {
  let rede = '';
  for (let x = 0.15; x < 3; x += 0.15) rede += `<line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="2" />`;
  for (let y = 0.15; y < 2; y += 0.15) rede += `<line x1="0" y1="${y.toFixed(2)}" x2="3" y2="${y.toFixed(2)}" />`;
  const corpo = `
  <g>
    <rect x="-2" y="2" width="7" height="0.6" fill="${COR.piso}"/>
    <g stroke="#90A4AE" stroke-width="0.03">${rede}</g>
    <path d="M 0 2 L 0 0 L 3 0 L 3 2" fill="none" stroke="${COR.trave}" stroke-width="0.14" stroke-linejoin="miter"/>
    <path d="M 0 2 L 0 0 L 3 0 L 3 2" fill="none" stroke="#FFFFFF" stroke-width="0.14" stroke-dasharray="0.35 0.35" stroke-linejoin="miter"/>
    ${seta(0, -0.7, 3, -0.7)} ${texto(1.5, -0.95, '3 m', { tamanho: 0.45 })}
    ${seta(-0.7, 0, -0.7, 2)} ${texto(-1.1, 1.05, '2 m', { tamanho: 0.45, rotacao: -90 })}
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="-2.25 -1.5 7.5 5">
  <rect x="-100" y="-100" width="300" height="300" fill="#FFFFFF"/>
  <defs><marker id="ponta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="0.3" markerHeight="0.3" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="${COR.cota}"/></marker></defs>
  ${corpo}
</svg>`;
}

// ---------- posições para os diagramas de jogadas ----------

// Cinco ou seis defensores acompanhando a linha de 6 m (um pouco por fora dela).
const D_EXT_ALTO: Marcador = { x: 2.9, y: 2.25, tipo: 'def' };
const D_MEIO_ALTO: Marcador = { x: 5.65, y: 4.54, tipo: 'def' };
const D_MEIO_BAIXO: Marcador = { x: 5.65, y: 15.46, tipo: 'def' };
const D_EXT_BAIXO: Marcador = { x: 2.9, y: 17.75, tipo: 'def' };
const GOLEIRO: Marcador = { x: 0.9, y: 10, tipo: 'gol' };

const DEFESA_6_0: Marcador[] = [GOLEIRO, D_EXT_ALTO, D_MEIO_ALTO, { x: 6.9, y: 8.9, tipo: 'def' }, { x: 6.9, y: 11.1, tipo: 'def' }, D_MEIO_BAIXO, D_EXT_BAIXO];
const DEFESA_5_1: Marcador[] = [GOLEIRO, D_EXT_ALTO, D_MEIO_ALTO, { x: 6.9, y: 10, tipo: 'def' }, D_MEIO_BAIXO, D_EXT_BAIXO, { x: 9.9, y: 10, tipo: 'def' }];
const DEFESA_3_2_1: Marcador[] = [GOLEIRO, { x: 3.4, y: 3.2, tipo: 'def' }, { x: 6.9, y: 10, tipo: 'def' }, { x: 3.4, y: 16.8, tipo: 'def' }, { x: 8.2, y: 6.3, tipo: 'def' }, { x: 8.2, y: 13.7, tipo: 'def' }, { x: 10.6, y: 10, tipo: 'def' }];

const TIRO_DE_7M: Marcador[] = [GOLEIRO, { x: 7.7, y: 10, tipo: 'atq' }, { x: 11, y: 4.5, tipo: 'neutro' }, { x: 11, y: 15.5, tipo: 'neutro' }, { x: 12.5, y: 8, tipo: 'neutro' }, { x: 12.5, y: 12, tipo: 'neutro' }];
const TIRO_LIVRE: Marcador[] = [GOLEIRO, { x: 6.9, y: 8.4, tipo: 'def' }, { x: 6.9, y: 10, tipo: 'def' }, { x: 6.9, y: 11.6, tipo: 'def' }, { x: 10.3, y: 10, tipo: 'atq' }, { x: 9.6, y: 5.2, tipo: 'atq' }, { x: 9.6, y: 14.8, tipo: 'atq' }];

// ---------- catálogo ----------

function paraDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function item(id: string, titulo: string, tags: string[], svg: string): ItemBancoImagem {
  return { id: `diag-${id}`, arquivo: paraDataUrl(svg), tipo: 'diagrama', titulo, tags, credito: '' };
}

const TAGS_QUADRA = ['quadra', 'campo', 'linhas', 'espaco', 'diagrama', 'desenho'];

export const DIAGRAMAS_QUADRA: ItemBancoImagem[] = [
  item('quadra-completa', 'Quadra completa (sem nomes)', [...TAGS_QUADRA, 'quadra completa', 'dimensoes'], quadraInteira({})),
  item('quadra-medidas', 'Quadra com medidas (40 m × 20 m)', [...TAGS_QUADRA, 'medidas', 'metros', 'comprimento', 'largura', 'tamanho', 'dimensoes'], quadraInteira({ medidas: true })),
  item('linha-central', 'Linha central destacada', [...TAGS_QUADRA, 'linha central', 'meio', 'meio da quadra', 'campo de ataque', 'campo de defesa'], quadraInteira({ destaque: 'central' })),
  item('meia-quadra', 'Meia quadra (sem nomes)', [...TAGS_QUADRA, 'meia quadra', 'area', 'gol'], meiaQuadra({})),
  item('area-goleiro', 'Área do goleiro (6 m) destacada', [...TAGS_QUADRA, 'area do goleiro', 'area', 'seis metros', '6 m', 'goleiro', 'gol'], meiaQuadra({ destaque: 'area6' })),
  item('linha-9m', 'Linha de tiro livre (9 m) destacada', [...TAGS_QUADRA, 'linha de 9', 'nove metros', '9 m', 'tiro livre', 'linha tracejada', 'falta'], meiaQuadra({ destaque: 'linha9' })),
  item('linha-7m', 'Linha de 7 metros destacada', [...TAGS_QUADRA, 'sete metros', '7 m', 'tiro de 7', 'penalti', 'sete', 'falta'], meiaQuadra({ destaque: 'linha7' })),
  item('gol', 'Gol destacado', [...TAGS_QUADRA, 'gol', 'trave', 'baliza', 'rede', 'meta'], meiaQuadra({ destaque: 'gol' })),
  item('distancias', 'Linhas de 6 m, 7 m e 9 m (com nomes)', [...TAGS_QUADRA, 'distancias', 'metros', '6 m', '7 m', '9 m', 'seis metros', 'sete metros', 'nove metros'], meiaQuadra({ distancias: true })),
  item('posicoes-sem-nomes', 'Posições em ataque (sem nomes)', ['posicao', 'posicoes', 'jogadores', 'ataque', 'formacao', 'goleiro', 'pivo', 'ponta', 'armador', 'sistema', 'tatica', 'diagrama', 'desenho', 'quadra'], meiaQuadra({ posicoes: 'sem-nomes' })),
  item('posicoes-com-nomes', 'Posições em ataque (com nomes)', ['posicao', 'posicoes', 'jogadores', 'ataque', 'formacao', 'goleiro', 'pivo', 'ponta', 'armador', 'sistema', 'tatica', 'diagrama', 'desenho', 'quadra'], meiaQuadra({ posicoes: 'com-nomes' })),
  item('defesa-6-0', 'Defesa 6:0 (sem nomes)', ['defesa', 'sistema de defesa', 'sistemas de defesa', 'defensores', 'marcacao', 'linha', 'seis zero', 'tatica', 'diagrama', 'desenho', 'quadra'], meiaQuadra({ marcadores: DEFESA_6_0 })),
  item('defesa-5-1', 'Defesa 5:1 (sem nomes)', ['defesa', 'sistema de defesa', 'sistemas de defesa', 'defensores', 'marcacao', 'avancado', 'cinco um', 'tatica', 'diagrama', 'desenho', 'quadra'], meiaQuadra({ marcadores: DEFESA_5_1 })),
  item('defesa-3-2-1', 'Defesa 3:2:1 (sem nomes)', ['defesa', 'sistema de defesa', 'sistemas de defesa', 'defensores', 'marcacao', 'tres dois um', 'tatica', 'diagrama', 'desenho', 'quadra'], meiaQuadra({ marcadores: DEFESA_3_2_1 })),
  item('tiro-7m', 'Tiro de 7 metros (posições)', [...TAGS_QUADRA, 'tiro de 7', 'sete metros', '7 m', 'penalti', 'cobranca', 'batedor', 'goleiro', 'posicoes'], meiaQuadra({ destaque: 'linha7', marcadores: TIRO_DE_7M, bola: { x: 7.7, y: 10.7 } })),
  item('tiro-livre', 'Tiro livre de 9 m com barreira', [...TAGS_QUADRA, 'tiro livre', 'barreira', 'nove metros', '9 m', 'falta', 'cobranca', 'defensores', 'posicoes'], meiaQuadra({ destaque: 'linha9', marcadores: TIRO_LIVRE, bola: { x: 10.3, y: 10.8 } })),
  item('zona-substituicao', 'Zona de substituição destacada', [...TAGS_QUADRA, 'zona de substituicao', 'substituicao', 'troca', 'banco', 'reserva', 'jogadores', 'regra'], quadraInteira({ destaque: 'substituicao' })),
  item('linhas-laterais', 'Linhas laterais destacadas', [...TAGS_QUADRA, 'linha lateral', 'linhas laterais', 'lateral', 'limite', 'saida de bola'], quadraInteira({ destaque: 'lateral' })),
  item('linhas-de-fundo', 'Linhas de fundo destacadas', [...TAGS_QUADRA, 'linha de fundo', 'linhas de fundo', 'fundo', 'linha de gol', 'limite', 'saida de bola'], quadraInteira({ destaque: 'fundo' })),
  item('gol-medidas', 'Gol de frente com medidas (3 m × 2 m)', ['gol', 'trave', 'baliza', 'rede', 'medidas', 'metros', 'largura', 'altura', 'tamanho', 'dimensoes', 'diagrama', 'desenho', 'equipamento'], golComMedidas()),
];
