import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rsifjxeqitgiecqwvien.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Vw7h5WZ5BF-GzaAM0hOECg_TMjwdiby';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function salvarChamada(
  registros: { aluno_id: string; data: string; presente: boolean }[]
) {
  if (registros.length === 0) return;
  const data = registros[0].data;
  const studentIds = registros.map((r) => r.aluno_id);

  const { data: existingRecords, error: fetchError } = await supabase
    .from("frequencia")
    .select("id, aluno_id")
    .eq("data", data)
    .in("aluno_id", studentIds);

  if (fetchError) {
    console.error("Erro ao buscar registros existentes da chamada:", fetchError);
    throw fetchError;
  }

  const existingMap = new Map(existingRecords?.map((r) => [r.aluno_id, r.id]));

  const upsertData = registros.map((r) => {
    // Generate an ID if it doesn't exist
    const recordId = existingMap.get(r.aluno_id) || uuidv4();
    return {
      id: recordId,
      aluno_id: r.aluno_id,
      data: r.data,
      presente: r.presente,
    };
  });

  const { error: upsertError } = await supabase
    .from("frequencia")
    .upsert(upsertData);

  if (upsertError) {
    console.error("Erro ao salvar chamada:", upsertError);
    throw upsertError;
  }
}

export async function buscarHistoricoFrequencia(turmaId?: string, dt?: string) {
  let freqQuery = supabase.from("frequencia").select("*");

  if (dt) {
    freqQuery = freqQuery.eq("data", dt);
  }

  const { data: dataFrequencia, error: errorFrequencia } = await freqQuery;

  if (errorFrequencia) {
    console.error("Erro ao buscar histórico (frequencia):", errorFrequencia);
    throw errorFrequencia;
  }

  const { data: dataAlunos, error: errorAlunos } = await supabase
    .from("alunos")
    .select("id, nome, turma_id, numero_chamada");

  if (errorAlunos) {
    console.error("Erro ao buscar alunos para join:", errorAlunos);
    throw errorAlunos;
  }

  let turmaNormalizada: string | null = null;
  if (turmaId && turmaId !== 'ALL') {
    turmaNormalizada = turmaId.replace("º", "").replace(/\s/g, "").toUpperCase();
  }

  const alunosMap = new Map();
  dataAlunos?.forEach((aluno: any) => {
    alunosMap.set(aluno.id, aluno);
  });

  const historico = [];

  for (const registro of dataFrequencia || []) {
    const aluno = alunosMap.get(registro.aluno_id);

    // Fazer o join ("frequencia.aluno_id = alunos.id")
    if (aluno) {
      // Filtrar por turma_id se houver filtro
      if (turmaNormalizada && aluno.turma_id !== turmaNormalizada) {
        continue;
      }

      historico.push({
        id: registro.id,
        aluno_id: registro.aluno_id,
        data: registro.data,
        presente: registro.presente,
        nome: aluno.nome,
        turma_id: aluno.turma_id,
        numero_chamada: aluno.numero_chamada,
      });
    }
  }

  historico.sort((a, b) => {
    const numA = (a.numero_chamada !== null && a.numero_chamada !== undefined) ? a.numero_chamada : Infinity;
    const numB = (b.numero_chamada !== null && b.numero_chamada !== undefined) ? b.numero_chamada : Infinity;
    if (numA !== numB) {
      return numA - numB;
    }
    return a.nome.localeCompare(b.nome);
  });

  console.log("Dados retornados do Supabase (histórico após join):", historico);

  return historico;
}

export async function buscarAlunos(turmaId: string) {
  const turmaNormalizada = turmaId
    .replace("º", "")
    .replace(/\s/g, "")
    .toUpperCase();

  console.log("VALOR EXATO:", JSON.stringify(turmaNormalizada));

  const { data, error } = await supabase
    .from("alunos")
    .select("*")
    .eq("turma_id", turmaNormalizada)
    .order("numero_chamada", { ascending: true, nullsFirst: false });

  console.log("RESULTADO:", data);

  if (error) {
    console.error('Erro ao buscar alunos:', error);
  }

  return data || [];
}

