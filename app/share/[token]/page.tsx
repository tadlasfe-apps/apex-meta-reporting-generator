"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Campaign = { name:string; objective:string; spend:number; results:number; cost:number; clicks:number; impressions:number; ctr:number; frequency:number; status:string; activeAds?:number; videoViews?:number };
type Draft = { summary:string; changes:string[]; spotlightTitle:string; spotlight:string[]; recommendations:{priority:string;title:string;body:string}[]; plan:{action:string;priority:string;impact:string}[]; internal?:{title:string;items:string[]}[] };
type SharedReport = {
  share:{viewMode:"CLIENT"|"AM";expiresAt:string|null};
  account:{name:string;location:string;logoUrl:string|null;logoDataUrl:string|null};
  report:{id:string;reportMonth:string;dateRange:string;campaigns:Campaign[];draft:Draft;hiddenKpis:string[];metrics:Record<string,number|null>;status:string;updatedAt:string};
};

const money=(value:number,digits=2)=>value?value.toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:digits,maximumFractionDigits:digits}):"-";
const num=(value:number)=>Number(value||0).toLocaleString("en-US",{maximumFractionDigits:0});
const isLead=(value:string)=>/(lead|contact|form|call|appointment|conversion)/i.test(value)&&!/(thruplay|video|view|reach|click|impression)/i.test(value);
const isVideo=(value:string)=>/(thruplay|video view)/i.test(value);

function summarize(rows:Campaign[]){
  const groups=new Map<string,{campaign:Campaign;ctrWeight:number;frequencyWeight:number}>();
  for(const row of rows||[]){
    const key=row.name?.trim()||"Unnamed campaign",current=groups.get(key);
    if(!current){groups.set(key,{campaign:{...row,name:key,activeAds:row.activeAds??(row.status==="Active"?1:0)},ctrWeight:row.ctr*row.impressions,frequencyWeight:row.frequency*row.impressions});continue}
    const campaign=current.campaign;
    campaign.spend+=row.spend;campaign.results+=row.results;campaign.clicks+=row.clicks;campaign.impressions+=row.impressions;campaign.videoViews=(campaign.videoViews??(isVideo(campaign.objective)?campaign.results-row.results:0))+(row.videoViews??(isVideo(row.objective)?row.results:0));
    campaign.activeAds=(campaign.activeAds??0)+(row.activeAds??(row.status==="Active"?1:0));
    if(row.status==="Active")campaign.status="Active";
    current.ctrWeight+=row.ctr*row.impressions;current.frequencyWeight+=row.frequency*row.impressions;
  }
  return Array.from(groups.values()).map(({campaign,ctrWeight,frequencyWeight})=>({...campaign,cost:campaign.results?campaign.spend/campaign.results:0,ctr:campaign.impressions?ctrWeight/campaign.impressions:0,frequency:campaign.impressions?frequencyWeight/campaign.impressions:0}));
}

function calculate(campaigns:Campaign[]){
  const spend=campaigns.reduce((a,c)=>a+c.spend,0),impressions=campaigns.reduce((a,c)=>a+c.impressions,0),clicks=campaigns.reduce((a,c)=>a+c.clicks,0);
  const leadRows=campaigns.filter(c=>isLead(c.objective)),leads=leadRows.reduce((a,c)=>a+c.results,0),leadSpend=leadRows.filter(c=>c.results>0).reduce((a,c)=>a+c.spend,0);
  return {spend,impressions,clicks,leads,cpl:leads?leadSpend/leads:0,videoViews:campaigns.reduce((total,c)=>total+(c.videoViews??(isVideo(c.objective)?c.results:0)),0),cpc:clicks?spend/clicks:0,linkRate:impressions?clicks/impressions*100:0,frequency:impressions?campaigns.reduce((a,c)=>a+c.frequency*c.impressions,0)/impressions:0};
}

