import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rsifjxeqitgiecqwvien.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Vw7h5WZ5BF-GzaAM0hOECg_TMjwdiby';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  }
});

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

  if (fetchError) throw fetchError;

  const existingMap = new Map(existingRecords?.map((r) => [r.aluno_id, r.id]));

  const upsertData = registros.map((r) => {
    const recordId = existingMap.get(r.aluno_id) || uuidv4();
    return { id: recordId, aluno_id: r.aluno_id, data: r.data, presente: r.presente };
  });

  const { error: upsertError } = await supabase.from("frequencia").upsert(upsertData);
  if (upsertError) throw upsertError;
}

export async function buscarHistoricoFrequencia(turmaId?: string, dt?: string) {
  let freqQuery = supabase.from("frequencia").select("*");
  if (dt) freqQuery = freqQuery.eq("data", dt);

  const { data: dataFrequencia, error: errorFrequencia } = await freqQuery;
  if (errorFrequencia) throw errorFrequencia;

  const { data: dataAlunos, error: errorAlunos } = await supabase
    .from("alunos").select("id, nome, turma_id, numero_chamada");
  if (errorAlunos) throw errorAlunos;

  let turmaNormalizada: string | null = null;
  if (turmaId && turmaId !== 'ALL') {
    turmaNormalizada = turmaId.replace("o", "").replace(/\s/g, "").toUpperCase();
  }

  const alunosMap = new Map();
  dataAlunos?.forEach((aluno: any) => { alunosMap.set(aluno.id, aluno); });

  const historico = [];
  for (const registro of dataFrequencia || []) {
    const aluno = alunosMap.get(registro.aluno_id);
    if (aluno) {
      if (turmaNormalizada && aluno.turma_id !== turmaNormalizada) continue;
      historico.push({
        id: registro.id, aluno_id: registro.aluno_id, data: registro.data,
        presente: registro.presente, nome: aluno.nome, turma_id: aluno.turma_id,
        numero_chamada: aluno.numero_chamada,
      });
    }
  }

  historico.sort((a, b) => {
    const numA = a.numero_chamada ?? Infinity;
    const numB = b.numero_chamada ?? Infinity;
    if (numA !== numB) return numA - numB;
    return a.nome.localeCompare(b.nome);
  });

  return historico;
}

export async function buscarAlunos(turmaId: string) {
  const turmaNormalizada = turmaId.replace("o", "").replace(/\s/g, "").toUpperCase();
  const { data, error } = await supabase
    .from("alunos").select("*").eq("turma_id", turmaNormalizada)
    .order("numero_chamada", { ascending: true, nullsFirst: false });
  if (error) console.error('Erro ao buscar alunos:', error);
  return data || [];
}

export async function buscarRelatorioFrequencia(turmaId?: string, dataInicio?: string, dataFim?: string) {
  let freqQuery = supabase.from("frequencia").select("*");
  if (dataInicio) freqQuery = freqQuery.gte("data", dataInicio);
  if (dataFim) freqQuery = freqQuery.lte("data", dataFim);

  const { data: dataFrequencia, error: errorFrequencia } = await freqQuery;
  if (errorFrequencia) throw errorFrequencia;

  const { data: dataAlunos, error: errorAlunos } = await supabase
    .from("alunos").select("id, nome, turma_id, numero_chamada");
  if (errorAlunos) throw errorAlunos;

  let turmaNormalizada: string | null = null;
  if (turmaId && turmaId !== 'ALL') {
    turmaNormalizada = turmaId.replace("o", "").replace(/\s/g, "").toUpperCase();
  }

  const alunosMap = new Map();
  dataAlunos?.forEach((aluno: any) => {
    if (!turmaNormalizada || aluno.turma_id === turmaNormalizada) {
      alunosMap.set(aluno.id, {
        id: aluno.id, nome: aluno.nome, turma_id: aluno.turma_id,
        numero_chamada: aluno.numero_chamada, total: 0, presencas: 0, faltas: 0
      });
    }
  });

  for (const registro of dataFrequencia || []) {
    const aluno = alunosMap.get(registro.aluno_id);
    if (aluno) {
      aluno.total += 2;
      if (registro.presente) aluno.presencas += 2;
      else aluno.faltas += 2;
    }
  }

  const relatorio: any[] = [];
  alunosMap.forEach((aluno) => {
    if (aluno.total > 0) {
      const p = (aluno.presencas / aluno.total) * 100;
      const frequencia = parseFloat(p.toFixed(2));
      const status = frequencia >= 75 ? 'OK' : frequencia >= 50 ? 'Atencao' : 'Critico';
      relatorio.push({ ...aluno, frequencia, status });
    }
  });

  relatorio.sort((a, b) => {
    const numA = a.numero_chamada ?? Infinity;
    const numB = b.numero_chamada ?? Infinity;
    if (numA !== numB) return numA - numB;
    return a.nome.localeCompare(b.nome);
  });

  return relatorio;
}

