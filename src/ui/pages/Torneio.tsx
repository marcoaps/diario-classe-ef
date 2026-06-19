import { useState, useMemo, useCallback } from 'react';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface Team { id: string; name: string; color: string; }
interface Player { id: string; name: string; teamId: string | null; number?: string; }
interface Match {
  id: string; teamA: string | null; teamB: string | null;
  sA: number | null; sB: number | null; played: boolean;
  round: number; phase: string; group: string | null;
  idx?: number; isBye?: boolean; winner?: string | null;
}
interface Group { name: string; teams: Team[]; }
interface Standing { teamId: string; P: number; J: number; V: number; E: number; D: number; GP: number; GC: number; SG: number; }
interface ParsedPlayer { rawLine: string; name: string; teamName: string | null; number: string | null; }

interface Category {
  id: string;
  name: string;
  teams: Team[];
  players: Player[];
  format: string;
  groups: Group[] | null;
  matches: Match[];
  phase: string;
  swissRound: number;
  playoffsN: number;
  champion: string | null;
}

interface Tournament {
  name: string;
  categories: Category[];
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const TEAM_COLORS = [
  '#6366F1','#22C55E','#F59E0B','#EF4444','#06B6D4',
  '#8B5CF6','#10B981','#F97316','#3B82F6','#EC4899',
  '#14B8A6','#84CC16','#A855F7','#EAB308','#F43F5E',
  '#0EA5E9','#D97706',
];
const DEFAULT_NAMES = ['Leões','Tigres','Falcões','Tubarões','Lobos','Panteras','Dragões','Águias','Cobras','Ursos','Touros','Corvos','Feras','Bravos','Heróis','Gladiadores','Guerreiros'];
const CATEGORY_SUGGESTIONS = ['6º e 7º ano','8º e 9º ano','Masculino','Feminino','Sub-13','Sub-15','Sub-17','Categoria A','Categoria B'];
const FORMATS = [
  { id:'round_robin',     name:'Pontos Corridos',   desc:'Todos jogam contra todos',         icon:'⚽', min:3 },
  { id:'single_elim',    name:'Mata-Mata',          desc:'Eliminação direta — perdeu, saiu', icon:'⚡', min:3 },
  { id:'groups_ko',      name:'Grupos + Mata-Mata', desc:'Fase de grupos + eliminatória',    icon:'🏆', min:4 },
  { id:'league_playoffs',name:'Liga + Playoffs',    desc:'Liga completa + playoffs finais',  icon:'🎯', min:4 },
  { id:'swiss',          name:'Sistema Suíço',      desc:'Emparelhamento dinâmico',          icon:'🇨🇭', min:4 },
  { id:'double_elim',    name:'Mata-Mata Duplo',    desc:'Duas derrotas para eliminar',      icon:'🔥', min:4 },
];

// ─── UTILITÁRIOS ─────────────────────────────────────────────────────────────

const nextPow2 = (n: number) => { let p = 1; while (p < n) p *= 2; return p; };
const shuffle = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; } return r; };
const uid = () => Math.random().toString(36).slice(2,9);

// ─── GENERATORS ──────────────────────────────────────────────────────────────

function genRR(teams: Team[]): Match[] {
  const ms: Match[] = []; const t = teams.length%2===0?[...teams]:[...teams,null as unknown as Team]; const rds=t.length-1;
  for(let r=0;r<rds;r++){
    for(let i=0;i<t.length/2;i++){const a=t[i],b=t[t.length-1-i];if(a&&b)ms.push({id:`rr_r${r+1}_m${i}_${uid()}`,teamA:a.id,teamB:b.id,sA:null,sB:null,played:false,round:r+1,phase:'league',group:null});}
    const rest=t.splice(1);rest.unshift(rest.pop()!);t.splice(1,0,...rest);
  } return ms;
}
function genElim(teamIds:(string|null)[],prefix='se'): Match[] {
  const size=nextPow2(teamIds.length);const seeded=[...teamIds];while(seeded.length<size)seeded.push(null);
  const allM:Match[]=[]; const rounds=Math.log2(size); const r1p:(string|null)[]=[];
  for(let i=0;i<size/2;i++){r1p.push(seeded[i],seeded[size-1-i]??null);}
  for(let i=0;i<size/2;i++){const a=r1p[i*2],b=r1p[i*2+1];const isBye=!a||!b;allM.push({id:`${prefix}_r1_m${i}_${uid()}`,teamA:a,teamB:b,sA:isBye?(a?1:0):null,sB:isBye?(b?1:0):null,played:isBye,round:1,phase:'Rodada 1',idx:i,isBye,winner:isBye?(a||b):null});}
  for(let r=2;r<=rounds;r++){const cnt=size/Math.pow(2,r);for(let m=0;m<cnt;m++){const ph=r===rounds?'Final':r===rounds-1?'Semifinal':r===rounds-2?'Quartas':`Rodada ${r}`;allM.push({id:`${prefix}_r${r}_m${m}_${uid()}`,teamA:null,teamB:null,sA:null,sB:null,played:false,round:r,phase:ph,idx:m});}}
  allM.filter(m=>m.round===1&&m.isBye&&m.winner).forEach(m=>{const p=`${prefix}_r2_m${Math.floor((m.idx??0)/2)}`;const nx=allM.find(x=>x.id.startsWith(p.replace(`_${uid()}`,''))||x.phase!=='Final'&&x.round===2&&x.idx===Math.floor((m.idx??0)/2));
    const nx2=allM.find(x=>x.round===2&&x.idx===Math.floor((m.idx??0)/2));
    if(nx2){if((m.idx??0)%2===0)nx2.teamA=m.winner!;else nx2.teamB=m.winner!;}});
  return allM;
}
function genGroups(teams:Team[]):{groups:Group[];matches:Match[]}{
  const n=teams.length;const numG=n<=5?2:n<=9?3:4;
  const groups:Group[]=Array.from({length:numG},(_,i)=>({name:String.fromCharCode(65+i),teams:[]}));
  shuffle([...teams]).forEach((t,i)=>groups[i%numG].teams.push(t));
  const matches:Match[]=[];
  groups.forEach(g=>{for(let i=0;i<g.teams.length-1;i++)for(let j=i+1;j<g.teams.length;j++)matches.push({id:`gr_${g.name}_${i}_${j}_${uid()}`,teamA:g.teams[i].id,teamB:g.teams[j].id,sA:null,sB:null,played:false,round:0,phase:'group',group:g.name});});
  return{groups,matches};
}
function genSwiss(teams:Team[],prevMs:Match[],rn:number):Match[]{
  const st=calcSt(teams,prevMs);const paired=new Set<string>();const newM:Match[]=[];
  for(let i=0;i<st.length;i++){
    if(paired.has(st[i].teamId))continue;
    for(let j=i+1;j<st.length;j++){
      if(paired.has(st[j].teamId))continue;
      const prev=prevMs.find(m=>(m.teamA===st[i].teamId&&m.teamB===st[j].teamId)||(m.teamA===st[j].teamId&&m.teamB===st[i].teamId));
      if(!prev){newM.push({id:`sw_r${rn}_m${newM.length}_${uid()}`,teamA:st[i].teamId,teamB:st[j].teamId,sA:null,sB:null,played:false,round:rn,phase:'swiss',group:null});paired.add(st[i].teamId);paired.add(st[j].teamId);break;}
    }
  }
  const bye=st.find(s=>!paired.has(s.teamId));
  if(bye)newM.push({id:`sw_r${rn}_bye_${uid()}`,teamA:bye.teamId,teamB:null,sA:3,sB:0,played:true,round:rn,phase:'swiss',group:null,isBye:true});
  return newM;
}

