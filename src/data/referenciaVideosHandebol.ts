// Referência técnica extraída dos vídeos de Handebol do próprio professor
// (Z:\Vídeos baixados do Youtube), analisados quadro a quadro em 18/08/2026.
// Usado para ancorar o passo a passo das Estações do Gerador de Sequências
// no que é realmente ensinado nesses vídeos, em vez de texto genérico da IA.
// Cobre apenas os fundamentos com conteúdo visual identificado nos vídeos —
// Drible e Marcação não aparecem claramente em nenhum deles.

export interface ReferenciaVideoFundamento {
  /** Palavras-chave para casar com o nome do fundamento digitado pelo professor. */
  palavrasChave: string[];
  fonteVideo: string;
  descricaoTecnica: string;
}

export const REFERENCIA_VIDEOS_HANDEBOL: ReferenciaVideoFundamento[] = [
  {
    palavrasChave: ["passe", "recepção", "recepcao", "empunhadura"],
    fonteVideo:
      "Vídeo aula de Handebol fundamentos Empunhadura e Recepção.mp4 + Fundamentos técnicos do Handebol - Drible, recepção, passe e passada.mp4",
    descricaoTecnica:
      "Empunhadura: dedos abertos e espalmados sobre a bola, mão dominante atrás/lateral da bola, mão de apoio dando estabilidade. " +
      "Recepção: existem 3 tipos conforme a altura da bola — alta, média e baixa. Em todas, as duas mãos ficam paralelas e levemente côncavas, palmas voltadas para frente, amortecendo a bola no momento do contato. " +
      "Passe de ombro: elevar a bola até a altura do ombro/cabeça com o cotovelo flexionado atrás da bola (erro comum a evitar: cotovelo caído/baixo), dar um passo à frente com a perna oposta à mão de arremesso, finalizar com extensão do braço e estalo de pulso na soltura. " +
      "Regra da dupla trifásica: depois de receber a bola, o jogador pode dar até 3 passos ou segurá-la parado por até 3 segundos antes de passar, arremessar ou driblar.",
  },
  {
    palavrasChave: ["arremesso", "finta"],
    fonteVideo:
      "Fundamentos técnicos do Handebol - parte 2 - Arremessos e Fintas.mp4",
    descricaoTecnica:
      "Arremesso em apoio: corrida de aproximação, último passo mais longo com a perna oposta à mão de arremesso, extensão do braço, finalização ainda com os pés apoiados no chão (antes da linha de área). " +
      "Arremesso de ponta (lado direito, jogador destro): corrida em diagonal pela lateral da quadra, salto em direção à linha de fundo, arremesso fechando o ângulo para o gol. " +
      "Arremesso de pivô: giro do corpo de costas para o goleiro (treinar o giro para os dois lados), buscando ângulo de finalização por cima do bloqueio da defesa. " +
      "Finta lateral: mudança rápida de direção do corpo e da bola para desequilibrar o defensor, criando espaço antes do arremesso ou do drible.",
  },
  {
    palavrasChave: ["deslocamento", "contra-ataque", "contra ataque"],
    fonteVideo:
      "EXERCÍCIO PARA O HANDEBOL #educaçãofísicaescolar #brincadeiras #handebol.mp4 + Treino de passe e deslocamento - Handebol..mp4",
    descricaoTecnica:
      "Circuito com cone central: o aluno se desloca contornando um cone/marcador no meio da quadra (simulando ultrapassar um defensor), recebe o passe já em movimento, sem parar, e continua o deslocamento até a próxima estação/cone. " +
      "Passe em contra-ataque (referência de jogo real): trocas rápidas de passe correndo em direção ao gol adversário, priorizando passe curto e preciso enquanto em deslocamento, evitando quicar a bola sem necessidade.",
  },
];

/** Casa um nome de fundamento digitado livremente com a referência de vídeo correspondente, se houver. */
export function buscarReferenciaVideo(fundamento: string): ReferenciaVideoFundamento | null {
  const alvo = fundamento.toLowerCase();
  return REFERENCIA_VIDEOS_HANDEBOL.find((ref) => ref.palavrasChave.some((p) => alvo.includes(p))) ?? null;
}