// Salva notas - inclui situacao, data_situacao e faltas
export async function salvarNotas(
  turma: string,
  bimestre: number,
  alunos: {
    numero: number;
    nome: string;
    nota: number | null;
    nota_texto?: string | null;
    situacao?: string;
    data_situacao?: string;
    faltas?: number;
  }[]
) {
  const upsertData = alunos.map(a => ({
    turma,
    bimestre,
    numero: a.numero,
    nome: a.nome,
    nota: a.nota ?? null,
    nota_texto: a.nota_texto ?? null,
    situacao: a.situacao ?? 'Em Curso',
    data_situacao: a.data_situacao ?? '',
    faltas: a.faltas ?? 0,
  }));

  const { error } = await supabase
    .from("notas")
    .upsert(upsertData, { onConflict: "turma,bimestre,nome" });
  if (error) throw error;
}

export async function buscarNotas(turma: string, bimestre: number) {
  const { data, error } = await supabase
    .from("notas").select("*")
    .eq("turma", turma).eq("bimestre", bimestre)
    .order("numero");
  if (error) throw error;
  return data || [];
}

// Corrige nomes/sobrenomes dos alunos da turma comparando por posição na lista
// (mesma logica do "Sincronizar Nomes" do Dashboard) -- nao apaga nem recria
// ninguem, entao IDs e historico ficam intactos. Casa por posicao (nao pelo
// valor de numero_chamada) para nao ser afetado por buracos na numeracao
// (ex: quando um duplicado foi excluido e a numeracao ficou com um salto).
export async function sincronizarNomesAlunos(
  turmaId: string,
  extraidos: { numero: number; nome: string }[]
): Promise<{ changed: number; failed: number }> {
  const { data: existentes, error } = await supabase
    .from('alunos')
    .select('id, nome, numero_chamada')
    .eq('turma_id', turmaId);
  if (error) throw error;
  if (!existentes || existentes.length === 0) return { changed: 0, failed: 0 };

  const ordenados = [...existentes].sort((a: any, b: any) =>
    (a.numero_chamada ?? Infinity) - (b.numero_chamada ?? Infinity)
  );
  const extraidosOrdenados = [...extraidos].sort((a, b) => a.numero - b.numero);
  const n = Math.min(ordenados.length, extraidosOrdenados.length);

  let changed = 0;
  let failed = 0;

  for (let i = 0; i < n; i++) {
    const atual: any = ordenados[i];
    const nomeNovo = extraidosOrdenados[i].nome?.trim();
    if (!nomeNovo || nomeNovo === String(atual.nome).trim()) continue;

    const { data, error: updError } = await supabase
      .from('alunos')
      .update({ nome: nomeNovo })
      .eq('id', atual.id)
      .select('id');
    if (updError || !data || data.length === 0) { failed++; continue; }
    changed++;
  }

  return { changed, failed };
}
