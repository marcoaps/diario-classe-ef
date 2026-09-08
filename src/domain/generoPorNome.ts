// Heurística de gênero a partir do primeiro nome — usada só pra pré-preencher
// a tela "Marcar Gênero". O professor sempre revisa e confirma antes de
// salvar (os botões M/F continuam clicáveis normalmente), então um acerto
// parcial já economiza a maior parte dos cliques em vez de zerar o trabalho.

const NOMES_MASCULINOS = [
  'adrian', 'adriano', 'alan', 'alberto', 'alessandro', 'alexandre', 'alexsandro', 'alisson', 'anderson',
  'andre', 'angelo', 'antonio', 'antony', 'arthur', 'augusto', 'benicio', 'benjamin', 'bernardo', 'breno',
  'bruno', 'caio', 'carlos', 'cauã', 'cauan', 'cauê', 'cesar', 'charles', 'christian', 'cicero', 'claudio',
  'cristian', 'cristiano', 'daniel', 'danilo', 'davi', 'david', 'davy', 'diego', 'diogo', 'douglas', 'edson',
  'eduardo', 'elias', 'emanoel', 'emanuel', 'emerson', 'enzo', 'erick', 'erik', 'ernesto', 'estevan', 'estevao',
  'fabio', 'fabricio', 'felipe', 'fernando', 'francisco', 'gabriel', 'geovane', 'geovani', 'gilberto', 'giovani',
  'guilherme', 'gustavo', 'heitor', 'helio', 'henrique', 'hugo', 'iago', 'icaro', 'igor', 'isaac', 'isaias',
  'ismael', 'israel', 'ivan', 'jean', 'jefferson', 'joao', 'joaquim', 'jonas', 'jonathan', 'jorge', 'jose',
  'josé', 'josue', 'juan', 'julio', 'kaike', 'kaio', 'kauã', 'kauan', 'kauê', 'kevin', 'lauro', 'leandro',
  'leonardo', 'levi', 'liam', 'lorenzo', 'lucas', 'luan', 'luca', 'luiz', 'luís', 'marcelo', 'marco', 'marcos',
  'marcus', 'mateus', 'matheus', 'matias', 'maurício', 'mauricio', 'miguel', 'moises', 'murilo', 'nathan',
  'nicolas', 'nícolas', 'noah', 'norberto', 'otavio', 'otávio', 'oliver', 'pablo', 'paulo', 'pedro', 'rafael',
  'raul', 'renan', 'renato', 'ricardo', 'roberto', 'robson', 'rodrigo', 'ronaldo', 'ruan', 'ryan', 'salvador',
  'samuel', 'sergio', 'sérgio', 'thales', 'thiago', 'tiago', 'thomas', 'tomas', 'valentim', 'valter', 'victor',
  'vicente', 'vinicius', 'vinícius', 'vitor', 'vítor', 'wallace', 'washington', 'wesley', 'weslley', 'william',
  'wilson', 'yago', 'yan', 'yuri',
];

const NOMES_FEMININOS = [
  'adriana', 'agatha', 'ágatha', 'alana', 'alessandra', 'alexandra', 'alice', 'alicia', 'alícia', 'aline',
  'amanda', 'amanda', 'ana', 'andrea', 'andréa', 'angela', 'ângela', 'antonia', 'antônia', 'aparecida',
  'beatriz', 'bianca', 'bruna', 'camila', 'carla', 'carolina', 'catarina', 'cecilia', 'cecília', 'celia',
  'cíntia', 'cintia', 'clara', 'claudia', 'cláudia', 'cristiane', 'cristina', 'daniela', 'debora', 'débora',
  'diana', 'eduarda', 'elaine', 'eliane', 'elisa', 'eloa', 'eloá', 'eloisa', 'eloísa', 'emanuela', 'emily',
  'emilly', 'esther', 'ester', 'evelin', 'evelyn', 'fabiana', 'fatima', 'fernanda', 'flavia', 'flávia',
  'francisca', 'gabriela', 'geovana', 'giovana', 'giovanna', 'giulia', 'giulia', 'gizele', 'gleice', 'helena',
  'heloisa', 'heloísa', 'ingrid', 'iris', 'íris', 'isabel', 'isabela', 'isabella', 'isabelle', 'ivone', 'jaqueline',
  'jasmim', 'joana', 'joice', 'juliana', 'julia', 'júlia', 'juliane', 'karina', 'karoline', 'kauane', 'kelly',
  'laila', 'lara', 'larissa', 'laura', 'lavinia', 'lavínia', 'leila', 'leticia', 'letícia', 'liliana', 'livia',
  'lívia', 'lorena', 'luana', 'luciana', 'luiza', 'luísa', 'luisa', 'luna', 'luzia', 'magali', 'manuela',
  'marcela', 'margarida', 'maria', 'mariana', 'marina', 'marisa', 'marta', 'melissa', 'mel', 'mirela', 'mirian',
  'miriam', 'monica', 'mônica', 'natalia', 'natália', 'nicole', 'nicolly', 'olivia', 'olívia', 'patricia',
  'patrícia', 'paula', 'priscila', 'rafaela', 'raquel', 'rebeca', 'regina', 'renata', 'rita', 'roberta',
  'rosa', 'rosana', 'rosangela', 'sabrina', 'samara', 'samira', 'sara', 'sarah', 'silvia', 'sílvia', 'simone',
  'sofia', 'sophia', 'stefany', 'stephany', 'suelen', 'tainá', 'taina', 'talita', 'tatiane', 'valentina',
  'valeria', 'valéria', 'vanessa', 'vera', 'veronica', 'verônica', 'vitoria', 'vitória', 'viviane', 'yasmin',
  'yasmim', 'ysabela',
];

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Os nomes acima estão escritos com acento pra ficar legível no código, mas a
// busca é sempre por string normalizada (sem acento) — precisa normalizar o
// dicionário aqui também, senão "cauã" no dicionário nunca bate com "caua"
// vindo do nome do aluno.
const SET_M = new Set(NOMES_MASCULINOS.map(normalizar));
const SET_F = new Set(NOMES_FEMININOS.map(normalizar));

function primeiroNome(nomeCompleto: string): string {
  return normalizar((nomeCompleto.split(/\s+/)[0] || ''));
}

// Heurística de terminação — só usada quando o nome não está no dicionário.
// Menos confiável (tem exceções), mas o professor sempre revisa antes de
// salvar, então um palpite razoável aqui já ajuda mais do que atrapalha.
function palpiteePorTerminacao(primeiroNorm: string): 'M' | 'F' | null {
  if (/a$/.test(primeiroNorm) && !/(luca|nikola)$/.test(primeiroNorm)) return 'F';
  if (/o$/.test(primeiroNorm)) return 'M';
  return null;
}

export function inferirGenero(nomeCompleto: string): 'M' | 'F' | null {
  const primeiro = primeiroNome(nomeCompleto);
  if (!primeiro) return null;
  if (SET_M.has(primeiro)) return 'M';
  if (SET_F.has(primeiro)) return 'F';
  return palpiteePorTerminacao(primeiro);
}
