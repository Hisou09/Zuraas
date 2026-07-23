import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AnimePlayer } from "../../../components/AnimePlayer";
import { ensureUser } from "../../../../db/auth";
import { database, ensureSchema } from "../../../../db/runtime";
import { timestampMs } from "../../../../db/datetime";

type EpisodeRow = { number:number; mediaKeys:string };

function firstMedia(value:string){
  try{return (JSON.parse(value||"[]") as string[])[0]||null}catch{return null}
}

export default async function WatchPage({params}:{params:Promise<{id:string;episode:string}>}){
  const {id,episode}=await params;
  const episodeNumber=Number(episode);
  if(!Number.isFinite(episodeNumber))redirect(`/title/${encodeURIComponent(id)}`);

  await ensureSchema();
  const incoming=await headers();
  const user=await ensureUser(new Request("https://zuraas.local",{headers:incoming}));
  const [contentResult,episodeResult,profileResult]=await database().batch([
    database().prepare("SELECT id,title,type,image,banner_image AS bannerImage FROM contents WHERE id=?").bind(id),
    database().prepare("SELECT number,media_keys AS mediaKeys FROM episodes WHERE content_id=? AND (publish_at IS NULL OR publish_at<=CURRENT_TIMESTAMP) ORDER BY number ASC").bind(id),
    database().prepare("SELECT vip_until AS vipUntil FROM users WHERE email=?").bind(user.email),
  ]);
  const content=contentResult.results[0] as {id:string;title:string;type:string;image:string;bannerImage:string}|undefined;
  if(!content||content.type!=="anime")redirect(`/title/${encodeURIComponent(id)}`);

  const profile=profileResult.results[0] as {vipUntil:unknown}|undefined;
  const vipUntil=timestampMs(profile?.vipUntil);
  if(user.role!=="admin"&&vipUntil<=Date.now())redirect("/vip");

  const episodes=episodeResult.results as unknown as EpisodeRow[];
  const currentIndex=episodes.findIndex(item=>Number(item.number)===episodeNumber);
  if(currentIndex<0)redirect(`/title/${encodeURIComponent(id)}`);
  const current=episodes[currentIndex];
  const media=firstMedia(current.mediaKeys);

  return <AnimePlayer
    contentId={content.id}
    title={content.title}
    episode={episodeNumber}
    videoUrl={media?`/api/app/media/${encodeURIComponent(media)}`:null}
    poster={content.bannerImage||content.image}
    episodes={episodes.map((item)=>({
      number:Number(item.number),
      href:`/watch/${encodeURIComponent(content.id)}/${item.number}`,
    }))}
  />;
}
