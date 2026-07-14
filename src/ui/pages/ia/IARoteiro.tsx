import React from 'react';
import { IABase } from './IABase';

export function IARoteiro() {
  return (
    <IABase
      titulo="Gerador de Roteiros de Aula"
      descricao="Roteiros detalhados com sequência didática e gestão do tempo"
      cor="bg-gradient-to-br from-cyan-600 to-cyan-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'tema', label: 'Tema da Aula', tipo: 'text', placeholder: 'Ex: Voleibol — saque por baixo' },
        { id: 'duracao', label: 'Duração', tipo: 'select', opcoes: ['50 minutos', '1 hora', '1h30', '2 horas'] },
        { id: 'nivel', label: 'Nível da Turma', tipo: 'select', opcoes: ['Iniciante', 'Intermediário', 'Avançado'] },
        { id: 'local', label: 'Local da Aula (opcional)', tipo: 'text', placeholder: 'Ex: Quadra coberta, pátio, sala...', required: false },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física do Ensino Fundamental.

Crie um ROTEIRO DE AULA DETALHADO no estilo "passo a passo" para:
- Turma: ${v.turma}
- Tema: ${v.tema}
- Duração total: ${v.duracao}
- Nível da turma: ${v.nivel}
${v.local ? `- Local: ${v.local}` : ''}

O roteiro deve ser um guia minuto a minuto contendo:

1. ANTES DA AULA
   - Preparação do espaço e materiais
   - O que ter em mãos

2. ROTEIRO MINUTO A MINUTO:
   Para cada etapa, informe:
   ⏱ Tempo: [X min]
   🎯 Objetivo da etapa:
   📋 O que fazer (passo a passo numerado):
   💬 O que falar para os alunos (sugestão de fala):
   ⚠️ Pontos de atenção:

   Etapas: Acolhida → Aquecimento → Introdução do conteúdo → Prática orientada → Jogo/atividade livre → Encerramento e avaliação

3. ADAPTAÇÕES POSSÍVEIS (se faltar material, se chover, etc.)

4. DICAS DO PROFESSOR

Seja muito prático — o professor deve conseguir seguir o roteiro durante a aula.`}
    />
  );
}