function calcSt(teams:Team[],matches:Match[],gf:string|null=null):Standing[]{
  const st:Record<string,Standing>={};
  teams.forEach(t=>{st[t.id]={teamId:t.id,P:0,J:0,V:0,E:0,D:0,GP:0,GC:0,SG:0};});
  matches.filter(m=>{if(!m.played||m.isBye||m.sA===null||!m.teamB)return false;if(gf!==null)return m.group===gf;return true;})
    .forEach(m=>{const a=st[m.teamA!],b=st[m.teamB!];if(!a||!b)return;a.J++;b.J++;a.GP+=m.sA!;a.GC+=m.sB!;a.SG=a.GP-a.GC;b.GP+=m.sB!;b.GC+=m.sA!;b.SG=b.GP-b.GC;if(m.sA!>m.sB!){a.V++;b.D++;a.P+=3;}else if(m.sA!<m.sB!){b.V++;a.D++;b.P+=3;}else{a.E++;b.E++;a.P++;b.P++;}});
  return Object.values(st).sort((a,b)=>b.P-a.P||b.SG-a.SG||b.GP-a.GP);
}

function parseImportText(text:string):ParsedPlayer[]{
  return text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).map(raw=>{
    const nm=raw.match(/^#?(\d{1,2})\s+(.+)$/);let rest=raw;let number:string|null=null;
    if(nm){number=nm[1];rest=nm[2];}
    const sep=rest.match(/^(.+?)(?:\s*[,;|]\s*|\s+-\s+)(.+)$/);
    if(sep)return{rawLine:raw,name:sep[1].trim(),teamName:sep[2].trim()||null,number};
    return{rawLine:raw,name:rest.trim(),teamName:null,number};
  });
}

function buildCategory(catId:string,catName:string,teams:Team[],fmt:string,playoffsN:number,players:Player[]):Category{
  let matches:Match[]=[],groups:Group[]|null=null,phase='playing';
  if(fmt==='round_robin'){matches=genRR(teams);phase='league';}
  else if(fmt==='single_elim'||fmt==='double_elim'){matches=genElim(teams.map(t=>t.id),`${catId}_se`);phase='elimination';}
  else if(fmt==='groups_ko'){const r=genGroups(teams);groups=r.groups;matches=r.matches;phase='groups';}
  else if(fmt==='league_playoffs'){matches=genRR(teams);phase='league';}
  else if(fmt==='swiss'){
    const sh=shuffle([...teams]);
    for(let i=0;i<Math.floor(sh.length/2);i++)matches.push({id:`${catId}_sw_r1_m${i}`,teamA:sh[i*2].id,teamB:sh[i*2+1].id,sA:null,sB:null,played:false,round:1,phase:'swiss',group:null});
    if(sh.length%2!==0)matches.push({id:`${catId}_sw_r1_bye`,teamA:sh[sh.length-1].id,teamB:null,sA:3,sB:0,played:true,round:1,phase:'swiss',group:null,isBye:true});
    phase='swiss';
  }
  return{id:catId,name:catName,teams,players,format:fmt,groups,matches,phase,swissRound:1,playoffsN,champion:null};
}

// ─── SETUP WIZARD ────────────────────────────────────────────────────────────

interface SetupWizardProps { onDone:(cat:Category)=>void; onCancel:()=>void; }

