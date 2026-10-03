// Escolhe, no banco de imagens do app (grátis, sem IA), a imagem que melhor
// combina com uma questão do Gerador. Mesma pontuação por tags usada na
// Avaliação Adaptada: a resposta certa NÃO entra na busca, para não escolher
// justamente a imagem que entrega a resposta.
import { BANCO_IMAGENS, pontuarItemComTitulo } from '../ia/bancoImagens';
import type { ItemBancoImagem } from '../ia/bancoImagens';
import { imagemDeArquivo } from '../../../utils/imagemIA';
import type { QuestaoGerada } from './tiposGeradorQuestoes';

const PONTUACAO_MINIMA = 3;

export function sugerirImagemDoBanco(q: QuestaoGerada): ItemBancoImagem | null {
  const titulo = q.tituloInterno ?? '';
  const texto = [q.tituloInterno, q.contexto, q.enunciado, q.imagemQuery, q.conteudo].filter(Boolean).join(' ');
  let escolhido: ItemBancoImagem | null = null;
  let pontos = PONTUACAO_MINIMA - 1;
  for (const item of BANCO_IMAGENS) {
    const p = pontuarItemComTitulo(item, titulo, texto);
    if (p > pontos) { escolhido = item; pontos = p; }
  }
  return escolhido;
}

/** Carrega a imagem do banco como data URL JPEG (serve para tela, PDF e Word). */
export async function carregarImagemDoBanco(item: ItemBancoImagem): Promise<string> {
  const resp = await fetch(item.arquivo);
  if (!resp.ok) throw new Error('não consegui carregar a imagem do banco');
  return imagemDeArquivo(await resp.blob());
}

/** Coloca a melhor imagem do banco nas questões que pedem imagem e ainda não têm. Não mexe nas que já têm. */
export async function aplicarImagensDoBanco(questoes: QuestaoGerada[]): Promise<QuestaoGerada[]> {
  return Promise.all(questoes.map(async q => {
    if (!q.imagemQuery || q.imagemUrl) return q;
    const item = sugerirImagemDoBanco(q);
    if (!item) return q;
    try {
      return { ...q, imagemUrl: await carregarImagemDoBanco(item), imagemCredito: item.credito || null };
    } catch {
      return q;
    }
  }));
}
