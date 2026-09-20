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
    tags: ['gol', 'arremesso', 'trave', 'rede', 'salto'],
    credito: 'Foto: Armin Kübelbeck, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-quadra-vista-alto',
    arquivo: '/banco-imagens/fotos/foto-quadra-vista-alto.jpg',
    tipo: 'foto',
    titulo: 'Quadra vista de cima, com goleiro',
    tags: ['quadra', 'area do goleiro', 'linhas', 'visao de cima', 'posicao'],
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
  {
    id: 'pic-8370',
    arquivo: '/banco-imagens/pictogramas/8370.png',
    tipo: 'pictograma',
    titulo: 'Cartão amarelo',
    tags: ['cartao amarelo', 'advertencia', 'aviso', 'falta', 'punicao', 'arbitro', 'disciplina'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-6147',
    arquivo: '/banco-imagens/pictogramas/6147.png',
    tipo: 'pictograma',
    titulo: 'Placar',
    tags: ['placar', 'resultado', 'marcador', 'pontos', 'pontuacao', 'vitoria', 'empate', 'tempo'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-5991',
    arquivo: '/banco-imagens/pictogramas/5991.png',
    tipo: 'pictograma',
    titulo: 'Treinador no banco',
    tags: ['treinador', 'tecnico', 'banco', 'banco de reservas', 'reservas', 'suplentes', 'substituicao', 'comissao tecnica'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-24783',
    arquivo: '/banco-imagens/pictogramas/24783.png',
    tipo: 'pictograma',
    titulo: 'Público (torcida)',
    tags: ['publico', 'torcida', 'plateia', 'torcedores', 'assistencia', 'ginasio'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-4740',
    arquivo: '/banco-imagens/pictogramas/4740.png',
    tipo: 'pictograma',
    titulo: 'Aperto de mão (fair play)',
    tags: ['cumprimento', 'cumprimentar', 'aperto de mao', 'fair play', 'respeito', 'esportividade', 'adversario', 'amizade'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-6610',
    arquivo: '/banco-imagens/pictogramas/6610.png',
    tipo: 'pictograma',
    titulo: 'Cumprimento entre jogadores',
    tags: ['cumprimento', 'cumprimentar', 'aperto de mao', 'fair play', 'respeito', 'esportividade', 'adversario', 'amizade'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-4563',
    arquivo: '/banco-imagens/pictogramas/4563.png',
    tipo: 'pictograma',
    titulo: 'Aplaudir',
    tags: ['aplaudir', 'aplauso', 'palmas', 'torcida', 'comemorar', 'parabens'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-3162',
    arquivo: '/banco-imagens/pictogramas/3162.png',
    tipo: 'pictograma',
    titulo: 'Troféu',
    tags: ['trofeu', 'taca', 'campeao', 'vencedor', 'premiacao', 'campeonato', 'torneio'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-36417',
    arquivo: '/banco-imagens/pictogramas/36417.png',
    tipo: 'pictograma',
    titulo: 'Medalha de prata',
    tags: ['medalha', 'prata', 'segundo lugar', 'premiacao', 'podio'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-36416',
    arquivo: '/banco-imagens/pictogramas/36416.png',
    tipo: 'pictograma',
    titulo: 'Medalha de bronze',
    tags: ['medalha', 'bronze', 'terceiro lugar', 'premiacao', 'podio'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-14540',
    arquivo: '/banco-imagens/pictogramas/14540.png',
    tipo: 'pictograma',
    titulo: 'Joelheira',
    tags: ['joelheira', 'protecao', 'equipamento', 'lesao', 'seguranca', 'joelho'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-2621',
    arquivo: '/banco-imagens/pictogramas/2621.png',
    tipo: 'pictograma',
    titulo: 'Tênis esportivo',
    tags: ['tenis', 'sapatilha', 'calcado', 'equipamento', 'uniforme', 'sapato'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-36506',
    arquivo: '/banco-imagens/pictogramas/36506.png',
    tipo: 'pictograma',
    titulo: 'Aquecimento',
    tags: ['aquecimento', 'aquecer', 'preparacao', 'corrida', 'antes do jogo', 'exercicio'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-39053',
    arquivo: '/banco-imagens/pictogramas/39053.png',
    tipo: 'pictograma',
    titulo: 'Alongamento',
    tags: ['alongamento', 'alongar', 'flexibilidade', 'exercicio', 'tocar os pes'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-8469',
    arquivo: '/banco-imagens/pictogramas/8469.png',
    tipo: 'pictograma',
    titulo: 'Suar (suor)',
    tags: ['suar', 'suor', 'cansaco', 'esforco', 'calor', 'exercicio'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-37207',
    arquivo: '/banco-imagens/pictogramas/37207.png',
    tipo: 'pictograma',
    titulo: 'Hidratar-se',
    tags: ['hidratacao', 'hidratar', 'beber agua', 'agua', 'sede', 'garrafa'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'pic-6182',
    arquivo: '/banco-imagens/pictogramas/6182.png',
    tipo: 'pictograma',
    titulo: 'Apito',
    tags: ['apito', 'apitar', 'arbitro', 'juiz', 'sinal', 'inicio do jogo'],
    credito: 'Pictogramas: ARASAAC (arasaac.org), autor Sergio Palao, propriedade do Governo de Aragão (Espanha), licença CC BY-NC-SA',
  },
  {
    id: 'foto-tempo-tecnico',
    arquivo: '/banco-imagens/fotos/foto-tempo-tecnico.jpg',
    tipo: 'foto',
    titulo: 'Tempo técnico (equipe reunida)',
    tags: ['tempo tecnico', 'time out', 'equipe', 'conversa', 'tecnico', 'estrategia', 'pedido de tempo'],
    credito: 'Foto: Armin Kuebelbeck, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-tempo-tecnico-2',
    arquivo: '/banco-imagens/fotos/foto-tempo-tecnico-2.jpg',
    tipo: 'foto',
    titulo: 'Tempo técnico em quadra',
    tags: ['tempo tecnico', 'time out', 'equipe', 'conversa', 'tecnico', 'estrategia', 'pedido de tempo'],
    credito: 'Foto: dronepicr, Wikimedia Commons, CC BY 2.0',
  },
  {
    id: 'foto-drible-jogador',
    arquivo: '/banco-imagens/fotos/foto-drible-jogador.jpg',
    tipo: 'foto',
    titulo: 'Jogador conduzindo a bola',
    tags: ['drible', 'driblar', 'conduzir a bola', 'ataque', 'atacante', 'jogador'],
    credito: 'Foto: Michael Frey, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-protecao-da-bola',
    arquivo: '/banco-imagens/fotos/foto-protecao-da-bola.jpg',
    tipo: 'foto',
    titulo: 'Atacante protegendo a bola do defensor',
    tags: ['drible', 'marcacao', 'defesa', 'protecao da bola', 'disputa', 'contato', 'atacante', 'defensor'],
    credito: 'Foto: Michael Frey, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-defesa-contato',
    arquivo: '/banco-imagens/fotos/foto-defesa-contato.jpg',
    tipo: 'foto',
    titulo: 'Defesa e ataque em disputa',
    tags: ['defesa', 'marcacao', 'contato', 'disputa', 'pivo', 'ataque', 'bloqueio'],
    credito: 'Foto: Steindy, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-jogadora-arbitra',
    arquivo: '/banco-imagens/fotos/foto-jogadora-arbitra.jpg',
    tipo: 'foto',
    titulo: 'Jogadora sorrindo ao lado da árbitra',
    tags: ['jogadora', 'arbitra', 'arbitro', 'selecao', 'feminino', 'sorriso', 'comemoracao'],
    credito: 'Foto: Steffen Prößdorf, Wikimedia Commons, CC BY-SA 4.0',
  },
  {
    id: 'foto-escolares-1',
    arquivo: '/banco-imagens/fotos/foto-escolares-1.jpg',
    tipo: 'foto',
    titulo: 'Escolares jogando handebol',
    tags: ['escola', 'escolares', 'alunos', 'jovens', 'partida', 'equipe', 'jogo escolar', 'torneio escolar'],
    credito: 'Foto: Samson Ssemakadde, Wikimedia Commons, CC0',
  },
  {
    id: 'foto-escolares-2',
    arquivo: '/banco-imagens/fotos/foto-escolares-2.jpg',
    tipo: 'foto',
    titulo: 'Meninas jogando handebol na escola',
    tags: ['escola', 'escolares', 'alunas', 'jovens', 'partida', 'equipe', 'jogo escolar', 'torneio escolar'],
    credito: 'Foto: Onlyonestef, Wikimedia Commons, CC BY-SA 4.0',
  },
  {
    id: 'foto-goleiro-domevscek',
    arquivo: '/banco-imagens/fotos/foto-goleiro-domevscek.jpg',
    tipo: 'foto',
    titulo: 'Goleiro de braços abertos defendendo',
    tags: ['goleiro', 'defesa', 'defender', 'gol', 'bracos abertos', 'rede'],
    credito: 'Foto: Xplvl, Wikimedia Commons, CC BY 4.0',
  },
  {
    id: 'foto-goleiro-palicka',
    arquivo: '/banco-imagens/fotos/foto-goleiro-palicka.jpg',
    tipo: 'foto',
    titulo: 'Goleiro da Suécia ajustando a luva',
    tags: ['goleiro', 'luva', 'uniforme', 'suecia', 'retrato'],
    credito: 'Foto: Oskar Oltéus, Wikimedia Commons, CC BY-SA 2.0',
  },
  {
    id: 'foto-goleiro-bitter',
    arquivo: '/banco-imagens/fotos/foto-goleiro-bitter.jpg',
    tipo: 'foto',
    titulo: 'Goleiro em jogo (camisa rosa)',
    tags: ['goleiro', 'uniforme', 'camisa rosa', 'retrato'],
    credito: 'Foto: Michael Frey, Wikimedia Commons, CC BY-SA 3.0',
  },
  {
    id: 'foto-goleira-londres-2012',
    arquivo: '/banco-imagens/fotos/foto-goleira-londres-2012.jpg',
    tipo: 'foto',
    titulo: 'Goleira em ação no gol (Londres 2012)',
    tags: ['goleira', 'goleiro', 'defesa', 'gol', 'olimpiadas', 'londres'],
    credito: 'Foto: los_bandito_anthony, Wikimedia Commons, CC BY 2.0',
  },
  {
    id: 'foto-goleira-agachada-rio-2016',
    arquivo: '/banco-imagens/fotos/foto-goleira-agachada-rio-2016.jpg',
    tipo: 'foto',
    titulo: 'Goleira agachada em posição de espera (Rio 2016)',
    tags: ['goleira', 'goleiro', 'posicao de espera', 'agachada', 'olimpiadas', 'rio 2016'],
    credito: 'Foto: Jonas de Carvalho, Wikimedia Commons, CC BY-SA 2.0',
  },
  {
    id: 'foto-goleiro-no-gol-paris-2024',
    arquivo: '/banco-imagens/fotos/foto-goleiro-no-gol-paris-2024.jpg',
    tipo: 'foto',
    titulo: 'Goleiro no gol durante o jogo (Paris 2024)',
    tags: ['goleiro', 'gol', 'defesa', 'quadra', 'olimpiadas', 'paris 2024'],
    credito: 'Foto: Daieuxetdailleurs, Wikimedia Commons, CC BY 4.0',
  },
  {
    id: 'foto-brasil-arremesso-suspensao',
    arquivo: '/banco-imagens/fotos/foto-brasil-arremesso-suspensao.jpg',
    tipo: 'foto',
    titulo: 'Seleção Brasileira feminina: arremesso em suspensão',
    tags: ['arremesso', 'salto', 'suspensao', 'selecao', 'brasil', 'atacante', 'treino', 'feminino'],
    credito: 'Foto: Agência Brasil Fotografias, Wikimedia Commons, CC BY 2.0',
  },
  {
    id: 'foto-brasil-ataque-ao-gol',
    arquivo: '/banco-imagens/fotos/foto-brasil-ataque-ao-gol.jpg',
    tipo: 'foto',
    titulo: 'Seleção Brasileira feminina: ataque ao gol com goleira',
    tags: ['ataque', 'gol', 'goleira', 'arremesso', 'selecao', 'brasil', 'treino'],
    credito: 'Foto: Agência Brasil Fotografias, Wikimedia Commons, CC BY 2.0',
  },
  {
    id: 'foto-brasil-arremesso-goleira',
    arquivo: '/banco-imagens/fotos/foto-brasil-arremesso-goleira.jpg',
    tipo: 'foto',
    titulo: 'Seleção Brasileira feminina: arremesso contra a goleira',
    tags: ['arremesso', 'goleira', 'gol', 'selecao', 'brasil', 'treino'],
    credito: 'Foto: Agência Brasil Fotografias, Wikimedia Commons, CC BY 2.0',
  },
  {
    id: 'foto-rio-2016-ataque-brasileiro',
    arquivo: '/banco-imagens/fotos/foto-rio-2016-ataque-brasileiro.jpg',
    tipo: 'foto',
    titulo: 'Ataque brasileiro em jogo (Rio 2016)',
    tags: ['ataque', 'brasil', 'olimpiadas', 'rio 2016', 'jogo', 'disputa'],
    credito: 'Foto: Olivaribeiro, Wikimedia Commons, CC BY-SA 4.0',
  },
  {
    id: 'foto-londres-2012-ataque-defesa',
    arquivo: '/banco-imagens/fotos/foto-londres-2012-ataque-defesa.jpg',
    tipo: 'foto',
    titulo: 'Ataque e defesa em jogo (Londres 2012)',
    tags: ['ataque', 'defesa', 'marcacao', 'olimpiadas', 'londres'],
    credito: 'Foto: Tom Page, Wikimedia Commons, CC BY-SA 2.0',
  },
  {
    id: 'foto-paris-2024-ataque-defesa',
    arquivo: '/banco-imagens/fotos/foto-paris-2024-ataque-defesa.jpg',
    tipo: 'foto',
    titulo: 'Ataque e defesa de perto (Paris 2024)',
    tags: ['ataque', 'defesa', 'marcacao', 'contato', 'olimpiadas', 'paris 2024'],
    credito: 'Foto: Daieuxetdailleurs, Wikimedia Commons, CC BY 4.0',
  },
  {
    id: 'foto-atleta-bola-no-chao',
    arquivo: '/banco-imagens/fotos/foto-atleta-bola-no-chao.jpg',
    tipo: 'foto',
    titulo: 'Atleta em quadra com a bola no chão',
    tags: ['atleta', 'quadra', 'linha', 'bola no chao'],
    credito: 'Foto: Tom Page, Wikimedia Commons, CC BY-SA 2.0',
  },
  {
    id: 'foto-meninas-ao-ar-livre',
    arquivo: '/banco-imagens/fotos/foto-meninas-ao-ar-livre.jpg',
    tipo: 'foto',
    titulo: 'Meninas jogando handebol ao ar livre',
    tags: ['meninas', 'ao ar livre', 'marcacao', 'defesa', 'jogo'],
    credito: 'Foto: mohamed atef el naggar, Wikimedia Commons, CC BY-SA 4.0',
  },
  {
    id: 'foto-atleta-selecao-retrato',
    arquivo: '/banco-imagens/fotos/foto-atleta-selecao-retrato.jpg',
    tipo: 'foto',
    titulo: 'Atleta da Seleção Brasileira feminina (retrato)',
    tags: ['atleta', 'selecao', 'brasil', 'retrato', 'feminino'],
    credito: 'Foto: Agência Brasil Fotografias, Wikimedia Commons, CC BY 2.0',
  },
  {
    id: 'foto-bola-paris-2024',
    arquivo: '/banco-imagens/fotos/foto-bola-paris-2024.jpg',
    tipo: 'foto',
    titulo: 'Bola oficial dos Jogos de Paris 2024',
    tags: ['bola', 'mao', 'segurar', 'olimpiadas', 'paris 2024'],
    credito: 'Foto: Steffen Prößdorf, Wikimedia Commons, CC BY-SA 4.0',
  },
  {
    id: 'foto-bola-fundo-branco',
    arquivo: '/banco-imagens/fotos/foto-bola-fundo-branco.jpg',
    tipo: 'foto',
    titulo: 'Bola de handebol em fundo branco',
    tags: ['bola', 'fundo branco', 'isolada', 'equipamento', 'material'],
    credito: 'Foto: Raavimohantydelhi, Wikimedia Commons, CC BY 4.0',
  },
  {
    id: 'foto-quadra-ao-ar-livre',
    arquivo: '/banco-imagens/fotos/foto-quadra-ao-ar-livre.jpg',
    tipo: 'foto',
    titulo: 'Quadra ao ar livre (vista ampla)',
    tags: ['quadra', 'ao ar livre', 'gols', 'campo'],
    credito: 'Foto: Miyuki Meinaka, Wikimedia Commons, CC BY-SA 4.0',
  },
  {
    id: 'foto-arena-rio-2016',
    arquivo: '/banco-imagens/fotos/foto-arena-rio-2016.jpg',
    tipo: 'foto',
    titulo: 'Arena de handebol dos Jogos do Rio 2016',
    tags: ['quadra', 'arena', 'vista geral', 'olimpiadas', 'rio 2016'],
    credito: 'Foto: Leandro Neumann Ciuffo, Wikimedia Commons, CC BY 2.0',
  },
  {
    id: 'foto-gol-goleiro-arbitro-paris-2024',
    arquivo: '/banco-imagens/fotos/foto-gol-goleiro-arbitro-paris-2024.jpg',
    tipo: 'foto',
    titulo: 'Gol, goleiro, árbitro e jogadores (Paris 2024)',
    tags: ['gol', 'goleiro', 'arbitro', 'jogadores', 'quadra', 'olimpiadas', 'paris 2024'],
    credito: 'Foto: Daieuxetdailleurs, Wikimedia Commons, CC BY 4.0',
  },
  {
    id: 'foto-tempo-tecnico-paris-2024',
    arquivo: '/banco-imagens/fotos/foto-tempo-tecnico-paris-2024.jpg',
    tipo: 'foto',
    titulo: 'Tempo técnico: equipe reunida (Paris 2024)',
    tags: ['tempo tecnico', 'equipe', 'tecnico', 'conversa', 'olimpiadas'],
    credito: 'Foto: Daieuxetdailleurs, Wikimedia Commons, CC BY 4.0',
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

/**
 * Quantas tags do item aparecem no texto da questão (0 = não tem relação).
 * A tag só vale como PALAVRA inteira (com plural): "gol" não pode casar com
 * "goleiro", nem "area" com "areia".
 */
export function pontuarItem(item: ItemBancoImagem, textoQuestao: string): number {
  const texto = semAcento(textoQuestao);
  return item.tags.reduce((total, tag) => {
    const escapada = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const aparece = new RegExp(`(^|[^a-z0-9])${escapada}(s|es)?(?![a-z0-9])`).test(texto);
    return total + (aparece ? 1 + Math.floor(tag.length / 8) : 0);
  }, 0);
}
