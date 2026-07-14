import React from 'react';
import { IABase } from './IABase';

export function IAProvasIA() {
  return (
    <IABase
      titulo="Gerador de Provas e Avaliações"
      descricao="Provas personalizadas com questões objetivas e dissertativas"
      cor="bg-gradient-to-br from-red-600 to-red-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'tema', label: 'Tema / Conteúdo Avaliado', tipo: 'text', placeholder: 'Ex: Futsal — história, regras e fundamentos' },
        { id: 'bimestre', label: 'Bimestre', tipo: 'select', opcoes: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'] },
        { id: 'questoesObj', label: 'Nº de Questões Objetivas', tipo: 'select', opcoes: ['4', '5', '6', '8', '10'] },
        { id: 'questoesDis', label: 'Nº de Questões Dissertativas', tipo: 'select', opcoes: ['0', '1', '2', '3', '4'] },
        { id: 'nivel', label: 'Nível de Dificuldade', tipo: 'select', opcoes: ['Fácil', 'Médio', 'Difícil', 'Misto'] },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental.

Crie uma AVALIAÇÃO ESCRITA COMPLETA para:
- Turma: ${v.turma}
- Tema: ${v.tema}
- Bimestre: ${v.bimestre}
- Questões objetivas (múltipla escolha): ${v.questoesObj}
- Questões dissertativas: ${v.questoesDis}
- Nível: ${v.nivel}

FORMATO DA PROVA:

CABEÇALHO:
ESCOLA: _______________________________________________
ALUNO(A): _____________________________________________ Nº: ____
TURMA: __________ DATA: ____/____/______ NOTA: ________

TÍTULO DA AVALIAÇÃO

PARTE 1 — QUESTÕES OBJETIVAS (${v.questoesObj} questões)
Para cada questão:
- Enunciado claro e contextualizado
- 4 alternativas (a, b, c, d)
- Dificuldade ${v.nivel}

${parseInt(v.questoesDis) > 0 ? `PARTE 2 — QUESTÕES DISSERTATIVAS (${v.questoesDis} questões)
Para cada questão dissertativa:
- Enunciado que estimule reflexão
- Espaço para resposta (indicar linhas)
- Valor em pontos` : ''}

GABARITO (ao final, separado):
- Respostas das questões objetivas
- Critérios de correção das dissertativas

As questões devem ser contextualizadas com situações reais do esporte/atividade e adequadas ao ${v.turma}.`}
    />
  );
}