function Metric({label,value,detail,primary=false}:{label:string;value:string;detail:string;primary?:boolean}){
  return <article className={primary?"metric primary":"metric"}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export default function SharedReportPage({params}:{params:Promise<{token:string}>}){
  const {token}=use(params);
  const [shared,setShared]=useState<SharedReport|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [agencyLogo,setAgencyLogo]=useState("");
  useEffect(()=>{let active=true;(async()=>{if(!supabase){setError("Report sharing is not configured.");setLoading(false);return}const {data,error}=await supabase.rpc("get_shared_report",{share_token:token});if(!active)return;if(error||!data)setError("This share link is invalid, expired, or has been revoked.");else setShared(data as SharedReport);setLoading(false)})();return()=>{active=false}},[token]);
  useEffect(()=>{let active=true;fetch("/apex-logo-cropped.png").then(response=>response.blob()).then(blob=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)})).then(value=>{if(active)setAgencyLogo(value)}).catch(()=>{if(active)setAgencyLogo("")});return()=>{active=false}},[]);
  const campaigns=useMemo(()=>shared?.report.campaigns||[],[shared]);
  const summaries=useMemo(()=>summarize(campaigns),[campaigns]);
  const metrics=useMemo(()=>{const calculated=calculate(campaigns),saved=shared?.report.metrics||{},hasOverride=saved.leadOverride!==null&&saved.leadOverride!==undefined;return hasOverride?{...calculated,leads:Number(saved.leads||0),cpl:Number(saved.cpl||0),metaLeads:Number(saved.metaLeads??calculated.leads),leadOverride:Number(saved.leadOverride)}:{...calculated,metaLeads:calculated.leads,leadOverride:null}},[campaigns,shared]);
  if(loading)return <main className="shared-report-status"><img src="/apex-logo-cropped.png" alt="APEX"/><p>Loading shared report…</p></main>;
  if(error||!shared)return <main className="shared-report-status"><img src="/apex-logo-cropped.png" alt="APEX"/><h1>Report unavailable</h1><p>{error}</p></main>;
  const {account,report,share}=shared,draft=report.draft,hidden=new Set(report.hiddenKpis||[]);
  const exportPayload=JSON.stringify({
    account:{
      name:account.name,
      location:account.location,
      reportMonth:report.reportMonth,
      dateRange:report.dateRange,
      logoDataUrl:account.logoDataUrl||"",
      hiddenKpis:report.hiddenKpis||[],
      campaigns:report.campaigns||[],
      draft:{...draft,internal:draft.internal||[]}
    },
    metrics,
    agencyLogo,
    view:share.viewMode==="AM"?"internal":"client"
  });
  return <main className="shared-report-page">
    <header className="share-toolbar no-print"><div><img src="/apex-logo-cropped.png" alt="APEX"/><span>Shared read-only report</span></div><div><b>{share.viewMode==="AM"?"AM view":"Client report"}</b><button type="button" onClick={()=>window.print()}>Download PDF</button><form method="POST" action="/api/export"><input type="hidden" name="payload" value={exportPayload}/><button type="submit">Download Word</button></form></div></header>
    <div className="report-shell">
      <header className="report-header">{account.logoDataUrl?<img className="client-logo" src={account.logoDataUrl} alt={account.name}/>:<div className="logo-placeholder">{account.name}</div>}<div><b>META ADS REPORT</b><span>{String(report.dateRange||"").toUpperCase()}</span></div></header>
      <section className="hero"><p className="eyebrow">Monthly performance report · {account.location}</p><h1>{account.name}</h1><div className="summary">{draft.summary}</div></section>
      <section><h2>Primary KPIs</h2><div className="metrics kpi-grid">{!hidden.has("leads")&&<Metric primary label="Leads / contacts" value={num(metrics.leads)} detail={metrics.leadOverride!==null?`GHL verified · Meta: ${num(metrics.metaLeads)}`:"Tracked by Meta"}/>}{!hidden.has("cpl")&&<Metric primary label="Cost per lead" value={money(metrics.cpl)} detail={metrics.leadOverride!==null?"Adjusted to GHL lead total":"Lead-producing campaigns"}/>}{!hidden.has("spend")&&<Metric primary label="Total spend" value={money(metrics.spend)} detail={`${summaries.length} campaigns · ${summaries.reduce((total,c)=>total+(c.activeAds??0),0)} ads running`}/>}</div></section>
      <section><h2>Secondary KPIs</h2><div className="metrics kpi-grid">{!hidden.has("impressions")&&<Metric label="Impressions" value={num(metrics.impressions)} detail="Total delivery"/>}{!hidden.has("clicks")&&<Metric label="Link clicks" value={num(metrics.clicks)} detail={`${metrics.linkRate.toFixed(2)}% link click rate`}/>} {!hidden.has("cpc")&&<Metric label="Cost per link click" value={money(metrics.cpc)} detail="Blended"/>}{!hidden.has("videoViews")&&<Metric label="Video results" value={num(metrics.videoViews)} detail="ThruPlays / video views"/>}{!hidden.has("frequency")&&<Metric label="Avg. frequency" value={metrics.frequency.toFixed(2)} detail="Weighted"/>}</div></section>
      <section className="campaign-summary"><div className="section-title"><h2>Campaign summary</h2><span>Meta export · Campaign level</span></div><div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Result type</th><th>Spend</th><th>Results</th><th>Cost / result</th><th>Link clicks</th><th>CTR (all)</th></tr></thead><tbody>{summaries.map((c,i)=><tr key={`${c.name}-${i}`}><td><b>{c.name}</b><small>{c.status} · {c.activeAds??0} ad{(c.activeAds??0)===1?"":"s"} running</small></td><td>{c.objective}</td><td>{money(c.spend)}</td><td>{c.results?num(c.results):"-"}</td><td>{money(c.cost,c.cost<1?3:2)}</td><td>{num(c.clicks)}</td><td>{c.ctr.toFixed(2)}%</td></tr>)}</tbody><tfoot><tr><td colSpan={2}>Total</td><td>{money(metrics.spend)}</td><td>{num(metrics.leads)} leads</td><td>{money(metrics.cpl)}</td><td>{num(metrics.clicks)}</td><td>-</td></tr></tfoot></table></div></section>
      <section className="page-break"><div className="page-heading"><div><p>{account.name.toUpperCase()}</p><h2>Performance Notes This Period</h2></div><span>{report.reportMonth.toUpperCase()}</span></div><h3>What the data shows and why it matters</h3><div className="change-list">{(draft.changes||[]).map((item,i)=><article key={i}><span>{i+1}</span><p>{item}</p></article>)}</div><h3>Results spotlight</h3><div className="spotlight"><h4>{draft.spotlightTitle}</h4><ul>{(draft.spotlight||[]).map((item,i)=><li key={i}>{item}</li>)}</ul></div></section>
      <section className="page-break"><div className="page-heading"><div><p>{account.name.toUpperCase()}</p><h2>Suggestions & Next Steps</h2></div><span>{report.reportMonth.toUpperCase()}</span></div><h3>Suggestions for next period</h3><div className="recommendations">{(draft.recommendations||[]).map((item,i)=><article key={i}><span>{item.priority}</span><h4>{item.title}</h4><p>{item.body}</p></article>)}</div><h3>Next period plan</h3><div className="plan-table"><div className="plan-head"><b>Action item</b><b>Priority</b><b>Expected impact</b></div>{(draft.plan||[]).map((item,i)=><div className="plan-row" key={i}><b>{item.action}</b><span>{item.priority}</span><span>{item.impact}</span></div>)}</div></section>
      {share.viewMode==="AM"&&draft.internal&&<section className="internal page-break"><div className="page-heading"><div><p>ACCOUNT MANAGEMENT ONLY</p><h2>Internal Notes & Follow-Up</h2></div><span>{report.reportMonth.toUpperCase()}</span></div><div className="internal-grid">{draft.internal.map((section,i)=><article key={i}><h3>{section.title}</h3><ul>{section.items.map((item,j)=><li key={j}>{item}</li>)}</ul></article>)}</div></section>}
      <footer><img src="/apex-logo-cropped.png" alt="APEX"/><span>Shared read-only · Prepared for {account.name} · {report.reportMonth}</span></footer>
    </div>
  </main>;
}
