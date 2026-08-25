// Habilidades oficiais da BNCC (Base Nacional Comum Curricular) para
// Educação Física no Ensino Fundamental — Anos Finais (item 4.1.3.2 do
// documento homologado, MEC, 2018). Fonte: BNCC_Educacao_Fisica_Anos_Finais.pdf.
//
// A BNCC organiza as habilidades por bloco de anos (6º/7º e 8º/9º), não por
// bimestre — por isso este arquivo é independente de `curriculumData.ts`
// (Plano de Curso do Acre, que é bimestral). Objeto de Conhecimento continua
// vindo do Plano de Curso; só a Habilidade passou a usar o código oficial.

export interface HabilidadeBNCCEducacaoFisica {
  codigo: string;
  texto: string;
  unidadeTematica: string;
  objetoConhecimento: string;
}

export type BlocoAnosBNCC = '67' | '89';

const HABILIDADES_67: HabilidadeBNCCEducacaoFisica[] = [
  { codigo: 'EF67EF01', unidadeTematica: 'Brincadeiras e jogos', objetoConhecimento: 'Jogos eletrônicos', texto: 'Experimentar e fruir, na escola e fora dela, jogos eletrônicos diversos, valorizando e respeitando os sentidos e significados atribuídos a eles por diferentes grupos sociais e etários.' },
  { codigo: 'EF67EF02', unidadeTematica: 'Brincadeiras e jogos', objetoConhecimento: 'Jogos eletrônicos', texto: 'Identificar as transformações nas características dos jogos eletrônicos em função dos avanços das tecnologias e nas respectivas exigências corporais colocadas por esses diferentes tipos de jogos.' },
  { codigo: 'EF67EF03', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de marca, de precisão, de invasão e técnico-combinatórios', texto: 'Experimentar e fruir esportes de marca, precisão, invasão e técnico-combinatórios, valorizando o trabalho coletivo e o protagonismo.' },
  { codigo: 'EF67EF04', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de marca, de precisão, de invasão e técnico-combinatórios', texto: 'Praticar um ou mais esportes de marca, precisão, invasão e técnico-combinatórios oferecidos pela escola, usando habilidades técnico-táticas básicas e respeitando regras.' },
  { codigo: 'EF67EF05', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de marca, de precisão, de invasão e técnico-combinatórios', texto: 'Planejar e utilizar estratégias para solucionar os desafios técnicos e táticos, tanto nos esportes de marca, precisão, invasão e técnico-combinatórios como nas modalidades esportivas escolhidas para praticar de forma específica.' },
  { codigo: 'EF67EF06', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de marca, de precisão, de invasão e técnico-combinatórios', texto: 'Analisar as transformações na organização e na prática dos esportes em suas diferentes manifestações (profissional e comunitário/lazer).' },
  { codigo: 'EF67EF07', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de marca, de precisão, de invasão e técnico-combinatórios', texto: 'Propor e produzir alternativas para experimentação dos esportes não disponíveis e/ou acessíveis na comunidade e das demais práticas corporais tematizadas na escola.' },
  { codigo: 'EF67EF08', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico', texto: 'Experimentar e fruir exercícios físicos que solicitem diferentes capacidades físicas, identificando seus tipos (força, velocidade, resistência, flexibilidade) e as sensações corporais provocadas pela sua prática.' },
  { codigo: 'EF67EF09', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico', texto: 'Construir, coletivamente, procedimentos e normas de convívio que viabilizem a participação de todos na prática de exercícios físicos, com o objetivo de promover a saúde.' },
  { codigo: 'EF67EF10', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico', texto: 'Diferenciar exercício físico de atividade física e propor alternativas para a prática de exercícios físicos dentro e fora do ambiente escolar.' },
  { codigo: 'EF67EF11', unidadeTematica: 'Danças', objetoConhecimento: 'Danças urbanas', texto: 'Experimentar, fruir e recriar danças urbanas, identificando seus elementos constitutivos (ritmo, espaço, gestos).' },
  { codigo: 'EF67EF12', unidadeTematica: 'Danças', objetoConhecimento: 'Danças urbanas', texto: 'Planejar e utilizar estratégias para aprender elementos constitutivos das danças urbanas.' },
  { codigo: 'EF67EF13', unidadeTematica: 'Danças', objetoConhecimento: 'Danças urbanas', texto: 'Diferenciar as danças urbanas das demais manifestações da dança, valorizando e respeitando os sentidos e significados atribuídos a eles por diferentes grupos sociais.' },
  { codigo: 'EF67EF14', unidadeTematica: 'Lutas', objetoConhecimento: 'Lutas do Brasil', texto: 'Experimentar, fruir e recriar diferentes lutas do Brasil, valorizando a própria segurança e integridade física, bem como as dos demais.' },
  { codigo: 'EF67EF15', unidadeTematica: 'Lutas', objetoConhecimento: 'Lutas do Brasil', texto: 'Planejar e utilizar estratégias básicas das lutas do Brasil, respeitando o colega como oponente.' },
  { codigo: 'EF67EF16', unidadeTematica: 'Lutas', objetoConhecimento: 'Lutas do Brasil', texto: 'Identificar as características (códigos, rituais, elementos técnico-táticos, indumentária, materiais, instalações, instituições) das lutas do Brasil.' },
  { codigo: 'EF67EF17', unidadeTematica: 'Lutas', objetoConhecimento: 'Lutas do Brasil', texto: 'Problematizar preconceitos e estereótipos relacionados ao universo das lutas e demais práticas corporais, propondo alternativas para superá-los, com base na solidariedade, na justiça, na equidade e no respeito.' },
  { codigo: 'EF67EF18', unidadeTematica: 'Práticas corporais de aventura', objetoConhecimento: 'Práticas corporais de aventura urbanas', texto: 'Experimentar e fruir diferentes práticas corporais de aventura urbanas, valorizando a própria segurança e integridade física, bem como as dos demais.' },
  { codigo: 'EF67EF19', unidadeTematica: 'Práticas corporais de aventura', objetoConhecimento: 'Práticas corporais de aventura urbanas', texto: 'Identificar os riscos durante a realização de práticas corporais de aventura urbanas e planejar estratégias para sua superação.' },
  { codigo: 'EF67EF20', unidadeTematica: 'Práticas corporais de aventura', objetoConhecimento: 'Práticas corporais de aventura urbanas', texto: 'Executar práticas corporais de aventura urbanas, respeitando o patrimônio público e utilizando alternativas para a prática segura em diversos espaços.' },
  { codigo: 'EF67EF21', unidadeTematica: 'Práticas corporais de aventura', objetoConhecimento: 'Práticas corporais de aventura urbanas', texto: 'Identificar a origem das práticas corporais de aventura e as possibilidades de recriá-las, reconhecendo as características (instrumentos, equipamentos de segurança, indumentária, organização) e seus tipos de práticas.' },
];

const HABILIDADES_89: HabilidadeBNCCEducacaoFisica[] = [
  { codigo: 'EF89EF01', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de rede/parede, de campo e taco, de invasão e de combate', texto: 'Experimentar diferentes papéis (jogador, árbitro e técnico) e fruir os esportes de rede/parede, campo e taco, invasão e combate, valorizando o trabalho coletivo e o protagonismo.' },
  { codigo: 'EF89EF02', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de rede/parede, de campo e taco, de invasão e de combate', texto: 'Praticar um ou mais esportes de rede/parede, campo e taco, invasão e combate oferecidos pela escola, usando habilidades técnico-táticas básicas.' },
  { codigo: 'EF89EF03', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de rede/parede, de campo e taco, de invasão e de combate', texto: 'Formular e utilizar estratégias para solucionar os desafios técnicos e táticos, tanto nos esportes de campo e taco, rede/parede, invasão e combate como nas modalidades esportivas escolhidas para praticar de forma específica.' },
  { codigo: 'EF89EF04', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de rede/parede, de campo e taco, de invasão e de combate', texto: 'Identificar os elementos técnicos ou técnico-táticos individuais, combinações táticas, sistemas de jogo e regras das modalidades esportivas praticadas, bem como diferenciar as modalidades esportivas com base nos critérios da lógica interna das categorias de esporte: rede/parede, campo e taco, invasão e combate.' },
  { codigo: 'EF89EF05', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de rede/parede, de campo e taco, de invasão e de combate', texto: 'Identificar as transformações históricas do fenômeno esportivo e discutir alguns de seus problemas (doping, corrupção, violência etc.) e a forma como as mídias os apresentam.' },
  { codigo: 'EF89EF06', unidadeTematica: 'Esportes', objetoConhecimento: 'Esportes de rede/parede, de campo e taco, de invasão e de combate', texto: 'Verificar locais disponíveis na comunidade para a prática de esportes e das demais práticas corporais tematizadas na escola, propondo e produzindo alternativas para utilizá-los no tempo livre.' },
  { codigo: 'EF89EF07', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico e de conscientização corporal', texto: 'Experimentar e fruir um ou mais programas de exercícios físicos, identificando as exigências corporais desses diferentes programas e reconhecendo a importância de uma prática individualizada, adequada às características e necessidades de cada sujeito.' },
  { codigo: 'EF89EF08', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico e de conscientização corporal', texto: 'Discutir as transformações históricas dos padrões de desempenho, saúde e beleza, considerando a forma como são apresentados nos diferentes meios (científico, midiático etc.).' },
  { codigo: 'EF89EF09', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico e de conscientização corporal', texto: 'Problematizar a prática excessiva de exercícios físicos e o uso de medicamentos para a ampliação do rendimento ou potencialização das transformações corporais.' },
  { codigo: 'EF89EF10', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico e de conscientização corporal', texto: 'Experimentar e fruir um ou mais tipos de ginástica de conscientização corporal, identificando as exigências corporais dos mesmos.' },
  { codigo: 'EF89EF11', unidadeTematica: 'Ginásticas', objetoConhecimento: 'Ginástica de condicionamento físico e de conscientização corporal', texto: 'Identificar as diferenças e semelhanças entre a ginástica de conscientização corporal e as de condicionamento físico e discutir como a prática de cada uma dessas manifestações pode contribuir para a melhoria das condições de vida, saúde, bem-estar e cuidado consigo mesmo.' },
  { codigo: 'EF89EF12', unidadeTematica: 'Danças', objetoConhecimento: 'Danças de salão', texto: 'Experimentar, fruir e recriar danças de salão, valorizando a diversidade cultural e respeitando a tradição dessas culturas.' },
  { codigo: 'EF89EF13', unidadeTematica: 'Danças', objetoConhecimento: 'Danças de salão', texto: 'Planejar e utilizar estratégias para se apropriar dos elementos constitutivos (ritmo, espaço, gestos) das danças de salão.' },
  { codigo: 'EF89EF14', unidadeTematica: 'Danças', objetoConhecimento: 'Danças de salão', texto: 'Discutir estereótipos e preconceitos relativos às danças de salão e demais práticas corporais e propor alternativas para sua superação.' },
  { codigo: 'EF89EF15', unidadeTematica: 'Danças', objetoConhecimento: 'Danças de salão', texto: 'Analisar as características (ritmos, gestos, coreografias e músicas) das danças de salão, bem como suas transformações históricas e os grupos de origem.' },
  { codigo: 'EF89EF16', unidadeTematica: 'Lutas', objetoConhecimento: 'Lutas do mundo', texto: 'Experimentar e fruir a execução dos movimentos pertencentes às lutas do mundo, adotando procedimentos de segurança e respeitando o oponente.' },
  { codigo: 'EF89EF17', unidadeTematica: 'Lutas', objetoConhecimento: 'Lutas do mundo', texto: 'Planejar e utilizar estratégias básicas das lutas experimentadas, reconhecendo as suas características técnico-táticas.' },
  { codigo: 'EF89EF18', unidadeTematica: 'Lutas', objetoConhecimento: 'Lutas do mundo', texto: 'Discutir as transformações históricas, o processo de esportivização e a midiatização de uma ou mais lutas, valorizando e respeitando as culturas de origem.' },
  { codigo: 'EF89EF19', unidadeTematica: 'Práticas corporais de aventura', objetoConhecimento: 'Práticas corporais de aventura na natureza', texto: 'Experimentar e fruir diferentes práticas corporais de aventura na natureza, valorizando a própria segurança e integridade física, bem como as dos demais, respeitando o patrimônio natural e minimizando os impactos de degradação ambiental.' },
  { codigo: 'EF89EF20', unidadeTematica: 'Práticas corporais de aventura', objetoConhecimento: 'Práticas corporais de aventura na natureza', texto: 'Identificar riscos, formular estratégias e observar normas de segurança para superar os desafios na realização de práticas corporais de aventura na natureza.' },
  { codigo: 'EF89EF21', unidadeTematica: 'Práticas corporais de aventura', objetoConhecimento: 'Práticas corporais de aventura na natureza', texto: 'Identificar as características (equipamentos de segurança, instrumentos, indumentária, organização) das práticas corporais de aventura na natureza, bem como suas transformações históricas.' },
];

export const BNCC_EF_ANOS_FINAIS: Record<BlocoAnosBNCC, HabilidadeBNCCEducacaoFisica[]> = {
  '67': HABILIDADES_67,
  '89': HABILIDADES_89,
};

/** 6º e 7º anos compartilham o mesmo bloco de habilidades na BNCC; 8º e 9º, outro. */
export function getBlocoAnosBNCC(anoEscolar: number): BlocoAnosBNCC {
  return anoEscolar <= 7 ? '67' : '89';
}

export function getHabilidadesBNCC(anoEscolar: number): HabilidadeBNCCEducacaoFisica[] {
  return BNCC_EF_ANOS_FINAIS[getBlocoAnosBNCC(anoEscolar)];
}

/** Formato exibido nos dropdowns e salvo em `habilidadeBncc` — ex: "(EF67EF03) Experimentar e fruir esportes...". */
export function formatarHabilidadeBNCC(h: HabilidadeBNCCEducacaoFisica): string {
  return `(${h.codigo}) ${h.texto}`;
}
