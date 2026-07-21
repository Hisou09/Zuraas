import { MangaReader } from "../../../components/MangaReader";
import { catalog } from "../../../data/catalog";
import { database, ensureSchema, ensureUser } from "../../../../db/runtime";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type ReaderEpisode={id:number;number:number;access:string;mediaKeys:string};

export default async function ReaderPage({params}:{params:Promise<{id:string;chapter:string}>}){
  const {id,chapter}=await params;
  const chapterNumber=Number(chapter);
  let title=catalog.find(item=>item.id===id)?.title||"Манга";
  let cover=catalog.find(item=>item.id===id)?.image||"";
  let chapters:number[]=[];
  let pages:string[]=[];
  let locked=false;
  try{
    await ensureSchema();
    const [content,episodeRows]=await database().batch([
      database().prepare("SELECT title,image,type FROM contents WHERE id=?").bind(id),
      database().prepare("SELECT id,number,access,media_keys AS mediaKeys FROM episodes WHERE content_id=? AND (publish_at IS NULL OR publish_at<=CURRENT_TIMESTAMP) ORDER BY number DESC").bind(id),
    ]);
    const saved=content.results[0] as {title?:string;image?:string;type?:string}|undefined;
    if(saved){title=String(saved.title||title);cover=String(saved.image||cover)}
    const episodes=episodeRows.results as unknown as ReaderEpisode[];
    chapters=episodes.map(ep=>Number(ep.number));
    const current=episodes.find(ep=>Number(ep.number)===chapterNumber);
    if(current){
      const incoming=await headers();
      const user=await ensureUser(new Request("https://zuraas.local",{headers:incoming}));
      const profile=await database().prepare("SELECT vip_until AS vipUntil FROM users WHERE email=?").bind(user.email).first<{vipUntil:string|null}>();
      const vipUntil=profile?.vipUntil?new Date(`${profile.vipUntil.replace(" ","T")}Z`).getTime():0;
      locked=current.access==="vip"&&vipUntil<=Date.now();
      if(!locked)pages=(JSON.parse(current.mediaKeys||"[]") as string[]).map(key=>`/api/app/media/${encodeURIComponent(key)}`);
    }
  }catch{/* Static catalog preview remains available. */}
  if(locked)redirect("/vip");
  const staticItem=catalog.find(item=>item.id===id);
  if(!chapters.length)chapters=Array.from({length:Math.min(staticItem?.chapters||12,12)},(_,index)=>index+1).reverse();
  if(!pages.length&&!locked&&cover)pages=[cover];
  return <MangaReader contentId={id} title={title} chapter={chapterNumber} chapters={chapters} pages={pages} locked={locked}/>;
}
