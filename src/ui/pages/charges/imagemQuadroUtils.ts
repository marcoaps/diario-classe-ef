// ============================================================================
// Utilitários para o upload de imagens de quadro (geradas externamente em
// ChatGPT Images/Leonardo/etc. a partir do prompt de cada quadro, e enviadas
// de volta pelo professor). Tudo roda no navegador, sem servidor/storage:
// a imagem é redimensionada via <canvas>, normalizada para JPEG (controla o
// tamanho final e simplifica o uso em jsPDF/docx, que aceitam JPEG sem
// ambiguidade de formato) e guardada como data URL (base64).
// ============================================================================

export interface ImagemRedimensionada {
  dataUrl: string;
  largura: number;
  altura: number;
}

/** Lê um arquivo de imagem, redimensiona (mantendo proporção) se exceder `larguraMaxima`, e devolve como JPEG em base64. */
export function redimensionarImagemParaDataUrl(
  file: File,
  larguraMaxima = 1600,
  qualidadeJpeg = 0.85
): Promise<ImagemRedimensionada> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    leitor.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => reject(new Error('Arquivo selecionado não é uma imagem válida.'));
      imagem.onload = () => {
        const escala = Math.min(1, larguraMaxima / imagem.naturalWidth);
        const largura = Math.round(imagem.naturalWidth * escala);
        const altura = Math.round(imagem.naturalHeight * escala);

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem neste navegador.'));
          return;
        }
        // Fundo branco antes de desenhar — evita que PNGs com transparência virem pretas ao converter para JPEG.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(imagem, 0, 0, largura, altura);

        resolve({ dataUrl: canvas.toDataURL('image/jpeg', qualidadeJpeg), largura, altura });
      };
      imagem.src = leitor.result as string;
    };
    leitor.readAsDataURL(file);
  });
}

/**
 * Grade "quase quadrada" pra organizar N painéis: nº de fileiras ≈ raiz
 * quadrada de N, distribuindo o resto nas primeiras fileiras (nunca deixando
 * painel "sobrando" sozinho na última). Pra números que fecham num retângulo
 * perfeito (4, 6, 8, 9...) já dá exatamente esse retângulo; pra números
 * primos (5, 7...) dá fileiras desiguais (ex: 5 → [3, 2]) em vez de forçar
 * tudo numa linha só ou tudo empilhado.
 *
 * Usada tanto no prompt de geração de imagem (`promptImagemCharges.ts`,
 * pra pedir pra IA organizar os painéis exatamente assim) quanto no recorte
 * automático (`GeradorChargesCard.tsx`) — as duas pontas precisam concordar
 * no mesmo layout pra o recorte em grade bater com os painéis de verdade.
 */
export function layoutQuaseQuadrado(numeroQuadros: number): number[] {
  const linhas = Math.max(1, Math.round(Math.sqrt(numeroQuadros)));
  const base = Math.floor(numeroQuadros / linhas);
  const resto = numeroQuadros % linhas;
  return Array.from({ length: linhas }, (_, i) => base + (i < resto ? 1 : 0));
}

export interface RecorteQuadro {
  quadro: number;
  dataUrl: string;
  largura: number;
  altura: number;
}

/**
 * Recorta uma imagem única (grade de painéis, ex: a "Imagem da tira completa")
 * em `linhas` × `colunas` pedaços iguais, em ordem de leitura (esquerda→direita,
 * cima→baixo), numerando os quadros a partir de 1. Usado quando o professor
 * envia só a tira inteira e quer os recortes individuais para ilustrar cada
 * Quadro na exportação, sem precisar gerar/enviar uma imagem por quadro.
 */
export function recortarImagemEmQuadros(
  dataUrlOrigem: string,
  linhas: number,
  colunas: number,
  qualidadeJpeg = 0.85
): Promise<RecorteQuadro[]> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onerror = () => reject(new Error('Não foi possível carregar a imagem para recortar.'));
    imagem.onload = () => {
      const larguraTile = Math.floor(imagem.naturalWidth / colunas);
      const alturaTile = Math.floor(imagem.naturalHeight / linhas);
      if (larguraTile <= 0 || alturaTile <= 0) {
        reject(new Error('Layout de recorte inválido para o tamanho desta imagem.'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = larguraTile;
      canvas.height = alturaTile;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem neste navegador.'));
        return;
      }

      const recortes: RecorteQuadro[] = [];
      let numero = 1;
      for (let linha = 0; linha < linhas; linha++) {
        for (let coluna = 0; coluna < colunas; coluna++) {
          ctx.clearRect(0, 0, larguraTile, alturaTile);
          ctx.drawImage(
            imagem,
            coluna * larguraTile, linha * alturaTile, larguraTile, alturaTile,
            0, 0, larguraTile, alturaTile
          );
          recortes.push({ quadro: numero, dataUrl: canvas.toDataURL('image/jpeg', qualidadeJpeg), largura: larguraTile, altura: alturaTile });
          numero++;
        }
      }
      resolve(recortes);
    };
    imagem.src = dataUrlOrigem;
  });
}

/** Retângulo de recorte em porcentagem (0-100) da imagem original — usado pela ferramenta de ajuste manual (arrastar/redimensionar caixas), já que o recorte automático em grade nem sempre bate com os limites reais dos painéis gerados pela IA de imagem. */
export interface CaixaRecortePercentual {
  quadro: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Recorta uma imagem única usando retângulos ajustados manualmente (ver `CaixaRecortePercentual`) em vez de uma grade uniforme — mesma saída de `recortarImagemEmQuadros`, mas com controle fino por quadro. */
export function recortarImagemComCaixas(
  dataUrlOrigem: string,
  caixas: CaixaRecortePercentual[],
  qualidadeJpeg = 0.85
): Promise<RecorteQuadro[]> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onerror = () => reject(new Error('Não foi possível carregar a imagem para recortar.'));
    imagem.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem neste navegador.'));
        return;
      }

      const recortes: RecorteQuadro[] = [];
      for (const caixa of caixas) {
        const sx = (caixa.x / 100) * imagem.naturalWidth;
        const sy = (caixa.y / 100) * imagem.naturalHeight;
        const sw = (caixa.w / 100) * imagem.naturalWidth;
        const sh = (caixa.h / 100) * imagem.naturalHeight;
        const largura = Math.max(1, Math.round(sw));
        const altura = Math.max(1, Math.round(sh));

        canvas.width = largura;
        canvas.height = altura;
        ctx.clearRect(0, 0, largura, altura);
        ctx.drawImage(imagem, sx, sy, sw, sh, 0, 0, largura, altura);
        recortes.push({ quadro: caixa.quadro, dataUrl: canvas.toDataURL('image/jpeg', qualidadeJpeg), largura, altura });
      }
      resolve(recortes);
    };
    imagem.src = dataUrlOrigem;
  });
}

/** Converte uma data URL (ex: "data:image/jpeg;base64,...") em ArrayBuffer, para uso em `docx.ImageRun`. */
export function dataUrlParaArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}