function SetupWizard({onDone,onCancel}:SetupWizardProps){
  const [step,setStep]=useState(1);
  const [catName,setCatName]=useState('');
  const [teamCount,setTeamCount]=useState(8);
  const [teamNames,setTeamNames]=useState<string[]>(DEFAULT_NAMES.slice(0,8));
  const [format,setFormat]=useState('round_robin');
  const [playoffsN,setPlayoffsN]=useState(4);
  const [importText,setImportText]=useState('');
  const [preview,setPreview]=useState<{parsed:ParsedPlayer[];found:string[];notFound:string[];noTeam:ParsedPlayer[]}|null>(null);
  const [createMissing,setCreateMissing]=useState<Record<string,boolean>>({});
  const [importedPlayers,setImportedPlayers]=useState<Player[]>([]);

  const updateCount=(n:number)=>{setTeamCount(n);setTeamNames(prev=>{const nx=[...prev];while(nx.length<n)nx.push(DEFAULT_NAMES[nx.length]??`Time ${nx.length+1}`);return nx.slice(0,n);});};

  const handleProcess=()=>{
    if(!importText.trim())return;
    const parsed=parseImportText(importText);
    const tns=[...new Set(parsed.map(p=>p.teamName).filter(Boolean))] as string[];
    const found=tns.filter(n=>teamNames.slice(0,teamCount).some(t=>t.toLowerCase()===n.toLowerCase()));
    const notFound=tns.filter(n=>!teamNames.slice(0,teamCount).some(t=>t.toLowerCase()===n.toLowerCase()));
    const noTeam=parsed.filter(p=>!p.teamName);
    setPreview({parsed,found,notFound,noTeam});
    const init:Record<string,boolean>={};notFound.forEach(n=>{init[n]=true;});setCreateMissing(init);
  };

  const handleConfirmImport=()=>{
    if(!preview)return;
    let newNames=[...teamNames];let newCount=teamCount;
    preview.notFound.forEach(name=>{if(createMissing[name]&&!newNames.slice(0,newCount).some(n=>n.toLowerCase()===name.toLowerCase())){newNames.push(name);newCount++;}});
    const allTeamObjs=newNames.slice(0,newCount).map((name,i)=>({id:`_t${i}`,name,color:TEAM_COLORS[i%TEAM_COLORS.length]}));
    const players:Player[]=preview.parsed.map(p=>({id:`pl_${uid()}`,name:p.name,teamId:p.teamName?allTeamObjs.find(t=>t.name.toLowerCase()===p.teamName!.toLowerCase())?.id??null:null,number:p.number??undefined}));
    setImportedPlayers(prev=>[...prev,...players]);
    setTeamNames(newNames);setTeamCount(newCount);setImportText('');setPreview(null);
  };

  const handleFinish=()=>{
    const catId=`cat_${uid()}`;
    const teams=teamNames.slice(0,teamCount).map((name,i)=>({id:`${catId}_t${i}`,name:name||`Time ${i+1}`,color:TEAM_COLORS[i%TEAM_COLORS.length]}));
    const fixedPlayers=importedPlayers.map(p=>({...p,teamId:p.teamId?teams[parseInt(p.teamId.replace('_t',''))]?.id??null:null}));
    onDone(buildCategory(catId,catName||'Nova Categoria',teams,format,playoffsN,fixedPlayers));
  };

  const stepLabels=['Nome','Times','Formato','Jogadores'];

  return(
    <div className="min-h-screen bg-[#0f172a] p-4 flex flex-col items-center justify-start pt-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-5 flex-wrap justify-center">
        {stepLabels.map((s,i)=>(
          <div key={i} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all ${step===i+1?'bg-indigo-600 border-indigo-500 text-white':step>i+1?'bg-green-600 border-green-500 text-white':'bg-slate-800 border-slate-600 text-slate-400'}`}>{step>i+1?'✓':i+1}</div>
            <span className={`text-xs ${step>=i+1?'text-white':'text-slate-500'}`}>{s}</span>
            {i<3&&<div className={`w-4 h-px ${step>i+1?'bg-green-600':'bg-slate-700'}`}/>}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg bg-slate-800 rounded-2xl border border-slate-700 p-5 mb-4">
        <h2 className="text-white font-semibold text-base mb-4 pb-3 border-b border-slate-700">
          {step===1?'📋 Nome da Categoria':step===2?'👥 Times':step===3?'🎮 Formato':'👤 Jogadores'}
        </h2>

        {/* Passo 1 - Nome da categoria */}
        {step===1&&(
          <div>
            <label className="text-slate-400 text-xs block mb-1.5">Nome da categoria</label>
            <input value={catName} onChange={e=>setCatName(e.target.value)} autoFocus
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-indigo-500 mb-4"
              placeholder="Ex: 6º e 7º ano" />
            <div className="flex flex-wrap gap-2">
              {CATEGORY_SUGGESTIONS.map(n=>(
                <button key={n} onClick={()=>setCatName(n)} className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition-colors">{n}</button>
              ))}
            </div>
          </div>
        )}

        {/* Passo 2 - Times */}
        {step===2&&(
          <div>
            <div className="bg-slate-900 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-3"><span className="text-slate-400 text-sm">Quantidade de times</span><span className="text-indigo-400 text-2xl font-bold">{teamCount}</span></div>
              <input type="range" min={3} max={17} value={teamCount} onChange={e=>updateCount(Number(e.target.value))} className="w-full accent-indigo-500"/>
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>3</span><span>17</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {teamNames.slice(0,teamCount).map((name,i)=>(
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:TEAM_COLORS[i%TEAM_COLORS.length]}}/>
                  <input value={name} onChange={e=>{const n=[...teamNames];n[i]=e.target.value;setTeamNames(n);}} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500" placeholder={`Time ${i+1}`}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passo 3 - Formato */}
        {step===3&&(
          <div>
            <p className="text-slate-400 text-sm mb-3">Como esta categoria será disputada?</p>
            <div className="space-y-2">
              {FORMATS.filter(f=>f.min<=teamCount).map(f=>(
                <div key={f.id} onClick={()=>setFormat(f.id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${format===f.id?'bg-indigo-900/50 border-indigo-500':'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                  <span className="text-xl">{f.icon}</span>
                  <div className="flex-1"><div className={`text-sm font-medium ${format===f.id?'text-indigo-300':'text-white'}`}>{f.name}</div><div className="text-xs text-slate-400">{f.desc}</div></div>
                  {format===f.id&&<div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs">✓</div>}
                </div>
              ))}
            </div>
            {format==='league_playoffs'&&(
              <div className="mt-3 flex items-center gap-3 bg-slate-900 rounded-xl p-3">
                <span className="text-slate-400 text-sm">Times nos playoffs:</span>
                <select value={playoffsN} onChange={e=>setPlayoffsN(Number(e.target.value))} className="bg-slate-800 text-white border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                  {[2,4,8].filter(n=>n<=teamCount).map(n=><option key={n} value={n}>{n} times</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Passo 4 - Jogadores */}
        {step===4&&(
          <div>
            {importedPlayers.length>0&&!preview&&(
              <div className="bg-green-900/20 border border-green-700/40 rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
                <span className="text-green-400 text-sm">✅ {importedPlayers.length} jogadores importados</span>
                <button onClick={()=>setImportedPlayers([])} className="text-red-400 text-xs hover:text-red-300">Limpar</button>
              </div>
            )}
            {!preview?(
              <div>
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 mb-3">
                  <div className="text-slate-300 text-xs font-semibold mb-1.5">📌 Formato (um por linha):</div>
                  <div className="font-mono text-xs text-slate-400 space-y-0.5">
                    <div><span className="text-green-400">João Silva, Leões</span><span className="text-slate-600"> — vírgula</span></div>
                    <div><span className="text-green-400">7 Maria Santos, Tigres</span><span className="text-slate-600"> — com número</span></div>
                    <div><span className="text-yellow-400">Carlos Lima</span><span className="text-slate-600"> — sem time</span></div>
                  </div>
                </div>
                <textarea value={importText} onChange={e=>setImportText(e.target.value)}
                  className="w-full h-36 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none placeholder-slate-600"
                  placeholder={"João Silva, Leões\n7 Maria Santos, Leões\nPedro Alves, Tigres"}/>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-slate-500 text-xs">{importText.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).length} linha(s)</span>
                  <button onClick={handleProcess} disabled={!importText.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">Processar →</button>
                </div>
              </div>
            ):(
              <div>
                {preview.found.length>0&&(
                  <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-3 mb-2">
                    <div className="text-green-400 text-xs font-bold mb-1.5">✅ Times reconhecidos ({preview.found.length})</div>
                    <div className="flex flex-wrap gap-1.5">{preview.found.map(n=>{const idx=teamNames.findIndex(t=>t.toLowerCase()===n.toLowerCase());return(<span key={n} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-900/40 text-green-300 text-xs"><span className="w-2 h-2 rounded-full inline-block" style={{background:idx>=0?TEAM_COLORS[idx%TEAM_COLORS.length]:'#22C55E'}}/>{n}</span>);})}</div>
                  </div>
                )}
                {preview.notFound.length>0&&(
                  <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3 mb-2">
                    <div className="text-yellow-400 text-xs font-bold mb-1.5">⚠️ Não encontrados ({preview.notFound.length})</div>
                    {preview.notFound.map(n=>(<label key={n} className="flex items-center gap-2 mb-1 cursor-pointer"><input type="checkbox" checked={createMissing[n]??true} onChange={e=>setCreateMissing(p=>({...p,[n]:e.target.checked}))} className="w-3.5 h-3.5 accent-indigo-500"/><span className="text-yellow-200 text-xs">{n}</span><span className="text-yellow-600 text-xs">{createMissing[n]?'→ criar':'→ sem time'}</span></label>))}
                  </div>
                )}
                {preview.noTeam.length>0&&(
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-2">
                    <div className="text-slate-400 text-xs font-bold mb-1">👤 Sem time ({preview.noTeam.length})</div>
                    <div className="text-slate-400 text-xs">{preview.noTeam.map(p=>p.name).join(', ')}</div>
                  </div>
                )}
                <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 mb-3">
                  <div className="text-slate-400 text-xs mb-1">{preview.parsed.length} jogadores prontos para importar</div>
                  <div className="flex flex-wrap gap-1">{preview.parsed.map((p,i)=><span key={i} className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">{p.number?`#${p.number} `:''}{p.name}</span>)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setPreview(null)} className="flex-1 py-2 rounded-xl border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 transition-colors">← Editar</button>
                  <button onClick={handleConfirmImport} className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">✅ Confirmar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="flex justify-between w-full max-w-lg">
        <button onClick={()=>step===1?onCancel():setStep(s=>s-1)} className="px-4 py-2 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
          {step===1?'✕ Cancelar':'← Voltar'}
        </button>
        {step<4
          ?<button onClick={()=>setStep(s=>s+1)} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">Próximo →</button>
          :<button onClick={handleFinish} className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors">
            {importedPlayers.length>0?`🚀 Iniciar com ${importedPlayers.length} jogadores`:'🚀 Iniciar Categoria'}
          </button>
        }
      </div>
    </div>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

interface HomeScreenProps { tournament:Tournament; onSelectCategory:(id:string)=>void; onAddCategory:()=>void; onRename:(name:string)=>void; onDeleteCategory:(id:string)=>void; }

function HomeScreen({tournament,onSelectCategory,onAddCategory,onRename,onDeleteCategory}:HomeScreenProps){
  const [editingName,setEditingName]=useState(false);
  const [nameVal,setNameVal]=useState(tournament.name);

  return(
    <div className="min-h-screen bg-[#0f172a] p-4">
      {/* Header torneio */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
        <div className="text-3xl">🏆</div>
        <div className="flex-1 min-w-0">
          {editingName?(
            <div className="flex items-center gap-2">
              <input value={nameVal} onChange={e=>setNameVal(e.target.value)} autoFocus
                onBlur={()=>{onRename(nameVal||tournament.name);setEditingName(false);}}
                onKeyDown={e=>{if(e.key==='Enter'){onRename(nameVal||tournament.name);setEditingName(false);}}}
                className="flex-1 bg-slate-900 border border-indigo-500 rounded-lg px-3 py-1.5 text-white text-lg font-bold focus:outline-none"/>
            </div>
          ):(
            <div className="flex items-center gap-2">
              <h1 className="text-white text-xl font-bold truncate">{tournament.name}</h1>
              <button onClick={()=>setEditingName(true)} className="text-slate-500 hover:text-slate-300 text-xs flex-shrink-0">✎</button>
            </div>
          )}
          <div className="text-slate-400 text-xs mt-0.5">{tournament.categories.length} categoria{tournament.categories.length!==1?'s':''}</div>
        </div>
      </div>

      {/* Categorias */}
      {tournament.categories.length===0?(
        <div className="text-center py-16 bg-slate-800/40 rounded-2xl border border-dashed border-slate-600">
          <div className="text-5xl mb-4">📋</div>
          <div className="text-white font-semibold mb-2">Nenhuma categoria ainda</div>
          <div className="text-slate-400 text-sm mb-5">Adicione a primeira categoria para começar</div>
          <button onClick={onAddCategory} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors">+ Adicionar Categoria</button>
        </div>
      ):(
        <div className="space-y-3">
          {tournament.categories.map(cat=>{
            const played=cat.matches.filter(m=>m.played&&!m.isBye&&m.teamA&&m.teamB).length;
            const total=cat.matches.filter(m=>!m.isBye&&m.teamA&&m.teamB).length;
            const pct=total>0?Math.round(played/total*100):0;
            const champion=cat.champion?cat.teams.find(t=>t.id===cat.champion):null;
            const fmt=FORMATS.find(f=>f.id===cat.format);
            return(
              <div key={cat.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <button onClick={()=>onSelectCategory(cat.id)} className="w-full text-left p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{fmt?.icon??'⚽'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-base">{cat.name}</span>
                        {cat.champion&&<span className="text-yellow-400 text-xs font-bold bg-yellow-400/10 px-2 py-0.5 rounded-full">🏆 Concluído</span>}
                        {!cat.champion&&total>0&&pct===100&&<span className="text-orange-400 text-xs font-bold bg-orange-400/10 px-2 py-0.5 rounded-full">⏳ Fase Final</span>}
                        {!cat.champion&&pct<100&&played>0&&<span className="text-blue-400 text-xs font-bold bg-blue-400/10 px-2 py-0.5 rounded-full">🔄 Em andamento</span>}
                        {played===0&&<span className="text-slate-400 text-xs bg-slate-700 px-2 py-0.5 rounded-full">Não iniciado</span>}
                      </div>
                      <div className="text-slate-400 text-xs mt-1">{fmt?.name} · {cat.teams.length} times{cat.players.length>0?` · ${cat.players.length} jogadores`:''}</div>
                      {champion&&<div className="text-yellow-400 text-xs mt-1 font-semibold">Campeão: {champion.name}</div>}
                      {total>0&&!cat.champion&&(
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-slate-500 mb-1"><span>{played}/{total} jogos</span><span>{pct}%</span></div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all" style={{width:`${pct}%`}}/></div>
                        </div>
                      )}
                    </div>
                    <span className="text-slate-500 text-lg mt-1">›</span>
                  </div>
                </button>
                <div className="border-t border-slate-700 px-4 py-2 flex justify-end">
                  <button onClick={()=>{if(window.confirm(`Excluir "${cat.name}"?`))onDeleteCategory(cat.id);}} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Excluir</button>
                </div>
              </div>
            );
          })}
          <button onClick={onAddCategory} className="w-full py-3 rounded-2xl border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <span className="text-lg">+</span> Adicionar Categoria
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CATEGORY SCREEN ─────────────────────────────────────────────────────────

function getPending(cat:Category):Match[]{
  return cat.matches.filter(m=>{
    if(m.played||m.isBye||!m.teamA||!m.teamB)return false;
    if(cat.format==='groups_ko'&&cat.phase==='knockout')return m.phase!=='group';
    if(cat.format==='groups_ko'&&cat.phase==='groups')return m.phase==='group';
    if(cat.format==='league_playoffs'&&cat.phase==='playoffs')return m.phase!=='league';
    if(cat.format==='league_playoffs'&&cat.phase==='league')return m.phase==='league';
    return true;
  });
}
function getPlayed(cat:Category):Match[]{
  return cat.matches.filter(m=>{
    if(!m.played||m.isBye||!m.teamA||!m.teamB)return false;
    if(cat.format==='groups_ko'&&cat.phase==='knockout')return m.phase!=='group';
    if(cat.format==='groups_ko'&&cat.phase==='groups')return m.phase==='group';
    if(cat.format==='league_playoffs'&&cat.phase==='playoffs')return m.phase!=='league';
    if(cat.format==='league_playoffs'&&cat.phase==='league')return m.phase==='league';
    return true;
  });
}

interface CategoryScreenProps { cat:Category; tournName:string; onUpdate:(cat:Category)=>void; onBack:()=>void; }

function CategoryScreen({cat,tournName,onUpdate,onBack}:CategoryScreenProps){
  const [activeTab,setActiveTab]=useState('matches');
  const [editMatchId,setEditMatchId]=useState<string|null>(null);
  const [scoreA,setScoreA]=useState('');
  const [scoreB,setScoreB]=useState('');

  const getTeam=useCallback((id:string|null)=>cat.teams.find(t=>t.id===id),[cat.teams]);
  const standings=useMemo(()=>calcSt(cat.teams,cat.matches),[cat.teams,cat.matches]);

  const handleSaveScore=useCallback((mId:string)=>{
    const sA=parseInt(scoreA),sB=parseInt(scoreB);if(isNaN(sA)||isNaN(sB)||sA<0||sB<0)return;
    const m=cat.matches.find(x=>x.id===mId);if(!m)return;
    const ms=[...cat.matches];const mi=ms.findIndex(x=>x.id===mId);

    if(m.phase!=='league'&&m.phase!=='group'&&m.phase!=='swiss'){
      const winner=sA>sB?m.teamA:sB>sA?m.teamB:null;
      ms[mi]={...ms[mi],sA,sB,played:true,winner};
      if(winner){
        const r=m.round,idx=m.idx??0;
        const nx=ms.find(x=>x.round===r+1&&x.idx===Math.floor(idx/2));
        if(nx){if(idx%2===0)nx.teamA=winner;else nx.teamB=winner;}
        const maxR=Math.max(...ms.map(x=>x.round??0));
        const rMs=ms.filter(x=>x.round===maxR&&!x.isBye);
        if(rMs.length===1&&rMs[0].id===mId){onUpdate({...cat,matches:ms,champion:winner});setEditMatchId(null);return;}
      }
      onUpdate({...cat,matches:ms});
    } else {
      ms[mi]={...ms[mi],sA,sB,played:true};
      let updCat={...cat,matches:ms};
      if(cat.format==='round_robin'&&ms.every(m2=>m2.played)){const st=calcSt(cat.teams,ms);updCat={...updCat,champion:st[0].teamId};}
      if(cat.format==='swiss'){const rMs=ms.filter(m2=>m2.round===cat.swissRound);if(rMs.every(m2=>m2.played)&&cat.swissRound>=Math.ceil(Math.log2(cat.teams.length))){const st=calcSt(cat.teams,ms);updCat={...updCat,champion:st[0].teamId};}}
      onUpdate(updCat);
    }
    setEditMatchId(null);setScoreA('');setScoreB('');
  },[scoreA,scoreB,cat,onUpdate]);

  const fmtName=FORMATS.find(f=>f.id===cat.format)?.name??'';
  const pending=getPending(cat),played=getPlayed(cat);
  const swissMaxR=Math.ceil(Math.log2(cat.teams.length));
  const allGroupsDone=cat.matches.filter(m=>m.phase==='group'&&!m.isBye).every(m=>m.played);
  const allLeagueDone=cat.matches.filter(m=>m.phase==='league').every(m=>m.played);

  const tabs=[
    {id:'matches',label:'⚔️ Jogos'},
    {id:'standings',label:'📊 Classificação'},
    {id:'players',label:`👤 Jogadores${cat.players.length?` (${cat.players.length})`:''}` },
    ...(cat.format!=='round_robin'&&cat.format!=='swiss'?[{id:'bracket',label:'🎯 Chave'}]:[]),
    ...(cat.groups?[{id:'groups',label:'👥 Grupos'}]:[]),
  ];

  // Se tem campeão
  if(cat.champion){
    const champion=cat.teams.find(t=>t.id===cat.champion);
    return(
      <div className="min-h-screen bg-[#0f172a] p-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors">← {tournName}</button>
        <div className="text-center py-8">
          <div className="text-5xl mb-3">🏆</div>
          <div className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-2">Campeão — {cat.name}</div>
          <div className="text-3xl font-bold mb-2" style={{color:champion?.color??'#6366F1'}}>{champion?.name??'Campeão'}</div>
          <div className="w-10 h-1 rounded-full mb-6 mx-auto" style={{background:champion?.color??'#6366F1'}}/>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-left mb-4">
            <div className="text-white text-sm font-semibold mb-3">Classificação Final</div>
            <StTable standings={standings.slice(0,5)} getTeam={getTeam}/>
          </div>
          <button onClick={onBack} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors">← Voltar ao Torneio</button>
        </div>
      </div>
    );
  }

  return(
    <div className="min-h-screen bg-[#0f172a] p-4">
      {/* Breadcrumb */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs mb-3 transition-colors">
        <span className="text-base">←</span> <span className="text-slate-500">{tournName}</span>
      </button>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
        <div>
          <div className="text-slate-400 text-xs uppercase tracking-widest">{fmtName} · {cat.teams.length} times</div>
          <div className="text-white text-lg font-bold">{cat.name}</div>
        </div>
      </div>

      {/* Phase banners */}
      {(cat.format==='groups_ko'||cat.format==='league_playoffs')&&(
        <div className="flex items-center justify-between bg-indigo-900/40 border border-indigo-700/50 rounded-xl px-4 py-2.5 mb-4 gap-3 flex-wrap">
          <span className="text-indigo-300 text-sm">Fase: <strong>{cat.phase==='groups'?'Grupos':cat.phase==='knockout'?'Eliminatória':cat.phase==='league'?'Liga':'Playoffs'}</strong></span>
          {cat.format==='groups_ko'&&cat.phase==='groups'&&allGroupsDone&&(
            <button onClick={()=>{const adv:string[]=[];cat.groups?.forEach(g=>{const gst=calcSt(g.teams,cat.matches,g.name);if(gst[0])adv.push(gst[0].teamId);if(gst[1])adv.push(gst[1].teamId);});const koMs=genElim(adv,`${cat.id}_ko`);onUpdate({...cat,matches:[...cat.matches,...koMs],phase:'knockout'});}} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">Avançar para Eliminatória →</button>
          )}
          {cat.format==='league_playoffs'&&cat.phase==='league'&&allLeagueDone&&(
            <button onClick={()=>{const top=standings.slice(0,cat.playoffsN).map(s=>s.teamId);const poMs=genElim(top,`${cat.id}_po`);onUpdate({...cat,matches:[...cat.matches,...poMs],phase:'playoffs'});}} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors">Avançar para Playoffs →</button>
          )}
        </div>
      )}
      {cat.format==='swiss'&&(
        <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 mb-4 gap-3 flex-wrap">
          <span className="text-white text-sm">🇨🇭 Rodada <strong>{cat.swissRound}</strong>/{swissMaxR}</span>
          {pending.length===0&&cat.swissRound<swissMaxR&&(<button onClick={()=>{const nm=genSwiss(cat.teams,cat.matches,cat.swissRound+1);onUpdate({...cat,matches:[...cat.matches,...nm],swissRound:cat.swissRound+1});}} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors">Próxima Rodada →</button>)}
          {cat.swissRound>=swissMaxR&&pending.length===0&&<span className="text-green-400 text-xs font-semibold">✅ Concluído</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map(t=>(<button key={t.id} onClick={()=>setActiveTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab===t.id?'bg-indigo-600 text-white':'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>{t.label}</button>))}
      </div>

      {/* Tab content */}
      {activeTab==='matches'&&(
        <div>
          {pending.length>0&&(<div><div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Pendentes ({pending.length})</div>{pending.map(m=>(<MCard key={m.id} match={m} getTeam={getTeam} isEditing={editMatchId===m.id} scoreA={scoreA} scoreB={scoreB} onSetA={setScoreA} onSetB={setScoreB} onEdit={()=>{setEditMatchId(m.id);setScoreA('');setScoreB('');}} onSave={()=>handleSaveScore(m.id)} onCancel={()=>setEditMatchId(null)}/>))}</div>)}
          {played.length>0&&(<div className="mt-4"><div className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Realizados ({played.length})</div>{played.map(m=>(<MCard key={m.id} match={m} getTeam={getTeam} isEditing={false} scoreA="" scoreB="" onSetA={()=>{}} onSetB={()=>{}} onEdit={()=>{}} onSave={()=>{}} onCancel={()=>{}} readonly/>))}</div>)}
          {pending.length===0&&played.length===0&&<div className="text-center text-slate-500 py-12">Nenhum jogo disponível.</div>}
        </div>
      )}
      {activeTab==='standings'&&<StTable standings={standings} getTeam={getTeam}/>}
      {activeTab==='players'&&<PlayersTab cat={cat} onUpdate={onUpdate}/>}
      {activeTab==='bracket'&&<BracketTab matches={cat.matches.filter(m=>m.phase!=='group'&&m.phase!=='league'&&m.phase!=='swiss'&&!m.isBye)} getTeam={getTeam}/>}
      {activeTab==='groups'&&cat.groups&&<GroupsTab groups={cat.groups} matches={cat.matches} getTeam={getTeam}/>}
    </div>
  );
}

// ─── SUB-COMPONENTES ─────────────────────────────────────────────────────────

function MCard({match:m,getTeam,isEditing,scoreA,scoreB,onSetA,onSetB,onEdit,onSave,onCancel,readonly}:{match:Match;getTeam:(id:string|null)=>Team|undefined;isEditing:boolean;scoreA:string;scoreB:string;onSetA:(v:string)=>void;onSetB:(v:string)=>void;onEdit:()=>void;onSave:()=>void;onCancel:()=>void;readonly?:boolean}){
  const ta=getTeam(m.teamA),tb=getTeam(m.teamB);if(!ta||!tb)return null;
  const wA=m.played&&(m.sA??0)>(m.sB??0),wB=m.played&&(m.sB??0)>(m.sA??0);
  const ph=m.group?`Grupo ${m.group}`:m.phase==='league'?`Rodada ${m.round}`:m.phase;
  return(
    <div className={`bg-slate-800 rounded-xl border mb-2 px-4 py-3 transition-all ${isEditing?'border-indigo-500':'border-slate-700'}`}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{ph}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0"><span className={`text-sm truncate ${wA?'text-white font-semibold':'text-slate-400'}`}>{ta.name}</span><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:ta.color}}/></div>
        <div className="flex-shrink-0 flex items-center gap-1.5 min-w-[60px] justify-center">
          {isEditing?(<><input type="number" min={0} max={99} value={scoreA} onChange={e=>onSetA(e.target.value)} className="w-11 text-center bg-slate-900 border border-indigo-500 rounded-lg py-1 text-white text-lg font-bold focus:outline-none" autoFocus/><span className="text-slate-500">×</span><input type="number" min={0} max={99} value={scoreB} onChange={e=>onSetB(e.target.value)} className="w-11 text-center bg-slate-900 border border-indigo-500 rounded-lg py-1 text-white text-lg font-bold focus:outline-none"/></>)
          :m.played?(<><span className={`text-lg font-bold ${wA?'text-green-400':'text-white'}`}>{m.sA}</span><span className="text-slate-600 text-sm">–</span><span className={`text-lg font-bold ${wB?'text-green-400':'text-white'}`}>{m.sB}</span></>)
          :<span className="text-slate-600 text-xs">vs</span>}
        </div>
        <div className="flex-1 flex items-center gap-2 min-w-0"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:tb.color}}/><span className={`text-sm truncate ${wB?'text-white font-semibold':'text-slate-400'}`}>{tb.name}</span></div>
        {!readonly&&(<div className="flex-shrink-0 flex gap-1.5">
          {isEditing?(<><button onClick={onSave} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">✓</button><button onClick={onCancel} className="px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-xs hover:bg-slate-700 transition-colors">✕</button></>)
          :<button onClick={onEdit} className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 transition-colors">{m.played?'✎':'Placar'}</button>}
        </div>)}
      </div>
    </div>
  );
}

function StTable({standings,getTeam}:{standings:Standing[];getTeam:(id:string|null)=>Team|undefined}){
  if(!standings.length)return<div className="text-center text-slate-500 py-12">Nenhum jogo realizado ainda.</div>;
  const medals=['🥇','🥈','🥉'];
  return(
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="grid grid-cols-[24px_1fr_26px_26px_26px_26px_34px_34px_34px] gap-1 px-3 py-2 bg-slate-900 text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
        <span>#</span><span>Time</span><span className="text-center">J</span><span className="text-center">V</span><span className="text-center">E</span><span className="text-center">D</span><span className="text-center">SG</span><span className="text-center">GM</span><span className="text-center text-indigo-400">Pts</span>
      </div>
      {standings.map((st,i)=>{const t=getTeam(st.teamId);if(!t)return null;return(
        <div key={st.teamId} className={`grid grid-cols-[24px_1fr_26px_26px_26px_26px_34px_34px_34px] gap-1 px-3 py-2.5 border-t border-slate-700 text-sm items-center ${i===0?'bg-indigo-900/20':''}`}>
          <span className="text-slate-400 text-xs">{i<3?medals[i]:i+1}</span>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden"><div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:t.color}}/><span className={`truncate text-xs ${i===0?'text-white font-semibold':'text-slate-300'}`}>{t.name}</span></div>
          <span className="text-center text-slate-400 text-xs">{st.J}</span><span className="text-center text-slate-400 text-xs">{st.V}</span><span className="text-center text-slate-400 text-xs">{st.E}</span><span className="text-center text-slate-400 text-xs">{st.D}</span>
          <span className={`text-center text-xs ${st.SG>0?'text-green-400':st.SG<0?'text-red-400':'text-slate-400'}`}>{st.SG>0?'+':''}{st.SG}</span>
          <span className="text-center text-slate-400 text-xs">{st.GP}:{st.GC}</span>
          <span className={`text-center font-bold text-sm ${i===0?'text-indigo-400':'text-white'}`}>{st.P}</span>
        </div>);})}
    </div>
  );
}

function BracketTab({matches,getTeam}:{matches:Match[];getTeam:(id:string|null)=>Team|undefined}){
  if(!matches.length)return<div className="text-center text-slate-500 py-12">Fase eliminatória ainda não iniciada.</div>;
  const rounds=[...new Set(matches.map(m=>m.round))].sort((a,b)=>a-b);
  return(
    <div className="overflow-x-auto pb-4"><div className="flex gap-5 min-w-max pt-1">
      {rounds.map(r=>{const rms=matches.filter(m=>m.round===r);if(!rms.length)return null;return(
        <div key={r}><div className="text-[11px] text-slate-500 uppercase tracking-wider text-center mb-3">{rms[0].phase}</div><div className="flex flex-col gap-4">
          {rms.map(m=>{const ta=m.teamA?getTeam(m.teamA):null,tb=m.teamB?getTeam(m.teamB):null;const wA=m.played&&(m.sA??0)>(m.sB??0),wB=m.played&&(m.sB??0)>(m.sA??0);return(
            <div key={m.id} className="w-44 border border-slate-700 rounded-xl overflow-hidden bg-slate-800">
              {[{t:ta,s:m.sA,w:wA},{t:tb,s:m.sB,w:wB}].map((side,si)=>(
                <div key={si} className={`flex items-center gap-2 px-2.5 py-2 text-xs ${si===0?'border-b border-slate-700':''} ${side.w?'bg-green-900/30':''}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:side.t?.color??'#4b5563'}}/>
                  <span className={`flex-1 truncate ${side.t?(side.w?'text-green-400 font-semibold':'text-slate-300'):'text-slate-600'}`}>{side.t?.name??'A definir'}</span>
                  {m.played&&side.s!==null&&<span className={`font-bold text-sm flex-shrink-0 ${side.w?'text-green-400':'text-slate-500'}`}>{side.s}</span>}
                </div>))}
            </div>);})}
        </div></div>);})}
    </div></div>
  );
}

function GroupsTab({groups,matches,getTeam}:{groups:Group[];matches:Match[];getTeam:(id:string|null)=>Team|undefined}){
  return(
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {groups.map(g=>{const gst=calcSt(g.teams,matches,g.name);return(
        <div key={g.name} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-700"><span className="text-indigo-400 font-semibold text-sm">Grupo {g.name}</span></div>
          {gst.map((st,i)=>{const t=getTeam(st.teamId);if(!t)return null;return(
            <div key={st.teamId} className={`flex items-center gap-2 px-4 py-2.5 text-sm ${i<gst.length-1?'border-b border-slate-700':''} ${i<2?'bg-green-900/10':''}`}>
              <span className="text-slate-500 text-xs w-4">{i+1}</span><div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:t.color}}/>
              <span className="flex-1 text-slate-300 truncate text-xs">{t.name}</span><span className="text-slate-500 text-xs">{st.V}V {st.E}E</span>
              <span className={`font-bold text-sm ${i<2?'text-green-400':'text-white'}`}>{st.P}pts</span>
              {i<2&&<span className="text-green-400 text-xs">↑</span>}
            </div>);})}
        </div>);})}
    </div>
  );
}

function PlayersTab({cat,onUpdate}:{cat:Category;onUpdate:(c:Category)=>void}){
  const [view,setView]=useState<'list'|'import'>('list');
  const [importText,setImportText]=useState('');
  const [preview,setPreview]=useState<{parsed:ParsedPlayer[];found:string[];notFound:string[];noTeam:ParsedPlayer[]}|null>(null);
  const [createMissing,setCreateMissing]=useState<Record<string,boolean>>({});
  const [done,setDone]=useState(false);
  const byTeam=useMemo(()=>{const m:Record<string,Player[]>={};cat.players.forEach(p=>{const k=p.teamId??'__no__';if(!m[k])m[k]=[];m[k].push(p);});return m;},[cat.players]);
  const handleProcess=()=>{
    if(!importText.trim())return;
    const parsed=parseImportText(importText);
    const tns=[...new Set(parsed.map(p=>p.teamName).filter(Boolean))] as string[];
    const found=tns.filter(n=>cat.teams.some(t=>t.name.toLowerCase()===n.toLowerCase()));
    const notFound=tns.filter(n=>!cat.teams.some(t=>t.name.toLowerCase()===n.toLowerCase()));
    setPreview({parsed,found,notFound,noTeam:parsed.filter(p=>!p.teamName)});
    const init:Record<string,boolean>={};notFound.forEach(n=>{init[n]=true;});setCreateMissing(init);
  };
  const handleConfirm=()=>{
    if(!preview)return;
    let newTeams=[...cat.teams];
    preview.notFound.forEach(name=>{if(createMissing[name]){newTeams.push({id:`${cat.id}_t${uid()}`,name,color:TEAM_COLORS[newTeams.length%TEAM_COLORS.length]});}});
    const newPlayers=[...cat.players,...preview.parsed.map(p=>({id:`pl_${uid()}`,name:p.name,teamId:p.teamName?newTeams.find(t=>t.name.toLowerCase()===p.teamName!.toLowerCase())?.id??null:null,number:p.number??undefined}))];
    onUpdate({...cat,teams:newTeams,players:newPlayers});
    setImportText('');setPreview(null);setDone(true);setTimeout(()=>{setView('list');setDone(false);},1200);
  };
  return(
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={()=>{setView('list');setPreview(null);}} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view==='list'?'bg-indigo-600 text-white':'bg-slate-800 text-slate-400 hover:text-white'}`}>👤 Lista ({cat.players.length})</button>
        <button onClick={()=>setView('import')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view==='import'?'bg-indigo-600 text-white':'bg-slate-800 text-slate-400 hover:text-white'}`}>📋 Importar</button>
      </div>
      {view==='list'&&(
        cat.players.length===0?(
          <div className="text-center py-12 bg-slate-800/40 rounded-2xl border border-dashed border-slate-600">
            <div className="text-3xl mb-2">👤</div><div className="text-white font-semibold mb-1">Sem jogadores</div>
            <button onClick={()=>setView('import')} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm mt-2 transition-colors">📋 Importar</button>
          </div>
        ):(
          <div>
            <div className="flex justify-between mb-3"><span className="text-slate-400 text-sm">{cat.players.length} jogadores</span><button onClick={()=>{if(window.confirm('Limpar todos?'))onUpdate({...cat,players:[]});}} className="text-xs text-red-400 border border-red-400/30 px-2 py-1 rounded-lg">Limpar</button></div>
            {cat.teams.map(team=>{const ps=byTeam[team.id]??[];if(!ps.length)return null;return(
              <div key={team.id} className="mb-3 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 bg-slate-900/50"><div className="w-3 h-3 rounded-full" style={{background:team.color}}/><span className="text-white font-semibold text-sm">{team.name}</span><span className="ml-auto text-slate-400 text-xs">{ps.length}</span></div>
                {ps.map((p,i)=>(<div key={p.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${i<ps.length-1?'border-b border-slate-700/50':''}`}>{p.number&&<span className="text-xs text-slate-400 w-6 text-center">#{p.number}</span>}<span className="flex-1 text-slate-200 text-xs">{p.name}</span><button onClick={()=>onUpdate({...cat,players:cat.players.filter(x=>x.id!==p.id)})} className="text-slate-600 hover:text-red-400 text-xs">✕</button></div>))}
              </div>);})}
            {byTeam['__no__']?.length>0&&(<div className="mb-3 bg-slate-800 rounded-xl border border-dashed border-slate-600 overflow-hidden"><div className="px-4 py-2.5 border-b border-slate-700"><span className="text-slate-400 text-sm font-semibold">Sem time</span></div>{byTeam['__no__'].map((p,i)=>(<div key={p.id} className={`flex items-center gap-2 px-4 py-2 ${i<byTeam['__no__'].length-1?'border-b border-slate-700/50':''}`}><span className="flex-1 text-slate-400 text-xs">{p.name}</span><button onClick={()=>onUpdate({...cat,players:cat.players.filter(x=>x.id!==p.id)})} className="text-slate-600 hover:text-red-400 text-xs">✕</button></div>))}</div>)}
          </div>
        )
      )}
      {view==='import'&&(done?(<div className="text-center py-12"><div className="text-4xl mb-2">✅</div><div className="text-green-400 font-bold">Importados!</div></div>):!preview?(
        <div>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 mb-3 text-xs font-mono text-slate-400 space-y-0.5">
            <div><span className="text-green-400">João Silva, Leões</span></div><div><span className="text-green-400">7 Maria, Tigres</span></div><div><span className="text-yellow-400">Carlos Lima</span><span className="text-slate-600"> — sem time</span></div>
          </div>
          <textarea value={importText} onChange={e=>setImportText(e.target.value)} className="w-full h-40 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none placeholder-slate-600" placeholder="João Silva, Leões\nMaria Santos, Tigres"/>
          <div className="flex justify-between items-center mt-2">
            <span className="text-slate-500 text-xs">{importText.split('\n').filter(l=>l.trim()&&!l.startsWith('#')).length} linhas</span>
            <button onClick={handleProcess} disabled={!importText.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-colors">Processar →</button>
          </div>
        </div>
      ):(
        <div>
          {preview.found.length>0&&(<div className="bg-green-900/20 border border-green-700/40 rounded-xl p-3 mb-2"><div className="text-green-400 text-xs font-bold mb-1.5">✅ Times reconhecidos</div><div className="flex flex-wrap gap-1">{preview.found.map(n=>{const t=cat.teams.find(t=>t.name.toLowerCase()===n.toLowerCase());return<span key={n} className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-900/40 text-green-300 text-xs"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:t?.color??'#22C55E'}}/>{n}</span>;})}</div></div>)}
          {preview.notFound.length>0&&(<div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3 mb-2"><div className="text-yellow-400 text-xs font-bold mb-1.5">⚠️ Não encontrados</div>{preview.notFound.map(n=>(<label key={n} className="flex items-center gap-2 mb-1 cursor-pointer"><input type="checkbox" checked={createMissing[n]??true} onChange={e=>setCreateMissing(p=>({...p,[n]:e.target.checked}))} className="w-3.5 h-3.5 accent-indigo-500"/><span className="text-yellow-200 text-xs">{n}</span><span className="text-yellow-600 text-xs">{createMissing[n]?'→ criar':'→ sem time'}</span></label>))}</div>)}
          <div className="bg-slate-900 rounded-xl p-3 mb-3 border border-slate-700"><div className="text-slate-400 text-xs mb-1">{preview.parsed.length} jogadores</div><div className="flex flex-wrap gap-1">{preview.parsed.map((p,i)=><span key={i} className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full">{p.number?`#${p.number} `:''}{p.name}</span>)}</div></div>
          <div className="flex gap-2"><button onClick={()=>setPreview(null)} className="flex-1 py-2 rounded-xl border border-slate-600 text-slate-300 text-xs hover:bg-slate-700 transition-colors">← Editar</button><button onClick={handleConfirm} className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">✅ Confirmar</button></div>
        </div>
      ))}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────

export default function Torneio(){
  const [tournament,setTournament]=useState<Tournament|null>(null);
  const [screen,setScreen]=useState<'start'|'home'|'setup_category'|'category'>('start');
  const [activeCatId,setActiveCatId]=useState<string|null>(null);
  const [tournNameInput,setTournNameInput]=useState('Interclasses 2026');

  const activeCat=useMemo(()=>tournament?.categories.find(c=>c.id===activeCatId)??null,[tournament,activeCatId]);

  const handleCreateTournament=()=>{
    setTournament({name:tournNameInput||'Meu Torneio',categories:[]});
    setScreen('home');
  };

  const handleAddCategory=(cat:Category)=>{
    setTournament(prev=>prev?{...prev,categories:[...prev.categories,cat]}:prev);
    setScreen('home');
  };

  const handleUpdateCategory=(updated:Category)=>{
    setTournament(prev=>prev?{...prev,categories:prev.categories.map(c=>c.id===updated.id?updated:c)}:prev);
  };

  if(screen==='start'){
    return(
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8"><div className="text-5xl mb-3">🏆</div><h1 className="text-white text-2xl font-bold">Gerenciador de Torneios</h1><p className="text-slate-400 text-sm mt-2">Organize torneios com múltiplas categorias</p></div>
        <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-4">
          <label className="text-slate-400 text-xs block mb-2">Nome do torneio</label>
          <input value={tournNameInput} onChange={e=>setTournNameInput(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-semibold focus:outline-none focus:border-indigo-500 mb-4" placeholder="Ex: Interclasses 2026"/>
          <div className="flex flex-wrap gap-2 mb-5">{['Interclasses 2026','Copa Municipal','Campeonato Escolar','Liga dos Amigos'].map(n=>(<button key={n} onClick={()=>setTournNameInput(n)} className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition-colors">{n}</button>))}</div>
          <button onClick={handleCreateTournament} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base transition-colors">Criar Torneio →</button>
        </div>
      </div>
    );
  }

  if(screen==='setup_category'){
    return<SetupWizard onDone={handleAddCategory} onCancel={()=>setScreen('home')}/>;
  }

  if(screen==='category'&&activeCat&&tournament){
    return<CategoryScreen cat={activeCat} tournName={tournament.name} onUpdate={handleUpdateCategory} onBack={()=>setScreen('home')}/>;
  }

  if(screen==='home'&&tournament){
    return<HomeScreen
      tournament={tournament}
      onSelectCategory={id=>{setActiveCatId(id);setScreen('category');}}
      onAddCategory={()=>setScreen('setup_category')}
      onRename={name=>setTournament(prev=>prev?{...prev,name}:prev)}
      onDeleteCategory={id=>setTournament(prev=>prev?{...prev,categories:prev.categories.filter(c=>c.id!==id)}:prev)}
    />;
  }

  return null;
}
