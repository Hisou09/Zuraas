import type { CSSProperties } from "react";
import { Chrome } from "../../components/Chrome";
import { EntryDirectory, type DetailEntry } from "../../components/EntryDirectory";
import { Comments, TitleActions } from "../../components/TitleInteractions";
import { catalog, type CatalogItem } from "../../data/catalog";
import { database, ensureSchema, ensureUser } from "../../../db/runtime";
import { headers } from "next/headers";

export function generateStaticParams(){return catalog.map(item=>({id:item.id}))}

type Episode=DetailEntry;
type Character={role:string;node:{id:number;name:{full:string};image:{large:string|null}}};
const mediaKeys=(value:string)=>{try{return JSON.parse(value||"[]") as string[]}catch{return []}};

export default async function TitlePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  let item:CatalogItem&{description?:string}=catalog.find(entry=>entry.id===id)??catalog[0];
  let savedEpisodes:Episode[]=[];
  let bannerImage=item.bannerImage||item.image;
  let characters:Character[]=[];
  let hasVip=false;
  try{
    await ensureSchema();
    const incoming=await headers();
    const user=await ensureUser(new Request("https://zuraas.local",{headers:incoming}));
    const profile=await database().prepare("SELECT vip_until AS vipUntil FROM users WHERE email=?").bind(user.email).first<{vipUntil:string|null}>();
    hasVip=Boolean(profile?.vipUntil&&new Date(`${profile.vipUntil.replace(" ","T")}Z`).getTime()>Date.now());
    const row=await database().prepare("SELECT id,title,type,status,year,episode_count AS count,rating,genres,image,banner_image AS bannerImage,characters,description FROM contents WHERE id=?").bind(id).first<Record<string,any>>();
    if(row){
      item={id:String(row.id),title:String(row.title),originalTitle:String(row.title),type:row.type as CatalogItem["type"],status:String(row.status),year:Number(row.year),rating:Number(row.rating),genres:String(row.genres).split(",").map(value=>value.trim()).filter(Boolean),image:String(row.image),description:String(row.description),...(row.type==="anime"?{episodes:Number(row.count)}:{chapters:Number(row.count)})};
      bannerImage=String(row.bannerImage||row.image);
      try{characters=JSON.parse(String(row.characters||"[]")) as Character[]}catch{characters=[]}
      const episodes=await database().prepare("SELECT id,number,access,publish_at AS publishAt,media_keys AS mediaKeys FROM episodes WHERE content_id=? AND (publish_at IS NULL OR publish_at<=CURRENT_TIMESTAMP) ORDER BY number DESC").bind(id).all();
      savedEpisodes=episodes.results as unknown as Episode[];
    }
  }catch{/* static catalog remains available */}

  const isAnime=item.type==="anime";
  const similar=catalog.filter(entry=>entry.type===item.type&&entry.id!==item.id).slice(0,7);
  const fallbackTotal=isAnime?Math.min(item.episodes??12,12):Math.min(item.chapters??12,12);
  const entries:Episode[]=savedEpisodes.length?savedEpisodes:Array.from({length:fallbackTotal},(_,index)=>({id:index+1,number:fallbackTotal-index,access:"registered",publishAt:null,mediaKeys:"[]"}));
  const firstEntry=[...entries].sort((a,b)=>a.number-b.number)[0];
  const firstVideo=isAnime&&firstEntry?mediaKeys(firstEntry.mediaKeys)[0]:null;
  const primaryHref=isAnime&&!hasVip?"/vip":isAnime?(firstVideo?`/api/app/media/${encodeURIComponent(firstVideo)}`:"#episodes"):(firstEntry?`/read/${item.id}/${firstEntry.number}`:"#chapters");
  const description=item.description||"Монгол орчуулгатай шинэ анги, бүлгүүд тогтмол нэмэгдэнэ.";

  return <Chrome><main className={`detail-page clean-detail ${isAnime?"anime-detail":"manga-detail"}`}>
    <section className="title-hero" style={{"--hero-image":`url(${bannerImage})`} as CSSProperties}>
      <div className="title-backdrop"/><div className="title-gradient"/>
      <div className="title-intro"><img src={item.image} alt={`${item.title} нүүр зураг`}/><div><span className="detail-kind">{isAnime?"АНИМЭ":"МАНГА"}</span><h1>{item.title}</h1><div className="mobile-title-meta"><span>{item.status}</span><span>{isAnime?`${item.episodes??entries.length} анги`:`${item.chapters??entries.length} бүлэг`}</span><span>{item.year||"—"}</span><span>{isAnime?"Анимэ":"Манга"}</span></div><p>{description}</p><div className="title-keywords">{item.genres.slice(0,8).map(genre=><span key={genre}>{genre}</span>)}</div><TitleActions contentId={item.id} primaryHref={primaryHref} contentType={isAnime?"anime":"manga"}/></div></div>
    </section>
    <div className="detail-columns clean-detail-columns">
      <section className="entries" id={isAnime?"episodes":"chapters"}>
        <EntryDirectory kind={isAnime?"anime":"manga"} contentId={item.id} cover={item.image} entries={entries} hasVip={hasVip}/>
      </section>
      <aside className="detail-side">
        <h2>Түлхүүр сэдэв</h2>
        <div className="info-box keyword-box"><small>ТӨРӨЛ</small><div>{item.genres.map(genre=><span key={genre}>{genre}</span>)}</div><small>ТӨЛӨВ</small><div><span>{item.status}</span><span>{isAnime?"Анимэ":"Манга"}</span></div></div>
      </aside>
    </div>
    <Comments contentId={item.id}/>
    {characters.length>0&&<section className="characters imported-characters"><div className="detail-heading character-heading"><div><small>БҮТЭЭЛИЙН</small><h2>Дүрүүд</h2></div><span>{characters.length}</span></div><div className="character-grid">{characters.slice(0,12).map(character=><article key={character.node.id}>{character.node.image.large?<img src={character.node.image.large} alt={character.node.name.full}/>:<span>{character.node.name.full.slice(0,1)}</span>}<div><b>{character.node.name.full}</b><small>{character.role==="MAIN"?"Гол дүр":character.role==="SUPPORTING"?"Туслах дүр":"Дүр"}</small></div></article>)}</div></section>}
    <section className="more-like"><div className="detail-heading"><h2>Төстэй бүтээлүүд</h2></div><div className="mini-row">{similar.map(entry=><a href={`/title/${entry.id}`} key={entry.id}><img src={entry.image} alt=""/><b>{entry.title}</b></a>)}</div></section>
  </main></Chrome>;
}
