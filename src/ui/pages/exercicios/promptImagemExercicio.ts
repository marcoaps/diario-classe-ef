// Monta, 100% no cliente, o prompt de imagem única (grade de painéis, um por
// cena) pro professor colar numa ferramenta externa de geração de imagem
// (ChatGPT Images, Leonardo, etc.) — mesmo princípio de `promptImagemCharges.ts`
// (grade regular + selo numerado por painel, pra bater com o recorte
// automático já existente em `RecorteImagemExercicios.tsx`), só que bem mais
// enxuto: sem personagens fixos nem balões de fala, já que Exercícios de
// Fixação são só texto + uma imagem de apoio por questão.

import { PROIBICOES_PROMPT_IMAGEM } from '../charges/regrasChargesDidaticas';
import { layoutQuaseQuadrado } from '../charges/imagemQuadroUtils';
import type { RoteiroExercicioIA } from './tiposExercicios';

function descreverGrade(numeroCenas: number): string {
  const fileiras = layoutQuaseQuadrado(numeroCenas);
  if (fileiras.length === 1) return `em 1 única fileira com ${fileiras[0]} painel(is) lado a lado`;
  return `em ${fileiras.length} fileira(s), com ${fileiras.join(', ')} painel(is) por fileira (de cima pra baixo)`;
}

function descreverProporcao(numeroCenas: number): string {
  const fileiras = layoutQuaseQuadrado(numeroCenas);
  const colunasMax = Math.max(...fileiras);
  const linhas = fileiras.length;
  if (colunasMax === linhas) return 'orientação QUADRADA (largura igual à altura)';
  return `orientação PAISAGEM — mais larga do que alta, proporção aproximada ${colunasMax}:${linhas} (largura:altura)`;
}

export function montarPromptImagemExercicio(roteiro: RoteiroExercicioIA, conteudo: string): string {
  const numeroCenas = roteiro.cenas.length;
  const blocosPorCena = roteiro.cenas
    .map(cena => `--- CENA ${cena.numero} ---\n${cena.descricaoCena}\nElementos que precisam aparecer: ${cena.elementosCenario.join(', ') || '(nenhum específico)'}`)
    .join('\n\n');

  return `
Ilustração educativa composta por ${numeroCenas} cena(s) em sequência, formando uma única imagem (grade de painéis, com uma pequena margem entre eles), sobre o tema "${conteudo}" — Educação Física, Ensino Fundamental.
GRADE OBRIGATÓRIA (siga exatamente esta organização): organize os painéis ${descreverGrade(numeroCenas)}. Preencha os painéis na ordem de leitura (esquerda→direita, de cima pra baixo) — a Cena 1 é o primeiro painel da 1ª fileira, e assim por diante.
ORIENTAÇÃO/PROPORÇÃO DA IMAGEM INTEIRA (obrigatório): gere o canvas completo em ${descreverProporcao(numeroCenas)} — nunca em retrato/vertical (mais alta que larga).
GRADE OBRIGATORIAMENTE REGULAR: todo painel deve ter EXATAMENTE o mesmo tamanho retangular que os outros, alinhados numa grade perfeitamente uniforme (linhas e colunas retas, margem/espaçamento idêntico entre todos os painéis) — necessário porque o professor recorta essa imagem depois dividindo-a nessa mesma grade.
NUMERAÇÃO DOS PAINÉIS (exceção às proibições de texto abaixo — isto é permitido): desenhe um pequeno selo/badge numerado (círculo ou quadrado sólido com o número da cena dentro, ex: "1", "2"...) no canto superior esquerdo de CADA painel, seguindo a ordem de leitura (1 a ${numeroCenas}), com margem de segurança das bordas.
Título: "${roteiro.titulo}"
Estilo artístico: didático, traços claros, cores vivas, apropriado pra Ensino Fundamental — MANTER O MESMO ESTILO em todos os painéis.

SE ALGUMA CENA TIVER BALÃO DE FALA OU QUALQUER TEXTO DENTRO DA IMAGEM (obrigatório quando houver): esta imagem será impressa BEM PEQUENA (poucos centímetros de largura) junto com a questão numa atividade — cada painel individual fica ainda menor depois de recortado. A fonte de qualquer texto dentro da imagem (balão de fala, letreiro, legenda) precisa ser GRANDE, GROSSA (bold) e de ALTO CONTRASTE (texto escuro em fundo branco/claro) — bem maior, proporcionalmente, do que o padrão usual de balão de HQ — para continuar legível mesmo reduzida, inclusive pra quem tem baixa visão. Se a fala for longa, aumente o balão pra caber o texto grande, em vez de diminuir a fonte. Nunca use fonte fina, cursiva ou decorativa. Prefira falas curtas.

${blocosPorCena}

PROIBIÇÕES OBRIGATÓRIAS (para a imagem inteira):
${PROIBICOES_PROMPT_IMAGEM.map(p => `- ${p}`).join('\n')}
`.trim();
}
