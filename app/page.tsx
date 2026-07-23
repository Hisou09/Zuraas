"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Clock3 } from "lucide-react";
import Link from "next/link";
import { Chrome } from "./components/Chrome";
import type { CatalogItem } from "./data/catalog";
import { peekCachedJson,requestCachedJson } from "./data/client-cache";

function timestampMs(value?:string){
  const raw=value?.trim();
  if(!raw)return 0;
  if(/^\d{10,13}$/.test(raw)){const numeric=Number(raw);return raw.length===10?numeric*1000:numeric}
  const isoLike=/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(raw);
  const normalized=isoLike?`${raw.replace(" ","T")}Z`:raw;
  const parsed=new Date(normalized).getTime();
  return Number.isFinite(parsed)&&parsed>=Date.UTC(2000,0,1)?parsed:0;
}
function itemTimestamp(item:CatalogItem){return timestampMs(item.latestAt)>0?item.latestAt:timestampMs(item.createdAt)>0?item.createdAt:undefined}
function relativeTime(value?:string){
  const time=timestampMs(value);
  if(!time)return "Саяхан";
  const elapsed=Math.max(0,Date.now()-time);
  const minutes=Math.floor(elapsed/60_000);
  if(minutes<1)return "Саяхан";
  if(minutes<60)return `${minutes} минутын өмнө`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours} цагийн өмнө`;
  const days=Math.floor(hours/24);
  if(days<7)return `${days} хоногийн өмнө`;
  if(days<30)return `${Math.floor(days/7)} долоо хоногийн өмнө`;
  const months=Math.floor(days/30);
  if(months<12)return `${months} сарын өмнө`;
  return `${Math.floor(months/12)} жилийн өмнө`;
}
function Card({item,isNew=false}:{item:CatalogItem;isNew?:boolean}){
  const total=item.type==="anime"?item.episodes:item.chapters;
  const count=typeof total==="number"&&total>0?`${total} ${item.type==="anime"?"анги":"бүлэг"}`:null;
  const type=item.type==="anime"?"Хэнтаи":"Манхва";
  return <Link className="card" href={`/title/${item.id}`} prefetch={false} aria-label={`${item.title} дэлгэрэнгүй`}><div className="cover">{isNew&&<strong className="new-release-badge">Шинэ</strong>}<img src={item.image} alt={`${item.title} нүүр зураг`} loading="lazy" draggable={false}/>{count&&<b className="cover-count">{count}</b>}<i className="cover-type">{type}</i><span>▶</span></div><h3>{item.title}</h3><time className="card-time" dateTime={itemTimestamp(item)}><Clock3 size={13}/>{relativeTime(itemTimestamp(item))}</time></Link>;
}
function Shelf({title,items,more,markNew=false,controls=true}:{title:string;items:CatalogItem[];more?:string;markNew?:boolean;controls?:boolean}){
  const row=useRef<HTMLDivElement>(null);const drag=useRef({active:false,startX:0,scrollLeft:0,moved:false});
  const move=(direction:number)=>{const container=row.current;if(!container)return;const card=container.querySelector<HTMLElement>(".card");const gap=parseFloat(getComputedStyle(container).columnGap)||12;container.scrollBy({left:direction*((card?.offsetWidth||container.clientWidth)+gap),behavior:"smooth"})};
  const pointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{if(event.pointerType==="mouse"&&event.button!==0)return;const container=row.current;if(!container)return;drag.current={active:true,startX:event.clientX,scrollLeft:container.scrollLeft,moved:false}};
  const pointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{const container=row.current;if(!container||!drag.current.active)return;const distance=event.clientX-drag.current.startX;if(Math.abs(distance)>10&&!drag.current.moved){drag.current.moved=true;container.setPointerCapture(event.pointerId);container.classList.add("dragging")}if(drag.current.moved)container.scrollLeft=drag.current.scrollLeft-distance};
  const pointerEnd=(event:ReactPointerEvent<HTMLDivElement>)=>{const container=row.current;if(!container)return;drag.current.active=false;if(container.hasPointerCapture(event.pointerId))container.releasePointerCapture(event.pointerId);container.classList.remove("dragging")};
  const stopDraggedClick=(event:ReactMouseEvent<HTMLDivElement>)=>{if(!drag.current.moved)return;event.preventDefault();event.stopPropagation();drag.current.moved=false};
  if(!items.length)return null;
  return <section className="shelf"><div className="shelf-title"><h2>{title}</h2>{controls&&<div className="shelf-controls">{more&&<Link href={more}>Бүгдийг үзэх</Link>}<button type="button" onClick={()=>move(-1)} aria-label="Өмнөх бүтээл">‹</button><button type="button" onClick={()=>move(1)} aria-label="Дараагийн бүтээл">›</button></div>}</div><div className="card-row" ref={row} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onClickCapture={stopDraggedClick}>{items.map(item=><Card item={item} isNew={markNew} key={item.id}/>)}</div></section>;
}

export default function Home(){
  const [items,setItems]=useState<CatalogItem[]>([]);const [recentIds,setRecentIds]=useState<string[]>([]);const [query,setQuery]=useState("");const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState(false);
  useEffect(()=>{let active=true;const initial=new URLSearchParams(window.location.search).get("q")??"";const cachedCatalog=peekCachedJson<{items:CatalogItem[]}>("catalog");const cachedHistory=peekCachedJson<{items:{contentId:string}[]}>("user-items:history");if(cachedCatalog){setItems(cachedCatalog.items||[]);setRecentIds((cachedHistory?.items||[]).map(entry=>entry.contentId));setQuery(initial);setLoading(false)}Promise.all([requestCachedJson<{items:CatalogItem[]}>("catalog","/api/catalog",300_000),requestCachedJson<{items:{contentId:string}[]}>("user-items:history","/api/app/user-items?kind=history",30_000)]).then(([catalogData,historyData])=>{if(!active)return;setQuery(initial);setItems(catalogData.items||[]);setRecentIds((historyData.items||[]).map(entry=>entry.contentId))}).catch(()=>{if(active&&!cachedCatalog)setLoadError(true)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const result=useMemo(()=>{const needle=query.toLowerCase();return items.filter(item=>`${item.title} ${item.originalTitle} ${item.genres.join(" ")}`.toLowerCase().includes(needle))},[items,query]);
  const orderedResult=useMemo(()=>[...result].sort((a,b)=>timestampMs(itemTimestamp(b))-timestampMs(itemTimestamp(a))),[result]);
  const anime=orderedResult.filter(item=>item.type==="anime");const manga=orderedResult.filter(item=>item.type!=="anime");const recent=recentIds.map(id=>items.find(item=>item.id===id)).filter((item):item is CatalogItem=>Boolean(item));
  const latest=useMemo(()=>orderedResult.filter(item=>{const total=item.type==="anime"?item.episodes:item.chapters;return Boolean(item.latestAt)&&typeof total==="number"&&total>0}).slice(0,6),[orderedResult]);
  return <Chrome searchValue={query} onSearchChange={setQuery}><main className="home-content">{loading?<ContentLoading rows={2}/>:loadError?<LoadError/>:<><Shelf title="Сүүлд нэмэгдсэн" items={latest} markNew controls={false}/><Shelf title="Хэнтаи" items={anime} more="/catalog?type=anime"/><Shelf title="Манхва" items={manga} more="/catalog?type=manga"/>{recent.length>0&&<div className="recent-home-section"><Shelf title="Сүүлд үзсэн" items={recent} more="/history"/></div>}{result.length===0&&<div className="empty"><strong>Илэрц олдсонгүй</strong><span>Өөр түлхүүр үгээр хайгаад үзээрэй.</span></div>}</>}</main></Chrome>;
}

function ContentLoading({rows=1}:{rows?:number}){return <div className="content-loading" role="status" aria-label="Бүтээлүүдийг ачаалж байна">{Array.from({length:rows},(_,row)=><section key={row}><i/><div>{Array.from({length:6},(_,card)=><span key={card}/>)}</div></section>)}</div>}
function LoadError(){return <div className="collection-empty error-state"><span>!</span><h2>Бүтээлүүд ачаалсангүй</h2><p>Холболтоо шалгаад дахин оролдоно уу.</p><button type="button" onClick={()=>window.location.reload()}>Дахин ачаалах</button></div>}
