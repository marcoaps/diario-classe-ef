import React from 'react';
import { IABase } from './IABase';

export function IASequencia() {
  return (
    <IABase
      titulo="Gerador de Sequências Didáticas"
      descricao="Sequências para desenvolver habilidades ao longo de várias aulas"
      cor="bg-gradient-to-br from-emerald-600 to-emerald-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'tema', label: 'Tema / Unidade Temática', tipo: 'text', placeholder: 'Ex: Esportes de Invasão — Basquetebol' },
        { id: 'aulas', label: 'Número de Aulas', tipo: 'select', opcoes: ['4 aulas', '6 aulas', '8 aulas', '10 aulas', '12 aulas'] },
        { id: 'bimestre', label: 'Bimestre', tipo: 'select', opcoes: ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'] },
        { id: 'contexto', label: 'Contexto / Observações (opcional)', tipo: 'textarea', placeholder: 'Ex: Turma iniciante, sem quadra coberta...', required: false },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental.

Crie uma SEQUÊNCIA DIDÁTICA COMPLETA para:
- Turma: ${v.turma}
- Tema: ${v.tema}
- Total de aulas: ${v.aulas}
- Bimestre: ${v.bimestre}
${v.contexto ? `- Contexto: ${v.contexto}` : ''}

A sequência deve conter:
1. APRESENTAÇÃO DA SEQUÊNCIA (tema, justificativa, público-alvo)
2. OBJETIVOS GERAIS E ESPECÍFICOS
3. HABILIDADES BNCC (com códigos EF)
4. CRONOGRAMA — para cada aula:
   - Número e título da aula
   - Objetivo específico
   - Atividades detalhadas (aquecimento, desenvolvimento, encerramento)
   - Recursos necessários
   - Tempo estimado de cada etapa
5. AVALIAÇÃO DA SEQUÊNCIA (como avaliar o progresso ao longo das aulas)
6. REFERÊNCIAS

Seja detalhado, prático e progressivo — cada aula deve construir sobre a anterior.`}
    />
  );
}
