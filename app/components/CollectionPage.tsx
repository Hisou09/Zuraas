"use client";

import { useEffect,useMemo,useState } from "react";
import { BookOpen,CheckCircle2,Clock3,Search,Sparkles,Trash2,X } from "lucide-react";
import { Chrome } from "./Chrome";
import { catalog,type CatalogItem } from "../data/catalog";
import { invalidateCachedJson,peekCachedJson,requestCachedJson } from "../data/client-cache";

type RecordItem={contentId:string;progress?:number;pageIndex?:number;total?:number;unread?:number;nextProgress?:number|null;date:string};
type LibraryEntry={record:RecordItem;item:CatalogItem};
type LibraryFilter="all"|"unread"|"completed";

export function CollectionPage({kind}:{kind:"history"|"library"}){
  const [records,setRecords]=useState<RecordItem[]>([]);
  const [allItems,setAllItems]=useState<CatalogItem[]>(catalog);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState(false);

  useEffect(()=>{
    let active=true;
    const recordKey=`user-items:${kind}`;
    const cachedRecords=peekCachedJson<{items:RecordItem[]}>(recordKey);
    const cachedCatalog=peekCachedJson<{items:CatalogItem[]}>("catalog");
    if(cachedRecords&&cachedCatalog){setRecords(cachedRecords.items||[]);setAllItems(cachedCatalog.items||catalog);setLoading(false)}
    Promise.all([
      requestCachedJson<{items:RecordItem[]}>(recordKey,`/api/app/user-items?kind=${kind}`,30_000),
      requestCachedJson<{items:CatalogItem[]}>("catalog","/api/catalog",300_000),
    ]).then(([recordData,catalogData])=>{
      if(!active)return;
      setRecords(recordData.items||[]);
      setAllItems(catalogData.items||catalog);
    }).catch(()=>{if(active&&!cachedRecords)setLoadError(true)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[kind]);

  const joined=records
    .map(record=>({record,item:allItems.find(entry=>entry.id===record.contentId)}))
    .filter((entry):entry is LibraryEntry=>Boolean(entry.item));
  const remove=async(id:string)=>{
    const response=await fetch(`/api/app/library?contentId=${encodeURIComponent(id)}`,{method:"DELETE"}).catch(()=>null);
    if(response?.ok){invalidateCachedJson("user-items:library");setRecords(current=>current.filter(entry=>entry.contentId!==id))}
  };

  const pageClass=kind==="library"?"library-page":"collection-page history-page";
  if(loading)return <Chrome><main className={pageClass}><CollectionLoading/></main></Chrome>;
  if(loadError)return <Chrome><main className={pageClass}><div className="collection-empty error-state"><span>!</span><h2>Мэдээлэл ачаалсангүй</h2><p>Холболтоо шалгаад дахин оролдоно уу.</p><button type="button" onClick={()=>window.location.reload()}>Дахин ачаалах</button></div></main></Chrome>;
  if(kind==="library")return <LibraryView joined={joined.filter(entry=>entry.item.type!=="anime")} query={query} setQuery={setQuery} remove={remove}/>;
  return <HistoryView joined={joined} query={query} setQuery={setQuery}/>;
}

function HistoryView({joined,query,setQuery}:{joined:LibraryEntry[];query:string;setQuery:(value:string)=>void}){
  const filtered=useMemo(()=>joined.filter(({item})=>item.title.toLowerCase().includes(query.trim().toLowerCase())),[joined,query]);
  return <Chrome><main className="collection-page history-page">
    <header className="history-heading"><div><h1>Сүүлд үзсэн</h1></div><span><Clock3 size={20}/><b>{joined.length}</b></span></header>
    <div className="history-toolbar"><label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Сүүлд үзсэнээс хайх..."/>{query&&<button type="button" onClick={()=>setQuery("")} aria-label="Хайлт арилгах"><X size={15}/></button>}</label></div>
    {filtered.length?<section className="history-list">{filtered.map(({item,record})=>{
      const progress=Math.max(1,Number(record.progress)||1);
      const progressLabel=item.type==="anime"?`Сүүлд үзсэн: ${progress}-р анги`:`Сүүлд уншсан: ${progress}-р бүлэг`;
      const pageIndex=Math.max(0,Number(record.pageIndex)||0);
      const href=item.type==="anime"?`/watch/${encodeURIComponent(item.id)}/${progress}`:`/read/${encodeURIComponent(item.id)}/${progress}${pageIndex>0?`?page=${pageIndex}`:""}`;
      return <a className="history-card" href={href} key={item.id} aria-label={`${item.title} — ${progressLabel}`}><img src={item.image} alt=""/><div><small>{item.type==="anime"?"ХЭНТАЙ":"МАНХВА"}</small><h2>{item.title}</h2><p><Clock3 size={13}/>{formatRelativeDate(record.date)}</p></div><span className="history-progress"><BookOpen size={16}/><b>{progressLabel}</b></span></a>;
    })}</section>:<Empty history/>}
  </main></Chrome>;
}

function LibraryView({joined,query,setQuery,remove}:{joined:LibraryEntry[];query:string;setQuery:(value:string)=>void;remove:(id:string)=>void}){
  const [filter,setFilter]=useState<LibraryFilter>("all");
  const entries=useMemo(()=>joined.map(({item,record})=>{
    const total=Math.max(0,Number(record.total??item.chapters??0));
    const progress=Math.max(0,Number(record.progress)||0);
    const unread=Math.max(0,Number(record.unread??Math.max(total-progress,0))||0);
    const nextValue=Number(record.nextProgress);
    const nextChapter=Number.isFinite(nextValue)&&nextValue>progress?nextValue:null;
    return {item,total,progress,unread,nextChapter};
  }),[joined]);
  const stats=useMemo(()=>({
    unread:entries.filter(entry=>entry.unread>0).length,
    completed:entries.filter(entry=>entry.unread===0).length,
  }),[entries]);
  const filtered=useMemo(()=>entries.filter(({item,unread})=>item.title.toLowerCase().includes(query.toLowerCase())&&(filter==="all"||(filter==="unread"?unread>0:unread===0))),[entries,query,filter]);

  return <Chrome><main className="library-page compact-view">
    <header className="library-title"><h1>Миний сан</h1></header>
    <section className="library-stats" aria-label="Сангийн шүүлтүүр">
      <button type="button" className={filter==="all"?"active":""} onClick={()=>setFilter("all")} aria-pressed={filter==="all"}><small>НИЙТ БҮТЭЭЛ</small><strong>{entries.length}</strong></button>
      <button type="button" className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")} aria-pressed={filter==="unread"}><small>УНШИХ БҮЛЭГТЭЙ</small><strong>{stats.unread}</strong></button>
      <button type="button" className={filter==="completed"?"active":""} onClick={()=>setFilter("completed")} aria-pressed={filter==="completed"}><small>ГҮЙЦСЭН</small><strong>{stats.completed}</strong></button>
    </section>
    <div className="library-toolbar"><label><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Сангаас хайх..."/>{query&&<button type="button" onClick={()=>setQuery("")} aria-label="Хайлт арилгах"><X size={15}/></button>}</label></div>
    <div className="mobile-library-tab"><span>Манхва</span><b>{filtered.length}</b></div>
    {filtered.length?<section className="library-list">{filtered.map(({item,progress,unread,nextChapter})=>{
      const unreadLabel=unread===0?"Шинэ бүлэггүй":`${unread} унших бүлэг байна`;
      const resumeHref=nextChapter===null?null:`/read/${encodeURIComponent(item.id)}/${nextChapter}`;
      const resumeLabel=progress>0?"Үргэлжлүүлэх":"Унших";
      const resumeAria=nextChapter===null?undefined:`${item.title} — ${nextChapter}-р бүлгээс ${progress>0?"үргэлжлүүлэх":"унших"}`;
      return <article className={`library-entry-card ${unread===0?"is-complete":"has-unread"}`} key={item.id}><img src={item.image} alt=""/><div className="library-item-info"><h2>{item.title}</h2><span className={`mobile-unread-count ${unread===0?"complete":"has-unread"}`}>{unread===0?<CheckCircle2 aria-hidden="true"/>:<Sparkles aria-hidden="true"/>}<span><b>{unreadLabel}</b></span></span></div><div className="library-card-actions">{resumeHref?<a href={resumeHref} aria-label={resumeAria} title={`${nextChapter}-р бүлэг`}><BookOpen size={15}/><span>{resumeLabel}</span></a>:<span className="library-read-unavailable" aria-label="Унших бүлэг алга"><CheckCircle2 size={15}/><span>Унших бүлэг алга</span></span>}<button type="button" onClick={()=>remove(item.id)} aria-label={`${item.title}-г сангаас устгах`}><Trash2 size={15}/><span>Устгах</span></button></div></article>;
    })}</section>:<Empty/>}
  </main></Chrome>;
}

function formatRelativeDate(value:string){
  const time=new Date(value.includes("T")?value:`${value.replace(" ","T")}Z`).getTime();
  if(!Number.isFinite(time))return "Саяхан үзсэн";
  const minutes=Math.max(0,Math.floor((Date.now()-time)/60000));
  if(minutes<1)return "Дөнгөж сая";
  if(minutes<60)return `${minutes} минутын өмнө`;
  const hours=Math.floor(minutes/60);if(hours<24)return `${hours} цагийн өмнө`;
  const days=Math.floor(hours/24);if(days<7)return `${days} хоногийн өмнө`;
  const weeks=Math.floor(days/7);if(weeks<5)return `${weeks} долоо хоногийн өмнө`;
  return `${Math.floor(days/30)} сарын өмнө`;
}

function Empty({history=false}:{history?:boolean}){return <div className="collection-empty"><span>{history?<Clock3 size={28}/>:<BookOpen size={28}/>}</span><h2>{history?"Үзсэн түүх хоосон байна":"Одоогоор хоосон байна"}</h2><p>{history?"Үзэж эсвэл уншиж эхэлсэн бүтээл энд автоматаар хадгалагдана.":"Манхвагийн хуудаснаас санд нэмэхэд энд хадгалагдана."}</p><a href="/catalog">Бүтээл үзэх</a></div>}
function CollectionLoading(){return <div className="collection-loading" role="status" aria-label="Мэдээлэл ачаалж байна">{Array.from({length:5},(_,index)=><span key={index}/>)}</div>}
