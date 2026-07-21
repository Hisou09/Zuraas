"use client";

import { useEffect,useMemo,useState } from "react";
import { Chrome } from "./Chrome";
import { catalog,type CatalogItem } from "../data/catalog";

type RecordItem={contentId:string;progress?:number;date:string};
export function CollectionPage({kind}:{kind:"history"|"library"}){
  const [records,setRecords]=useState<RecordItem[]>([]);const [allItems,setAllItems]=useState<CatalogItem[]>(catalog);const [query,setQuery]=useState("");
  useEffect(()=>{fetch(`/api/app/user-items?kind=${kind}`).then(r=>r.json()).then(data=>setRecords(data.items||[])).catch(()=>setRecords([]));fetch("/api/catalog").then(r=>r.json()).then(data=>setAllItems(data.items||catalog)).catch(()=>null)},[kind]);
  const joined=records.map(record=>({record,item:allItems.find(entry=>entry.id===record.contentId)})).filter((entry):entry is {record:RecordItem;item:CatalogItem}=>Boolean(entry.item));
  const remove=async(id:string)=>{await fetch(`/api/app/library?contentId=${id}`,{method:"DELETE"});setRecords(current=>current.filter(entry=>entry.contentId!==id))};
  if(kind==="library")return <LibraryView joined={joined.filter(entry=>entry.item.type!=="anime")} query={query} setQuery={setQuery} remove={remove}/>;
  return <Chrome><main className="collection-page"><div className="page-heading"><div><small>МИНИЙ САН</small><h1>Сүүлд үзсэн</h1><p>Үзэж, уншиж эхэлсэн бүтээлүүдээ үргэлжлүүлээрэй.</p></div><span>{joined.length}</span></div>{joined.length?<div className="collection-grid">{joined.map(({item,record})=><article key={item.id}><a href={`/title/${item.id}`}><img src={item.image} alt=""/><div><small>{item.type==="anime"?"ANIME":"MANGA"}</small><h2>{item.title}</h2><p>{record.progress||1}-р {item.type==="anime"?"анги":"бүлэг"} хүртэл</p><b>Үргэлжлүүлэх →</b></div></a></article>)}</div>:<Empty/>}</main></Chrome>;
}

function LibraryView({joined,query,setQuery,remove}:{joined:{record:RecordItem;item:CatalogItem}[];query:string;setQuery:(value:string)=>void;remove:(id:string)=>void}){
  const filtered=useMemo(()=>joined.filter(({item})=>item.title.toLowerCase().includes(query.toLowerCase())),[joined,query]);
  const stats=useMemo(()=>joined.reduce((value,{item,record})=>{const total=item.chapters||0;const progress=Math.min(record.progress||0,total);value.unread+=Math.max(total-progress,0);if(progress>=total&&total>0)value.completed++;else if(progress>0)value.reading++;return value},{unread:0,reading:0,completed:0}),[joined]);
  return <Chrome><main className="library-page"><header className="library-title"><h1>Миний сан</h1><p>Bookmark хийсэн манга, унших явц болон шинэ бүлгүүд.</p></header><section className="library-stats"><article className="active"><small>▥ &nbsp; НИЙТ БҮТЭЭЛ</small><strong>{joined.length}</strong></article><article><small>♨ &nbsp; УНШИХ БҮЛЭГ</small><strong>{stats.unread}</strong></article><article><small>▣ &nbsp; УНШИЖ БУЙ</small><strong>{stats.reading}</strong></article><article><small>⊙ &nbsp; ГҮЙЦСЭН</small><strong>{stats.completed}</strong></article></section><div className="library-toolbar"><label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Сангаас хайх..."/></label><button title="Жагсаалтаар харах">☷</button></div>{filtered.length?<section className="library-list">{filtered.map(({item,record})=>{const total=item.chapters||0;const read=Math.min(record.progress||0,total);const unread=Math.max(total-read,0);const percent=total?Math.round(read/total*100):0;const state=percent===0?"Эхлээгүй":percent===100?"Гүйцсэн":"Уншиж байна";return <article key={item.id}><img src={item.image} alt=""/><div className="library-item-info"><h2>{item.title}</h2><p><b>МАНГА</b><span>•</span>{item.status}<span>•</span><strong>{unread} унших бүлэг</strong></p><div className="reading-state"><span>{state}</span><b>{percent}%</b></div><div className="progress-track"><i style={{width:`${percent}%`}}/></div></div><a href={`/title/${item.id}`}>УНШИХ</a><button onClick={()=>remove(item.id)} aria-label="Сангаас хасах">×</button></article>})}</section>:<Empty/>}</main></Chrome>;
}
function Empty(){return <div className="collection-empty"><span>▥</span><h2>Одоогоор хоосон байна</h2><p>Манганы хуудаснаас Bookmark товчийг дарахад энд хадгалагдана.</p><a href="/catalog?type=manga">Манга үзэх</a></div>}
