import React from 'react';
import { IABase } from './IABase';

export function IAAtividadesAdaptadas() {
  return (
    <IABase
      titulo="Gerador de Atividades Adaptadas"
      descricao="Atividades inclusivas para alunos com necessidades educacionais especiais"
      cor="bg-gradient-to-br from-teal-600 to-teal-500"
      campos={[
        { id: 'turma', label: 'Turma / Ano', tipo: 'select', opcoes: ['6º Ano', '7º Ano', '8º Ano', '9º Ano'] },
        { id: 'necessidade', label: 'Necessidade / Condição do Aluno', tipo: 'select', opcoes: [
          'Deficiência física / mobilidade reduzida',
          'Deficiência visual',
          'Deficiência auditiva',
          'Transtorno do Espectro Autista (TEA)',
          'TDAH',
          'Dificuldade motora geral',
          'Múltiplas deficiências',
          'Aluno em recuperação de lesão',
        ]},
        { id: 'atividadeBase', label: 'Atividade ou Esporte Base', tipo: 'text', placeholder: 'Ex: Vôlei, corrida, dança, ginástica...' },
        { id: 'quantidade', label: 'Quantidade de Adaptações', tipo: 'select', opcoes: ['3 adaptações', '5 adaptações', '7 adaptações'] },
        { id: 'contexto', label: 'Contexto Adicional (opcional)', tipo: 'textarea', placeholder: 'Ex: Turma inclusiva com alunos sem deficiência junto...', required: false },
      ]}
      gerarPrompt={v => `Você é um professor especialista em Educação Física Adaptada e Inclusiva.

Crie ${v.quantidade} para alunos com ${v.necessidade}, baseadas na atividade/esporte: ${v.atividadeBase}

Turma: ${v.turma}
${v.contexto ? `Contexto: ${v.contexto}` : ''}

Para cada adaptação, apresente:

♿ ADAPTAÇÃO X: [Nome da adaptação]
🎯 Para quem: (perfil do aluno)
📋 Descrição da atividade adaptada:
🔧 O que foi adaptado (regras, espaço, material, tempo):
👥 Como incluir junto com a turma:
📦 Materiais específicos necessários:
⚠️ Cuidados e atenções do professor:
✅ Como avaliar o progresso:
🔗 Base legal (LDB, Decreto 7.611, etc.):

Ao final, inclua:
📌 DICAS GERAIS DE INCLUSÃO para esta condição
📌 COMO ADAPTAR O ESPAÇO FÍSICO
📌 COMUNICAÇÃO COM O ALUNO E A FAMÍLIA

As adaptações devem promover PARTICIPAÇÃO REAL, não apenas observação.`}
    />
  );
}
