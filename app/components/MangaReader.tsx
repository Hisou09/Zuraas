"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { AlertTriangle, ArrowLeft, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Expand, List, PanelTop, Settings, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { invalidateCachedJson } from "../data/client-cache";

type ReadingMode="vertical"|"paged";
type Drawer="chapters"|"settings"|null;
const issueTypes=["Зураг ачаалахгүй байна","Зургууд дутуу / Дараалал алдагдсан","Буруу бүлэг орсон байна","Орчуулга эсвэл текстийн алдаатай","Бусад асуудал"];

export function MangaReader({contentId,title,chapter,chapters,pages,locked}:{contentId:string;title:string;chapter:number;chapters:number[];pages:string[];locked:boolean}){
  const router=useRouter();
  const [controls,setControls]=useState(true);const [drawer,setDrawer]=useState<Drawer>(null);const [mode,setMode]=useState<ReadingMode>("vertical");const [pageIndex,setPageIndex]=useState(0);const [reportOpen,setReportOpen]=useState(false);const [reportState,setReportState]=useState<"idle"|"sending"|"sent">("idle");const lastScroll=useRef(0);const pagesRef=useRef<HTMLElement|null>(null);
  const chapterIndex=chapters.indexOf(chapter);const newer=chapterIndex>0?chapters[chapterIndex-1]:null;const older=chapterIndex>=0&&chapterIndex<chapters.length-1?chapters[chapterIndex+1]:null;
  const pageLabel=useMemo(()=>`${Math.min(pageIndex+1,pages.length||1)} / ${pages.length||1}`,[pageIndex,pages.length]);
  useEffect(()=>{
    const requested=Math.max(0,Math.floor(Number(new URLSearchParams(window.location.search).get("page"))||0));
    const restored=Math.min(requested,Math.max(0,pages.length-1));
    setPageIndex(restored);
    if(restored===0){window.scrollTo({top:0,behavior:"auto"});return}
    const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>pagesRef.current?.querySelector<HTMLElement>(`[data-reader-page="${restored}"]`)?.scrollIntoView({block:"start",behavior:"auto"})));
    return()=>cancelAnimationFrame(frame);
  },[chapter,pages.length]);
  useEffect(()=>{const saved=localStorage.getItem("zuraas-reader-mode");if(saved==="paged"||saved==="vertical")setMode(saved);document.title=`${title} · Бүлэг ${chapter}`;fetch("/api/app/history",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contentId,progress:chapter})}).then(response=>{if(response.ok){invalidateCachedJson("user-items:history");invalidateCachedJson("user-items:library");invalidateCachedJson(`entry-reads:${contentId}`)}}).catch(()=>null)},[contentId,title,chapter]);
  useEffect(()=>{const onScroll=()=>{const current=window.scrollY;if(Math.abs(current-lastScroll.current)>10){setControls(current<lastScroll.current||current<30);lastScroll.current=current}};window.addEventListener("scroll",onScroll,{passive:true});return()=>window.removeEventListener("scroll",onScroll)},[]);
  useEffect(()=>{
    if(locked||pages.length===0)return;
    const timer=window.setTimeout(()=>fetch("/api/app/history-position",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contentId,progress:chapter,pageIndex}),keepalive:true}).then(response=>{if(response.ok){invalidateCachedJson("user-items:history");invalidateCachedJson("user-items:library")}}).catch(()=>null),500);
    return()=>window.clearTimeout(timer);
  },[contentId,chapter,pageIndex,pages.length,locked]);
  useEffect(()=>{
    if(mode!=="vertical"||locked||pages.length===0||!pagesRef.current)return;
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      const index=Number((visible?.target as HTMLElement|undefined)?.dataset.readerPage);
      if(Number.isInteger(index))setPageIndex(index);
    },{threshold:[0.25,0.5,0.75],rootMargin:"-12% 0px -55% 0px"});
    pagesRef.current.querySelectorAll<HTMLElement>("[data-reader-page]").forEach(element=>observer.observe(element));
    return()=>observer.disconnect();
  },[mode,chapter,pages.length,locked]);
  useEffect(()=>{if(drawer!=="chapters")return;const input=document.querySelector<HTMLInputElement>(".reader-chapter-list input");if(!input)return;const filter=()=>{const query=input.value.trim().toLowerCase();document.querySelectorAll<HTMLElement>(".reader-chapter-list>button").forEach(button=>{button.hidden=Boolean(query&&!button.textContent?.toLowerCase().includes(query))})};input.addEventListener("input",filter);return()=>input.removeEventListener("input",filter)},[drawer]);
  const setReadingMode=(value:ReadingMode)=>{setMode(value);localStorage.setItem("zuraas-reader-mode",value);setPageIndex(0);window.scrollTo({top:0})};
  const detailHref=`/title/${contentId}`;
  const leaveReader=()=>{const previous=window.sessionStorage.getItem("zuraas-previous-route");if(previous===detailHref)router.back();else router.replace(detailHref)};
  const goChapter=(value:number|null)=>{if(value!==null)router.replace(`/read/${contentId}/${value}`)};
  const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{/* Browser may block fullscreen. */}};
  const readerClick=(event:MouseEvent<HTMLElement>)=>{if(mode==="vertical"){setControls(value=>!value);return}const ratio=event.clientX/window.innerWidth;if(ratio<.35)setPageIndex(value=>Math.max(0,value-1));else if(ratio>.65)setPageIndex(value=>Math.min(pages.length-1,value+1));else setControls(value=>!value)};
  const submitReport=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setReportState("sending");const form=new FormData(event.currentTarget);const response=await fetch("/api/app/reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contentId,chapterNumber:chapter,issueType:form.get("issueType"),details:form.get("details")})});if(response.ok){setReportState("sent");setTimeout(()=>{setReportOpen(false);setReportState("idle")},1100)}else setReportState("idle")};
  return <main className={`manga-reader mode-${mode} ${controls?"controls-visible":"controls-hidden"}`}>
    <header className="reader-topbar"><button className="reader-icon-button reader-back" type="button" onClick={leaveReader} aria-label="Буцах"><ArrowLeft size={21}/></button><div className="reader-title"><b>{title}</b><small>БҮЛЭГ {chapter}</small></div><div className="reader-chapter-control"><button disabled={older===null} onClick={()=>goChapter(older)} aria-label="Өмнөх бүлэг"><ChevronLeft size={18}/></button><button className="chapter-current" onClick={()=>setDrawer(drawer==="chapters"?null:"chapters")}><span><small>БҮЛЭГ</small><b>{chapter}</b></span><List size={17}/><ChevronDown size={14}/></button><button disabled={newer===null} onClick={()=>goChapter(newer)} aria-label="Дараагийн бүлэг"><ChevronRight size={18}/></button></div><div className="reader-actions"><button onClick={()=>setReportOpen(true)} aria-label="Алдаа мэдэгдэх" title="Алдаа мэдэгдэх"><AlertTriangle size={20}/></button><button onClick={()=>setDrawer(drawer==="settings"?null:"settings")} aria-label="Унших тохиргоо"><Settings size={20}/></button><button onClick={toggleFullscreen} aria-label="Дэлгэц дүүргэх"><Expand size={20}/></button></div>
    </header>
    {locked?<section className="reader-locked"><span><BookOpen size={35}/></span><h1>VIP бүлэг</h1><p>Энэ бүлгийг уншихын тулд VIP эрх шаардлагатай.</p><a href="/vip">VIP эрх авах</a></section>:pages.length?<section className="reader-pages" ref={pagesRef} onClick={readerClick}>{mode==="vertical"?<>{pages.map((src,index)=><img src={src} alt={`Бүлэг ${chapter} · Хуудас ${index+1}`} key={`${src}-${index}`} data-reader-page={index} draggable={false}/>) }<ReaderEndNavigation chapter={chapter} nextChapter={newer} onBack={leaveReader} onNext={goChapter}/></>:<><div className="reader-paged-stage" data-reader-page={pageIndex}><img src={pages[pageIndex]} alt={`Бүлэг ${chapter} · Хуудас ${pageIndex+1}`} draggable={false}/><button className="page-hit previous" onClick={event=>{event.stopPropagation();setPageIndex(value=>Math.max(0,value-1))}} disabled={pageIndex===0} aria-label="Өмнөх хуудас"><ChevronLeft/></button><button className="page-hit next" onClick={event=>{event.stopPropagation();setPageIndex(value=>Math.min(pages.length-1,value+1))}} disabled={pageIndex===pages.length-1} aria-label="Дараагийн хуудас"><ChevronRight/></button><span className="page-counter">{pageLabel}</span></div>{pageIndex===pages.length-1&&<ReaderEndNavigation chapter={chapter} nextChapter={newer} onBack={leaveReader} onNext={goChapter}/>}</>}</section>:<section className="reader-locked"><span><BookOpen size={35}/></span><h1>Зураг ороогүй байна</h1><p>Энэ бүлгийн хуудсууд удахгүй нэмэгдэнэ.</p><button onClick={()=>setReportOpen(true)}>Алдаа мэдэгдэх</button></section>}
    {drawer&&<button className="reader-drawer-backdrop" aria-label="Цэс хаах" onClick={()=>setDrawer(null)}/>}<aside className={`reader-drawer ${drawer?"open":""}`}><header><div><h2>{drawer==="chapters"?"БҮЛГҮҮД":"ТОХИРГОО"}</h2><small>{drawer==="chapters"?`НИЙТ ${chapters.length}`:"УНШИХ ОРЧИН"}</small></div><button onClick={()=>setDrawer(null)} aria-label="Хаах"><X size={20}/></button></header>{drawer==="chapters"?<div className="reader-chapter-list"><label><List size={17}/><input placeholder="Дугаар эсвэл нэрээр хайх..."/></label>{chapters.map(value=><button className={value===chapter?"active":""} onClick={()=>goChapter(value)} key={value}><b>Бүлэг {value}</b>{value===chapter&&<span><Check size={15}/></span>}</button>)}</div>:<div className="reader-settings"><section><small>УНШИХ ХЭЛБЭР</small><div className="reader-mode-options"><button className={mode==="vertical"?"active":""} onClick={()=>setReadingMode("vertical")}><PanelTop size={21}/><span><b>Босоо</b><small>Доош гүйлгэж унших</small></span>{mode==="vertical"&&<Check size={17}/>}</button><button className={mode==="paged"?"active":""} onClick={()=>setReadingMode("paged")}><BookOpen size={21}/><span><b>Хуудсаар</b><small>Нэг нэг хуудсаар</small></span>{mode==="paged"&&<Check size={17}/>}</button></div></section></div>}</aside>
    {reportOpen&&<div className="reader-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setReportOpen(false)}}><form className="reader-report-modal" onSubmit={submitReport}><header><AlertTriangle size={20}/><h2>АЛДАА МЭДЭЭЛЭХ</h2><button type="button" onClick={()=>setReportOpen(false)}><X size={18}/></button></header>{reportState==="sent"?<div className="report-sent"><span><Check size={25}/></span><b>Мэдээлэл илгээгдлээ</b><p>Бид удахгүй шалгаж засах болно.</p></div>:<><fieldset><legend>АЛДААНЫ ТӨРӨЛ</legend>{issueTypes.map((type,index)=><label key={type}><input type="radio" name="issueType" value={type} defaultChecked={index===0}/><span>{type}</span></label>)}</fieldset><label className="report-details">ДЭЛГЭРЭНГҮЙ ТАЙЛБАР<textarea name="details" placeholder="Алдааны талаар нэмэлт тайлбар бичнэ үү..."/></label><footer><button type="button" onClick={()=>setReportOpen(false)}>Цуцлах</button><button disabled={reportState==="sending"}>{reportState==="sending"?"Илгээж байна...":"Илгээх"}</button></footer></>}</form></div>}
  </main>;
}

function ReaderEndNavigation({chapter,nextChapter,onBack,onNext}:{chapter:number;nextChapter:number|null;onBack:()=>void;onNext:(value:number|null)=>void}){
  return <section className="reader-end-navigation" onClick={event=>event.stopPropagation()}>
    <div className="reader-end-copy"><span><Check size={21}/></span><div><small>БҮЛЭГ {chapter}</small><b>Бүлэг дууслаа</b></div></div>
    <div className={`reader-end-actions ${nextChapter===null?"only-back":""}`}>
      <button type="button" onClick={onBack}><ArrowLeft size={18}/><span>Буцах</span></button>
      {nextChapter!==null&&<button type="button" className="next-chapter" onClick={()=>onNext(nextChapter)}><span><small>ДАРААГИЙН БҮЛЭГ</small><b>Бүлэг {nextChapter}</b></span><ChevronRight size={20}/></button>}
    </div>
  </section>;
}
