import React from 'react';
import { IABase } from './IABase';

export function IAPlanoAula() {
  return (
    <IABase
      titulo="Gerador de Planos de Aula"
      descricao="Planos completos alinhados à BNCC com objetivos, metodologia e avaliação"
      cor="bg-gradient-to-br from-blue-600 to-blue-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'tema', label: 'Tema / Conteúdo', tipo: 'text', placeholder: 'Ex: Futsal — regras e fundamentos' },
        { id: 'duracao', label: 'Duração da Aula', tipo: 'select', opcoes: ['50 minutos', '1 hora', '1h30', '2 horas (aula dupla)'] },
        { id: 'objetivo', label: 'Objetivo Principal (opcional)', tipo: 'text', placeholder: 'Ex: Desenvolver o passe e a visão de jogo', required: false },
        { id: 'recursos', label: 'Recursos Disponíveis (opcional)', tipo: 'text', placeholder: 'Ex: Bolas, cones, coletes', required: false },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental.

Crie um PLANO DE AULA COMPLETO e detalhado para:
- Turma: ${v.turma}
- Tema/Conteúdo: ${v.tema}
- Duração: ${v.duracao}
${v.objetivo ? `- Objetivo principal: ${v.objetivo}` : ''}
${v.recursos ? `- Recursos disponíveis: ${v.recursos}` : ''}

O plano deve conter:
1. IDENTIFICAÇÃO (Escola, Disciplina, Turma, Data, Duração)
2. TEMA
3. OBJETIVOS (Geral e Específicos)
4. HABILIDADES BNCC relacionadas (com códigos EF)
5. CONTEÚDOS
6. METODOLOGIA / DESENVOLVIMENTO:
   - Aquecimento/Introdução (com tempo)
   - Desenvolvimento principal (com tempo)
   - Atividades práticas detalhadas
   - Volta à calma (com tempo)
7. RECURSOS DIDÁTICOS
8. AVALIAÇÃO
9. REFERÊNCIAS BNCC

Seja detalhado e prático. Use linguagem direta de professor para professor.`}
    />
  );
}
