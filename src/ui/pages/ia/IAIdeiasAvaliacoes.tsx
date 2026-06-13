import React from 'react';
import { IABase } from './IABase';

export function IAIdeiasAvaliacoes() {
  return (
    <IABase
      titulo="Avaliação Adaptada — Educação Especial"
      descricao="Gera avaliações adaptadas com 7 questões visuais para alunos com necessidades educacionais especiais"
      cor="bg-gradient-to-br from-purple-600 to-indigo-500"
      campos={[
        {
          id: 'tema',
          label: 'Tema / Conteúdo',
          tipo: 'text',
          placeholder: 'Ex: Voleibol, Higiene Corporal, Esportes Coletivos...',
        },
        {
          id: 'serie',
          label: 'Ano / Série',
          tipo: 'select',
          opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
        },
        {
          id: 'deficiencia',
          label: 'Deficiência ou Necessidade Educacional',
          tipo: 'select',
          opcoes: [
            'Deficiência Intelectual (DI)',
            'Transtorno do Espectro Autista (TEA)',
            'Deficiência Visual',
            'Deficiência Auditiva',
            'Deficiência Física / Motora',
            'TDAH',
            'Dislexia',
            'Deficiência Múltipla',
          ],
        },
        {
          id: 'objetivo',
          label: 'Objetivo de Aprendizagem',
          tipo: 'textarea',
          placeholder: 'Ex: Identificar as regras básicas do voleibol, reconhecer os fundamentos do jogo...',
        },
        {
          id: 'aluno',
          label: 'Nome do Aluno (opcional)',
          tipo: 'text',
          placeholder: 'Deixe em branco para usar linha pontilhada',
          required: false,
        },
      ]}
      gerarPrompt={v => `Você é um especialista em educação inclusiva, adaptação curricular e elaboração de avaliações para alunos com necessidades educacionais especiais.

Crie uma avaliação adaptada completa seguindo RIGOROSAMENTE as regras abaixo:

DADOS DA AVALIAÇÃO
Tema: ${v.tema}
Ano/Série: ${v.serie}
Deficiência ou NEE: ${v.deficiencia}
Objetivo de aprendizagem: ${v.objetivo}
Nome do aluno: ${v.aluno || '____________________________________________'}

ESTRUTURA OBRIGATÓRIA
- Produza EXATAMENTE 7 questões
- Cada questão deve conter uma imagem ilustrativa relacionada ao conteúdo
- Para cada imagem, forneça um prompt detalhado para geração de imagem
- Utilize linguagem SIMPLES, objetiva e adequada ao nível cognitivo do aluno
- EVITE textos longos, use frases curtas e claras
- As questões devem ser predominantemente VISUAIS

ALTERNATIVAS
- Cada questão deve ter APENAS 2 alternativas (A e B)
- Apenas UMA alternativa deve estar correta
- As alternativas devem ser CURTAS e fáceis de compreender
- Evite alternativas confusas ou muito parecidas

FORMATO DE CADA QUESTÃO:
Questão X
Imagem: [descrição detalhada da imagem para geração]
Pergunta: [pergunta simples e visual]
A) [alternativa]
B) [alternativa]
Resposta correta: [A ou B]
Habilidade trabalhada: [habilidade pedagógica]

CRITÉRIOS PEDAGÓGICOS
- Priorizar reconhecimento visual
- Trabalhar associação de imagens
- Estimular atenção e observação
- Desenvolver compreensão básica do conteúdo
- Adequar o nível de dificuldade para ${v.deficiencia}
- Utilizar exemplos do cotidiano

FORMATO DE SAÍDA - organize a avaliação pronta para impressão:
1. CABEÇALHO: E.E. Instituto Odilon Pratagi - Educação Física / Avaliação Adaptada - ${v.serie} - ${v.tema} / Aluno(a): ${v.aluno || '____________________________________________'} / Data: ____/____/______
2. As 7 questões completas com imagens
3. GABARITO separado ao final

Adapte vocabulário, complexidade e formato visual para ${v.deficiencia} garantindo ACESSIBILIDADE e INCLUSÃO.`}
    />
  );
}
