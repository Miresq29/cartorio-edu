// frontend/src/features/Dashboard/DashboardView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useApp } from '../../context/AppContext';

const GOLD   = '#C9A84C';
const NAVY   = '#0D1B3E';
const NAVY2  = '#1A2A52';
const GREEN  = '#059669';
const RED    = '#DC2626';
const AMBER  = '#D97706';
const PURPLE = '#7C3AED';
const COLORS = [GOLD, GREEN, RED, AMBER, PURPLE, '#0891B2', '#EC4899'];

interface QuizResult  { id:string; colaborador:string; userId?:string; nota:number; aprovado:boolean; trailTitle?:string; moduleTitle?:string; ia?:boolean; tenantId?:string; createdAt:any; }
interface TrilhaProg  { id:string; userId:string; userName:string; trilhaId:string; trilhaTitulo?:string; concluido:boolean; tenantId:string; }
interface Trilha      { id:string; titulo:string; descricao:string; icone:string; cor:string; modulos:any[]; tenantId:string; }
interface UserData    { id:string; name:string; cargo?:string; role:string; tenantId:string; }
interface Certificado { id:string; colaboradorNome:string; trilhaTitulo:string; notaFinal:number; emitidoEm:any; tenantId:string; }

function pct(a:number,b:number){ return b===0?0:Math.round((a/b)*100); }
function getMonth(ts:any){ if(!ts)return ''; const d=ts?.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}); }
function fmtDate(ts:any){ if(!ts)return '–'; const d=ts?.toDate?ts.toDate():new Date(ts); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }

const Tip:React.FC<any> = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:'#fff',border:'1px solid #E8D5A3',borderRadius:10,padding:'8px 12px',fontSize:11}}>
      {label && <p style={{fontWeight:900,color:NAVY,marginBottom:4}}>{label}</p>}
      {payload.map((p:any,i:number)=>(
        <p key={i} style={{color:p.color,fontWeight:700}}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const KPI:React.FC<{label:string;value:string|number;sub?:string;icon:string;color:string;trend?:number}> = ({label,value,sub,icon,color,trend}) => (
  <div style={{background:'#fff',border:'1px solid #E8D5A3',borderRadius:14,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
      <div style={{width:36,height:36,borderRadius:10,background:color+'20',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <i className={'fa-solid '+icon} style={{color,fontSize:14}}></i>
      </div>
      {trend!==undefined&&(
        <span style={{fontSize:10,fontWeight:900,padding:'3px 8px',borderRadius:8,background:trend>=0?'#d1fae5':'#fee2e2',color:trend>=0?GREEN:RED}}>
          {trend>=0?'↑':'↓'}{Math.abs(trend)}%
        </span>
      )}
    </div>
    <p style={{fontSize:10,fontWeight:900,color:'#8A9BB0',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:4}}>{label}</p>
    <p style={{fontSize:28,fontWeight:900,color:NAVY,lineHeight:1}}>{value}</p>
    {sub&&<p style={{fontSize:11,color:'#8A9BB0',marginTop:4}}>{sub}</p>}
  </div>
);

type CT = 'area'|'line'|'bar'|'pie'|'radar';
const ChartBtn:React.FC<{type:CT;active:CT;onClick:(t:CT)=>void}> = ({type,active,onClick}) => {
  const icons:Record<CT,string> = {area:'fa-chart-area',line:'fa-chart-line',bar:'fa-chart-bar',pie:'fa-chart-pie',radar:'fa-spider'};
  return (
    <button onClick={()=>onClick(type)} title={type}
      style={{width:28,height:28,borderRadius:8,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,
        background:active===type?GOLD:NAVY2,color:active===type?NAVY:'#94a3b8',transition:'all 0.15s'}}>
      <i className={'fa-solid '+icons[type]}></i>
    </button>
  );
};

const CardHeader:React.FC<{title:string;charts:CT[];active:CT;onChange:(t:CT)=>void}> = ({title,charts,active,onChange}) => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
    <p style={{fontSize:11,fontWeight:900,color:'#8A9BB0',textTransform:'uppercase',letterSpacing:'0.12em'}}>{title}</p>
    <div style={{display:'flex',gap:4}}>
      {charts.map(c=><ChartBtn key={c} type={c} active={active} onClick={onChange}/>)}
    </div>
  </div>
);

// ── COLAB DASHBOARD ───────────────────────────────────────────────────────────
const ColabDashboard:React.FC<{trilhas:Trilha[];progresso:TrilhaProg[];quizResults:QuizResult[];certificados:Certificado[];userName:string;userId:string}> = ({trilhas,progresso,quizResults,certificados,userName,userId}) => {
  const myProg  = progresso.filter(p=>p.userId===userId||p.userName===userName);
  const myRes   = quizResults.filter(r=>r.userId===userId||r.colaborador===userName);
  const myCerts = certificados.filter(c=>c.colaboradorNome===userName);
  const totalMods = trilhas.reduce((a,t)=>a+(t.modulos?.length??0),0);
  const doneMods  = myProg.filter(p=>p.concluido).length;
  const aprovados = myRes.filter(r=>r.aprovado).length;
  const media     = myRes.length?Math.round(myRes.reduce((a,r)=>a+r.nota,0)/myRes.length):0;
  const gPct      = pct(doneMods,totalMods);

  const [ctEvolucao, setCtEvolucao] = useState<CT>('area');
  const [ctTrilha,   setCtTrilha]   = useState<CT>('bar');

  const evolucao = useMemo(()=>{
    const map:Record<string,{mes:string;Nota:number;n:number}> = {};
    myRes.forEach(r=>{const m=getMonth(r.createdAt);if(!m)return;if(!map[m])map[m]={mes:m,Nota:0,n:0};map[m].Nota+=r.nota;map[m].n++;});
    return Object.values(map).slice(-6).map(x=>({mes:x.mes,'Media (%)':Math.round(x.Nota/x.n)}));
  },[myRes]);

  const porTrilha = useMemo(()=>trilhas.slice(0,6).map(t=>{
    const mods=t.modulos?.length??0;
    const done=myProg.filter(p=>p.trilhaId===t.id&&p.concluido).length;
    const res=myRes.filter(r=>r.trailTitle===t.titulo);
    const m=res.length?Math.round(res.reduce((a,r)=>a+r.nota,0)/res.length):0;
    return {name:t.titulo.slice(0,14)+(t.titulo.length>14?'…':''),'Conclusao (%)':pct(done,mods),'Media':m};
  }),[trilhas,myProg,myRes]);

  const statusTrilhas = useMemo(()=>{
    const c=trilhas.filter(t=>{const mods=t.modulos?.length??0;const done=myProg.filter(p=>p.trilhaId===t.id&&p.concluido).length;return mods>0&&done>=mods;}).length;
    const e=trilhas.filter(t=>{const done=myProg.filter(p=>p.trilhaId===t.id&&p.concluido).length;return done>0&&done<(t.modulos?.length??0);}).length;
    return [{name:'Concluidas',value:c,color:GREEN},{name:'Em andamento',value:e,color:GOLD},{name:'Nao iniciadas',value:trilhas.length-c-e,color:'#e2e8f0'}].filter(x=>x.value>0);
  },[trilhas,myProg]);

  const radarData = useMemo(()=>{
    return ['Onboarding','Normativo','Tecnico','Operacional','Comportamental'].map(cat=>({
      subject:cat, score:myRes.filter(r=>r.trailTitle?.toLowerCase().includes(cat.toLowerCase())).reduce((a,r,_,arr)=>a+r.nota/(arr.length||1),0)|0
    }));
  },[myRes]);

  const card = {background:'#fff',border:'1px solid #E8D5A3',borderRadius:14,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <KPI label="Modulos" value={`${doneMods}/${totalMods}`} sub={`${gPct}% do programa`} icon="fa-book-open" color={GOLD} />
        <KPI label="Aprovacoes" value={aprovados} sub={`de ${myRes.length} testes`} icon="fa-circle-check" color={GREEN} />
        <KPI label="Media Geral" value={`${media}%`} sub="nos testes" icon="fa-chart-bar" color={AMBER} />
        <KPI label="Certificados" value={myCerts.length} sub="emitidos" icon="fa-certificate" color={PURPLE} />
      </div>

      <div style={card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <span style={{fontSize:12,fontWeight:900,color:NAVY}}>Progresso Geral</span>
          <span style={{fontSize:12,fontWeight:900,color:GOLD}}>{gPct}%</span>
        </div>
        <div style={{width:'100%',background:'#F5EDD8',borderRadius:99,height:8}}>
          <div style={{width:`${gPct}%`,background:GOLD,height:8,borderRadius:99,transition:'width 0.7s'}}></div>
        </div>
        <p style={{fontSize:10,color:'#8A9BB0',marginTop:6}}>Aprovacao minima: <strong style={{color:NAVY}}>75%</strong> · Taxonomia de Bloom Medio</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div style={card}>
          <CardHeader title="Evolucao das Notas" charts={['area','line','bar']} active={ctEvolucao} onChange={setCtEvolucao} />
          {evolucao.length===0
            ? <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'#8A9BB0',fontSize:13}}>Nenhum teste ainda</div>
            : <ResponsiveContainer width="100%" height={180}>
                {ctEvolucao==='area'?(
                  <AreaChart data={evolucao} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.2}/><stop offset="95%" stopColor={GOLD} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="mes" tick={{fontSize:10,fill:'#8A9BB0'}}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/>
                    <Area type="monotone" dataKey="Media (%)" stroke={GOLD} strokeWidth={2} fill="url(#gA)" dot={{r:4,fill:GOLD}}/>
                  </AreaChart>
                ):ctEvolucao==='line'?(
                  <LineChart data={evolucao} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="mes" tick={{fontSize:10,fill:'#8A9BB0'}}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/>
                    <Line type="monotone" dataKey="Media (%)" stroke={GOLD} strokeWidth={2} dot={{r:4,fill:GOLD}}/>
                  </LineChart>
                ):(
                  <BarChart data={evolucao} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="mes" tick={{fontSize:10,fill:'#8A9BB0'}}/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="Media (%)" fill={GOLD} radius={[4,4,0,0]}/>
                  </BarChart>
                )}
              </ResponsiveContainer>
          }
        </div>
        <div style={card}>
          <p style={{fontSize:11,fontWeight:900,color:'#8A9BB0',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Status das Trilhas</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart><Pie data={statusTrilhas} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
              {statusTrilhas.map((e,i)=><Cell key={i} fill={e.color}/>)}
            </Pie><Tooltip content={<Tip/>}/></PieChart>
          </ResponsiveContainer>
          <div style={{marginTop:8}}>
            {statusTrilhas.map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,borderRadius:2,background:s.color}}></div><span style={{fontSize:11,color:'#5A6E8A'}}>{s.name}</span></div>
                <span style={{fontSize:11,fontWeight:900,color:NAVY}}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div style={card}>
          <CardHeader title="Conclusao e Notas por Trilha" charts={['bar','radar']} active={ctTrilha} onChange={setCtTrilha} />
          {porTrilha.length===0
            ? <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'#8A9BB0',fontSize:13}}>Sem dados</div>
            : <ResponsiveContainer width="100%" height={180}>
                {ctTrilha==='bar'?(
                  <BarChart data={porTrilha} margin={{top:5,right:10,left:-20,bottom:30}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#8A9BB0'}} angle={-20} textAnchor="end"/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="Conclusao (%)" fill={GOLD} radius={[4,4,0,0]}/><Bar dataKey="Media" fill={GREEN} radius={[4,4,0,0]}/>
                  </BarChart>
                ):(
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#F5EDD8"/><PolarAngleAxis dataKey="subject" tick={{fontSize:9,fill:'#8A9BB0'}}/>
                    <Radar name="Score" dataKey="score" stroke={GOLD} fill={GOLD} fillOpacity={0.2} strokeWidth={2}/><Tooltip content={<Tip/>}/>
                  </RadarChart>
                )}
              </ResponsiveContainer>
          }
        </div>
        <div style={card}>
          <p style={{fontSize:11,fontWeight:900,color:'#8A9BB0',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8}}>Atividade Recente</p>
          {myRes.length===0
            ? <div style={{textAlign:'center',padding:'32px 0',color:'#8A9BB0',fontSize:13}}>Nenhum teste ainda</div>
            : myRes.slice(0,5).map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #F5EDD8'}}>
                  <i className={'fa-solid '+(r.aprovado?'fa-circle-check':'fa-circle-xmark')} style={{color:r.aprovado?GREEN:RED,fontSize:14,flexShrink:0}}></i>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:11,fontWeight:700,color:NAVY,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.trailTitle||'Teste'}</p>
                    <p style={{fontSize:10,color:'#8A9BB0'}}>{fmtDate(r.createdAt)}</p>
                  </div>
                  <span style={{fontSize:12,fontWeight:900,color:r.aprovado?GREEN:RED,flexShrink:0}}>{r.nota}%</span>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
};

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
const AdminDashboard:React.FC<{trilhas:Trilha[];progresso:TrilhaProg[];quizResults:QuizResult[];usuarios:UserData[];certificados:Certificado[];tenantId:string}> = ({trilhas,progresso,quizResults,usuarios,certificados}) => {
  const colab = usuarios.filter(u=>!['SUPERADMIN','gestor'].includes(u.role));
  const allPass = quizResults.filter(r=>r.aprovado).length;
  const taxaAprov = pct(allPass,quizResults.length);
  const mediaGeral = quizResults.length?Math.round(quizResults.reduce((a,r)=>a+r.nota,0)/quizResults.length):0;

  const [ctMensal,  setCtMensal]  = useState<CT>('line');
  const [ctTrilhas, setCtTrilhas] = useState<CT>('bar');
  const [ctTop,     setCtTop]     = useState<CT>('bar');

  const testesPorMes = useMemo(()=>{
    const map:Record<string,{mes:string;Testes:number;Aprovados:number}> = {};
    quizResults.forEach(r=>{const m=getMonth(r.createdAt);if(!m)return;if(!map[m])map[m]={mes:m,Testes:0,Aprovados:0};map[m].Testes++;if(r.aprovado)map[m].Aprovados++;});
    return Object.values(map).slice(-6);
  },[quizResults]);

  const trilhasPerf = useMemo(()=>trilhas.slice(0,8).map(t=>{
    const res=quizResults.filter(r=>r.trailTitle===t.titulo);
    return {name:t.titulo.slice(0,14)+(t.titulo.length>14?'…':''),'Taxa (%)':res.length?pct(res.filter(r=>r.aprovado).length,res.length):0,Testes:res.length};
  }).filter(t=>t.Testes>0).sort((a,b)=>b['Taxa (%)']-a['Taxa (%)']),[trilhas,quizResults]);

  const perfisData = useMemo(()=>{
    const map:Record<string,number>={};
    usuarios.forEach(u=>{map[u.role]=(map[u.role]||0)+1;});
    return Object.entries(map).map(([name,value],i)=>({name,value,color:COLORS[i]}));
  },[usuarios]);

  const topColab = useMemo(()=>colab.map(u=>{
    const res=quizResults.filter(r=>r.userId===u.id||r.colaborador===u.name);
    return {name:u.name.split(' ')[0],media:res.length?Math.round(res.reduce((a,r)=>a+r.nota,0)/res.length):0,testes:res.length};
  }).filter(u=>u.testes>0).sort((a,b)=>b.media-a.media).slice(0,8),[colab,quizResults]);

  const distNotas = useMemo(()=>[
    {faixa:'0-49',   value:quizResults.filter(r=>r.nota<50).length,           color:RED},
    {faixa:'50-69',  value:quizResults.filter(r=>r.nota>=50&&r.nota<70).length,color:AMBER},
    {faixa:'70-84',  value:quizResults.filter(r=>r.nota>=70&&r.nota<85).length,color:GREEN},
    {faixa:'85-100', value:quizResults.filter(r=>r.nota>=85).length,           color:GOLD},
  ],[quizResults]);

  const card = {background:'#fff',border:'1px solid #E8D5A3',borderRadius:14,padding:20,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        <KPI label="Colaboradores" value={colab.length} sub="cadastrados" icon="fa-users" color={GOLD}/>
        <KPI label="Taxa Aprovacao" value={`${taxaAprov}%`} sub={`${allPass}/${quizResults.length} testes`} icon="fa-circle-check" color={GREEN}/>
        <KPI label="Media Geral" value={`${mediaGeral}%`} sub="em todos os testes" icon="fa-chart-bar" color={AMBER}/>
        <KPI label="Certificados" value={certificados.length} sub="emitidos" icon="fa-certificate" color={PURPLE}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div style={card}>
          <CardHeader title="Atividade Mensal da Equipe" charts={['line','bar','area']} active={ctMensal} onChange={setCtMensal}/>
          {testesPorMes.length===0
            ? <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'#8A9BB0',fontSize:13}}>Sem dados ainda</div>
            : <ResponsiveContainer width="100%" height={180}>
                {ctMensal==='line'?(
                  <LineChart data={testesPorMes} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="mes" tick={{fontSize:10,fill:'#8A9BB0'}}/><YAxis tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                    <Line type="monotone" dataKey="Testes" stroke={GOLD} strokeWidth={2} dot={{r:3}}/><Line type="monotone" dataKey="Aprovados" stroke={GREEN} strokeWidth={2} dot={{r:3}}/>
                  </LineChart>
                ):ctMensal==='bar'?(
                  <BarChart data={testesPorMes} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="mes" tick={{fontSize:10,fill:'#8A9BB0'}}/><YAxis tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="Testes" fill={GOLD} radius={[4,4,0,0]}/><Bar dataKey="Aprovados" fill={GREEN} radius={[4,4,0,0]}/>
                  </BarChart>
                ):(
                  <AreaChart data={testesPorMes} margin={{top:5,right:10,left:-20,bottom:0}}>
                    <defs>
                      <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD} stopOpacity={0.2}/><stop offset="95%" stopColor={GOLD} stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="mes" tick={{fontSize:10,fill:'#8A9BB0'}}/><YAxis tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                    <Area type="monotone" dataKey="Testes" stroke={GOLD} fill="url(#gT)" strokeWidth={2}/><Area type="monotone" dataKey="Aprovados" stroke={GREEN} fill="none" strokeWidth={2}/>
                  </AreaChart>
                )}
              </ResponsiveContainer>
          }
        </div>
        <div style={card}>
          <p style={{fontSize:11,fontWeight:900,color:'#8A9BB0',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Distribuicao de Notas</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart><Pie data={distNotas} cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="value" nameKey="faixa" paddingAngle={3}>
              {distNotas.map((e,i)=><Cell key={i} fill={e.color}/>)}
            </Pie><Tooltip content={<Tip/>}/></PieChart>
          </ResponsiveContainer>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:8}}>
            {distNotas.map((d,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:10,height:10,borderRadius:2,background:d.color,flexShrink:0}}></div>
                <span style={{fontSize:10,color:'#5A6E8A'}}>{d.faixa}%: <strong style={{color:NAVY}}>{d.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div style={card}>
          <CardHeader title="Taxa de Aprovacao por Trilha" charts={['bar','pie']} active={ctTrilhas} onChange={setCtTrilhas}/>
          {trilhasPerf.length===0
            ? <div style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',color:'#8A9BB0',fontSize:13}}>Sem dados ainda</div>
            : <ResponsiveContainer width="100%" height={180}>
                {ctTrilhas==='bar'?(
                  <BarChart data={trilhasPerf} margin={{top:5,right:10,left:-20,bottom:35}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8"/><XAxis dataKey="name" tick={{fontSize:10,fill:'#8A9BB0'}} angle={-20} textAnchor="end"/><YAxis domain={[0,100]} tick={{fontSize:10,fill:'#8A9BB0'}}/><Tooltip content={<Tip/>}/>
                    <Bar dataKey="Taxa (%)" radius={[4,4,0,0]}>{trilhasPerf.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Bar>
                  </BarChart>
                ):(
                  <PieChart><Pie data={trilhasPerf} cx="50%" cy="50%" outerRadius={70} dataKey="Taxa (%)" nameKey="name">
                    {trilhasPerf.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie><Tooltip content={<Tip/>}/></PieChart>
                )}
              </ResponsiveContainer>
          }
        </div>
        <div style={card}>
          <p style={{fontSize:11,fontWeight:900,color:'#8A9BB0',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:12}}>Perfis de Acesso</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart><Pie data={perfisData} cx="50%" cy="50%" outerRadius={58} dataKey="value">
              {perfisData.map((e,i)=><Cell key={i} fill={e.color}/>)}
            </Pie><Tooltip content={<Tip/>}/></PieChart>
          </ResponsiveContainer>
          <div style={{marginTop:8}}>
            {perfisData.map((p,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:10,height:10,borderRadius:2,background:p.color}}></div><span style={{fontSize:11,color:'#5A6E8A'}}>{p.name}</span></div>
                <span style={{fontSize:11,fontWeight:900,color:NAVY}}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {topColab.length>0&&(
        <div style={card}>
          <CardHeader title="Ranking de Desempenho" charts={['bar']} active={ctTop} onChange={setCtTop}/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topColab} layout="vertical" margin={{top:0,right:20,left:10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5EDD8" horizontal={false}/><XAxis type="number" domain={[0,100]} tick={{fontSize:10,fill:'#8A9BB0'}}/><YAxis type="category" dataKey="name" tick={{fontSize:11,fill:'#5A6E8A'}} width={70}/><Tooltip content={<Tip/>}/>
              <Bar dataKey="media" name="Media (%)" radius={[0,4,4,0]}>{topColab.map((e,i)=><Cell key={i} fill={e.media>=75?GREEN:e.media>=50?AMBER:RED}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ── MAIN ─────────────────────────────────────────────────────────────────────
const DashboardView:React.FC = () => {
  const {state} = useApp();
  const user = state.user!;
  const tenantId = user.tenantId;
  const isGestor = ['SUPERADMIN','gestor','admin'].includes(user.role);

  const [trilhas,      setTrilhas]      = useState<Trilha[]>([]);
  const [progresso,    setProgresso]    = useState<TrilhaProg[]>([]);
  const [quizResults,  setQuizResults]  = useState<QuizResult[]>([]);
  const [usuarios,     setUsuarios]     = useState<UserData[]>([]);
  const [certificados, setCertificados] = useState<Certificado[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(()=>{
    const u:Array<()=>void> = [];
    u.push(onSnapshot(query(collection(db,'trilhas'),where('tenantId','==',tenantId)),s=>setTrilhas(s.docs.map(d=>({id:d.id,...d.data()} as Trilha)))));
    u.push(onSnapshot(query(collection(db,'trilhasProgresso'),where('tenantId','==',tenantId)),s=>setProgresso(s.docs.map(d=>({id:d.id,...d.data()} as TrilhaProg)))));
    u.push(onSnapshot(query(collection(db,'treinamentosQuizResults'),orderBy('createdAt','desc')),s=>{setQuizResults(s.docs.map(d=>({id:d.id,...d.data()} as QuizResult)));setLoading(false);}));
    u.push(onSnapshot(query(collection(db,'users')),s=>setUsuarios(s.docs.map(d=>({id:d.id,...d.data()} as UserData)))));
    u.push(onSnapshot(query(collection(db,'certificados'),where('tenantId','==',tenantId)),s=>setCertificados(s.docs.map(d=>({id:d.id,...d.data()} as Certificado)))));
    return ()=>u.forEach(f=>f());
  },[tenantId]);

  if(loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#F8F7F2'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:36,height:36,border:`3px solid ${GOLD}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite',margin:'0 auto'}}></div>
        <p style={{color:'#8A9BB0',fontSize:13,marginTop:12}}>Carregando...</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#F8F7F2',padding:24}}>
      <div style={{maxWidth:1200,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
          <div>
            <h2 style={{fontSize:22,fontWeight:900,color:NAVY,margin:0}}>{isGestor?'Painel Geral':`Ola, ${user.name.split(' ')[0]}`}</h2>
            <p style={{fontSize:13,color:'#8A9BB0',margin:'2px 0 0'}}>{isGestor?'Acompanhe o desempenho da sua equipe':'Plataforma de Conformidade Notarial'}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:`1px solid ${GOLD}`,borderRadius:12,padding:'8px 14px'}}>
            <i className="fa-solid fa-brain" style={{color:GOLD,fontSize:12}}></i>
            <span style={{fontSize:10,fontWeight:900,color:NAVY,textTransform:'uppercase',letterSpacing:'0.12em'}}>Bloom Medio · 75% aprovacao</span>
          </div>
        </div>
        {isGestor
          ? <AdminDashboard trilhas={trilhas} progresso={progresso} quizResults={quizResults} usuarios={usuarios} certificados={certificados} tenantId={tenantId}/>
          : <ColabDashboard trilhas={trilhas} progresso={progresso} quizResults={quizResults} certificados={certificados} userName={user.name} userId={user.id}/>
        }
      </div>
    </div>
  );
};

export default DashboardView;
