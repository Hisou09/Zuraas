"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { Chrome } from "./components/Chrome";
import type { CatalogItem } from "./data/catalog";

function Card({item}:{item:CatalogItem}){const count=item.type==="anime"?`${item.episodes??0} анги`:`${item.chapters??0} бүлэг`;return <a className="card" href={`/title/${item.id}`}><div className="cover"><img src={item.image} alt={`${item.title} cover`} loading="lazy" draggable={false}/><span>▶</span></div><h3>{item.title}</h3><div className="badges"><span>{item.status}</span><small>{count}</small></div></a>}
function Shelf({title,items,more}:{title:string;items:CatalogItem[];more?:string}){
  const row=useRef<HTMLDivElement>(null);const drag=useRef({active:false,startX:0,scrollLeft:0,moved:false});
  const move=(direction:number)=>{const container=row.current;if(!container)return;const card=container.querySelector<HTMLElement>(".card");const gap=parseFloat(getComputedStyle(container).columnGap)||12;container.scrollBy({left:direction*((card?.offsetWidth||container.clientWidth)+gap),behavior:"smooth"})};
  const pointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{if(event.pointerType==="mouse"&&event.button!==0)return;const container=row.current;if(!container)return;drag.current={active:true,startX:event.clientX,scrollLeft:container.scrollLeft,moved:false};container.setPointerCapture(event.pointerId);container.classList.add("dragging")};
  const pointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{const container=row.current;if(!container||!drag.current.active)return;const distance=event.clientX-drag.current.startX;if(Math.abs(distance)>5)drag.current.moved=true;container.scrollLeft=drag.current.scrollLeft-distance};
  const pointerEnd=(event:ReactPointerEvent<HTMLDivElement>)=>{const container=row.current;if(!container)return;drag.current.active=false;if(container.hasPointerCapture(event.pointerId))container.releasePointerCapture(event.pointerId);container.classList.remove("dragging")};
  const stopDraggedClick=(event:ReactMouseEvent<HTMLDivElement>)=>{if(!drag.current.moved)return;event.preventDefault();event.stopPropagation();drag.current.moved=false};
  return <section className="shelf"><div className="shelf-title"><h2>{title}</h2><div className="shelf-controls">{more&&<a href={more}>Бүгдийг үзэх</a>}<button onClick={()=>move(-1)} aria-label="Өмнөх">‹</button><button onClick={()=>move(1)} aria-label="Дараах">›</button></div></div><div className="card-row" ref={row} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onClickCapture={stopDraggedClick}>{items.map(item=><Card item={item} key={item.id}/>)}</div></section>
}

export default function Home(){
  const [items,setItems]=useState<CatalogItem[]>([]);const [recentIds,setRecentIds]=useState<string[]>([]);const [query,setQuery]=useState("");
  useEffect(()=>{const initial=new URLSearchParams(window.location.search).get("q")??"";setQuery(initial);Promise.all([fetch("/api/catalog").then(r=>r.json()),fetch("/api/app/user-items?kind=history").then(r=>r.ok?r.json():{items:[]})]).then(([catalogData,historyData])=>{setItems(catalogData.items||[]);setRecentIds((historyData.items||[]).map((entry:{contentId:string})=>entry.contentId))}).catch(()=>setItems([]))},[]);
  const result=useMemo(()=>{const needle=query.toLowerCase();return items.filter(item=>`${item.title} ${item.originalTitle} ${item.genres.join(" ")}`.toLowerCase().includes(needle))},[items,query]);
  const anime=result.filter(item=>item.type==="anime");const manga=result.filter(item=>item.type!=="anime");const recent=recentIds.map(id=>items.find(item=>item.id===id)).filter((item):item is CatalogItem=>Boolean(item));
  return <Chrome searchValue={query} onSearchChange={setQuery}><main className="home-content"><Shelf title="Анимэ" items={anime} more="/catalog?type=anime"/><Shelf title="Манга" items={manga} more="/catalog?type=manga"/>{recent.length>0&&<div className="recent-home-section"><Shelf title="Сүүлд үзсэн" items={recent} more="/history"/></div>}{result.length===0&&<div className="empty"><strong>Илэрц олдсонгүй</strong><span>Өөр түлхүүр үгээр хайгаад үзээрэй.</span></div>}</main></Chrome>;
}
