import React from 'react';
import { IABase } from './IABase';

export function IAAtividadesLudicas() {
  return (
    <IABase
      titulo="Gerador de Atividades Lúdicas"
      descricao="Jogos e atividades pedagógicas para tornar as aulas mais dinâmicas"
      cor="bg-gradient-to-br from-orange-500 to-amber-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'objetivo', label: 'Objetivo Pedagógico', tipo: 'text', placeholder: 'Ex: Desenvolver coordenação motora e cooperação' },
        { id: 'tema', label: 'Tema ou Conteúdo (opcional)', tipo: 'text', placeholder: 'Ex: Atletismo, jogos populares, dança...', required: false },
        { id: 'quantidade', label: 'Quantidade de Atividades', tipo: 'select', opcoes: ['3 atividades', '5 atividades', '7 atividades', '10 atividades'] },
        { id: 'espaco', label: 'Espaço Disponível', tipo: 'select', opcoes: ['Quadra', 'Pátio aberto', 'Sala de aula', 'Qualquer espaço'] },
        { id: 'material', label: 'Material Disponível (opcional)', tipo: 'text', placeholder: 'Ex: Bolas, cones, bambolês, cordas...', required: false },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental.

Crie ${v.quantidade} ATIVIDADES LÚDICAS E PEDAGÓGICAS para:
- Turma: ${v.turma}
- Objetivo: ${v.objetivo}
${v.tema ? `- Tema/Conteúdo: ${v.tema}` : ''}
- Espaço: ${v.espaco}
${v.material ? `- Materiais disponíveis: ${v.material}` : ''}

Para cada atividade, apresente:

🎮 ATIVIDADE X: [Nome criativo da atividade]
⏱ Duração: X minutos
👥 Organização: (individual, duplas, grupos, turma toda)
🎯 Objetivo específico:
📦 Materiais necessários:
📋 Como jogar (regras passo a passo):
🔄 Variações (pelo menos 2):
💡 Dica do professor:
🔗 Habilidade BNCC relacionada:

As atividades devem ser progressivas (da mais simples para a mais complexa) e adequadas ao ${v.turma}.`}
    />
  );
}