export async function buscarRelatorioFrequencia(turmaId?: string, dataInicio?: string, dataFim?: string) {
  let freqQuery = supabase.from("frequencia").select("*");

  if (dataInicio) {
    freqQuery = freqQuery.gte("data", dataInicio);
  }
  if (dataFim) {
    freqQuery = freqQuery.lte("data", dataFim);
  }

  const { data: dataFrequencia, error: errorFrequencia } = await freqQuery;

  if (errorFrequencia) {
    console.error("Erro ao buscar frequencia (relatório):", errorFrequencia);
    throw errorFrequencia;
  }

  const { data: dataAlunos, error: errorAlunos } = await supabase
    .from("alunos")
    .select("id, nome, turma_id, numero_chamada");

  if (errorAlunos) {
    console.error("Erro ao buscar alunos para o relatorio:", errorAlunos);
    throw errorAlunos;
  }

  let turmaNormalizada: string | null = null;
  if (turmaId && turmaId !== 'ALL') {
    turmaNormalizada = turmaId.replace("º", "").replace(/\s/g, "").toUpperCase();
  }

  const alunosMap = new Map();
  dataAlunos?.forEach((aluno: any) => {
    if (!turmaNormalizada || aluno.turma_id === turmaNormalizada) {
      alunosMap.set(aluno.id, {
        id: aluno.id,
        nome: aluno.nome,
        turma_id: aluno.turma_id,
        numero_chamada: aluno.numero_chamada,
        total: 0,
        presencas: 0,
        faltas: 0
      });
    }
  });

  for (const registro of dataFrequencia || []) {
    const aluno = alunosMap.get(registro.aluno_id);
    if (aluno) {
      aluno.total += 2;
      if (registro.presente) {
        aluno.presencas += 2;
      } else {
        aluno.faltas += 2;
      }
    }
  }

  const relatorio: any[] = [];
  alunosMap.forEach((aluno) => {
    if (aluno.total > 0) {
      const p = (aluno.presencas / aluno.total) * 100;
      const frequencia = parseFloat(p.toFixed(2));
      let status = '';
      if (frequencia >= 75) status = 'OK';
      else if (frequencia >= 50) status = 'Atenção';
      else status = 'Crítico';

      relatorio.push({
        ...aluno,
        frequencia,
        status
      });
    }
  });

  relatorio.sort((a, b) => {
    const numA = (a.numero_chamada !== null && a.numero_chamada !== undefined) ? a.numero_chamada : Infinity;
    const numB = (b.numero_chamada !== null && b.numero_chamada !== undefined) ? b.numero_chamada : Infinity;
    if (numA !== numB) {
      return numA - numB;
    }
    return a.nome.localeCompare(b.nome);
  });

  return relatorio;
}

export async function salvarNotas(
  turmaId: string,
  bimestre: number,
  notas: { aluno_id: string; nota: number }[]
) {
  const turmaNormalizada = turmaId
    .replace("º", "")
    .replace(/\s/g, "")
    .toUpperCase();

  // 1. Fetch all students in the class
  const { data: alunos, error: alunosError } = await supabase
    .from("alunos")
    .select("id")
    .eq("turma_id", turmaNormalizada);

  if (alunosError) throw alunosError;
  const alunoIds = alunos?.map(a => a.id) || [];

  // 2. Fetch existing notes for these students and this bimestre
  const { data: existingNotas, error: fetchError } = await supabase
    .from("notas")
    .select("id, aluno_id")
    .eq("bimestre", bimestre)
    .in("aluno_id", alunoIds);

  if (fetchError) throw fetchError;
  const existingMap = new Map(existingNotas?.map(n => [n.aluno_id, n.id]));

  // 3. Prepare upsert data
  const upsertData = notas.map(n => ({
    id: existingMap.get(n.aluno_id) || uuidv4(),
    aluno_id: n.aluno_id,
    bimestre: bimestre,
    nota: n.nota,
    updated_at: new Date().toISOString()
  }));

  // 4. Batch upsert
  const { error: upsertError } = await supabase
    .from("notas")
    .upsert(upsertData);

  if (upsertError) throw upsertError;
}

export async function buscarNotas(turmaId: string, bimestre: number) {
  const turmaNormalizada = turmaId
    .replace("º", "")
    .replace(/\s/g, "")
    .toUpperCase();

  const { data, error } = await supabase
    .from("alunos")
    .select(`
      id, 
      nome, 
      numero_chamada,
      notas (
        nota,
        bimestre
      )
    `)
    .eq("turma_id", turmaNormalizada)
    .order("numero_chamada", { ascending: true });

  if (error) throw error;

  return (data || []).map((aluno: any) => {
    const notaDoBimestre = aluno.notas?.find((n: any) => n.bimestre === bimestre);
    return {
      id: aluno.id,
      nome: aluno.nome,
      numero_chamada: aluno.numero_chamada,
      nota: notaDoBimestre ? notaDoBimestre.nota : null
    };
  });
}
