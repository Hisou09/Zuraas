"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, Funnel, Search } from "lucide-react";
import { Chrome } from "../components/Chrome";
import type { CatalogItem } from "../data/catalog";
import { peekCachedJson,requestCachedJson } from "../data/client-cache";

function CatalogCard({item}:{item:CatalogItem}){const total=item.type==="anime"?item.episodes:item.chapters;const count=typeof total==="number"&&total>0?`${total} ${item.type==="anime"?"АНГИ":"БҮЛЭГ"}`:null;return <Link className="catalog-card" href={`/title/${item.id}`} prefetch={false} aria-label={`${item.title} дэлгэрэнгүй`}><div className="catalog-poster"><img src={item.image} alt={`${item.title} нүүр зураг`} loading="lazy"/>{count&&<small className="catalog-count">{count}</small>}</div><div><h2>{item.title}</h2></div></Link>}
function FilterSelect({id,label,value,options,open,onToggle,onChange}:{id:string;label:string;value:string;options:{value:string;label:string}[];open:boolean;onToggle:(id:string|null)=>void;onChange:(value:string)=>void}){const selected=options.find(option=>option.value===value)?.label||options[0]?.label;return <div className="catalog-filter"><small>{label}</small><div className={`catalog-filter-menu ${open?"open":""}`}><button className="catalog-filter-trigger" type="button" aria-expanded={open} onClick={()=>onToggle(open?null:id)}><span>{selected}</span><ChevronDown size={16}/></button>{open&&<div className="catalog-filter-options">{options.map(option=><button type="button" className={value===option.value?"active":""} key={option.value} onClick={()=>{onChange(option.value);onToggle(null)}}><span>{option.label}</span>{value===option.value&&<Check size={15}/>}</button>)}</div>}</div></div>}

export default function CatalogPage(){
  const searchParams=useSearchParams();
  const requestedType=searchParams.get("type");
  const [items,setItems]=useState<CatalogItem[]>([]);const [query,setQuery]=useState("");const [type,setType]=useState("all");const [genre,setGenre]=useState("all");const [status,setStatus]=useState("all");const [sort,setSort]=useState("newest");const [openFilter,setOpenFilter]=useState<string|null>(null);const [filtersOpen,setFiltersOpen]=useState(false);const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState(false);
  useLayoutEffect(()=>{
    setType(requestedType==="anime"||requestedType==="manga"?requestedType:"all");
    setOpenFilter(null);
    setFiltersOpen(false);
    // Query-only navigation reuses this page, so Next can preserve the old
    // mobile scroll offset. Reset before paint to keep the search panel fixed
    // at the intended top padding instead of visibly jumping upward.
    window.scrollTo({top:0,left:0,behavior:"instant"});
  },[requestedType]);
  useEffect(()=>{let active=true;const cached=peekCachedJson<{items:CatalogItem[]}>("catalog");if(cached){setItems(Array.isArray(cached.items)?cached.items:[]);setLoading(false)}requestCachedJson<{items:CatalogItem[]}>("catalog","/api/catalog",300_000).then(data=>{if(!active)return;setItems(Array.isArray(data.items)?data.items:[])}).catch(()=>{if(active&&!cached)setLoadError(true)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const genres=useMemo(()=>Array.from(new Set(items.flatMap(item=>item.genres))).sort(),[items]);
  const filtered=useMemo(()=>{const needle=query.toLowerCase();const result=items.filter(item=>(!needle||`${item.title} ${item.originalTitle}`.toLowerCase().includes(needle))&&(type==="all"||(type==="manga"?item.type!=="anime":item.type===type))&&(genre==="all"||item.genres.includes(genre))&&(status==="all"||item.status.toLowerCase()===status.toLowerCase()));return result.sort((a,b)=>sort==="rating"?b.rating-a.rating:sort==="title"?a.title.localeCompare(b.title):b.year-a.year)},[items,query,type,genre,status,sort]);
  return <Chrome searchValue={query} onSearchChange={setQuery}><main className="catalog-page" onClick={event=>{if(event.target===event.currentTarget)setOpenFilter(null)}}><section className="catalog-filter-panel"><div className="catalog-search-row"><label className="catalog-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`${type==="anime"?"Хэнтаи":type==="manga"?"Манхва":"Бүтээл"} хайх...`}/></label><button className={`mobile-filter-toggle ${filtersOpen?"active":""}`} type="button" onClick={()=>setFiltersOpen(value=>!value)} aria-label="Шүүлтүүр"><Funnel size={20}/></button></div><div className={`catalog-filters ${filtersOpen?"mobile-open":""}`}><FilterSelect id="type" label="АНГИЛАЛ" value={type} open={openFilter==="type"} onToggle={setOpenFilter} onChange={setType} options={[{value:"all",label:"Бүгд"},{value:"anime",label:"Хэнтаи"},{value:"manga",label:"Манхва"}]}/><FilterSelect id="genre" label="ТӨРӨЛ" value={genre} open={openFilter==="genre"} onToggle={setOpenFilter} onChange={setGenre} options={[{value:"all",label:"Бүгд"},...genres.map(value=>({value,label:value}))]}/><FilterSelect id="status" label="ТӨЛӨВ" value={status} open={openFilter==="status"} onToggle={setOpenFilter} onChange={setStatus} options={[{value:"all",label:"Бүгд"},{value:"Ongoing",label:"Ongoing"},{value:"Completed",label:"Completed"},{value:"Hiatus",label:"Hiatus"}]}/><FilterSelect id="sort" label="ЭРЭМБЭ" value={sort} open={openFilter==="sort"} onToggle={setOpenFilter} onChange={setSort} options={[{value:"newest",label:"Шинээр нэмэгдсэн"},{value:"rating",label:"Үнэлгээ өндөр"},{value:"title",label:"Нэрээр"}]}/></div></section>{loading?<CatalogLoading/>:loadError?<div className="collection-empty error-state"><span>!</span><h2>Каталог ачаалсангүй</h2><p>Холболтоо шалгаад хуудсыг дахин ачаална уу.</p><button type="button" onClick={()=>window.location.reload()}>Дахин ачаалах</button></div>:filtered.length?<div className="catalog-grid">{filtered.map(item=><CatalogCard item={item} key={item.id}/>)}</div>:<div className="collection-empty"><span>⌕</span><h2>Бүтээл олдсонгүй</h2><p>Шүүлтүүрээ өөрчлөөд дахин оролдоно уу.</p></div>}</main></Chrome>;
}

function CatalogLoading(){return <div className="catalog-loading" role="status" aria-label="Каталог ачаалж байна">{Array.from({length:12},(_,index)=><span key={index}/>)}</div>}
