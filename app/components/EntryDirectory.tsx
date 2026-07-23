"use client";

import { ArrowDown, ArrowRight, ArrowUp, BookOpen, CheckCircle2, Crown, Play, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { requestCachedJson } from "../data/client-cache";

export type DetailEntry = {
  id: number;
  number: number;
  access: string;
  publishAt: string | Date | null;
  createdAt: string | Date | null;
  mediaKeys: string;
};

type ReadEntriesResponse = {
  entries: { entryNumber: number }[];
};

function keys(value: string) {
  try { return JSON.parse(value || "[]") as string[]; } catch { return []; }
}

function parseDate(value: string | Date | null) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const normalized = String(value).replace(" ", "T");
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value: string | Date | null) {
  const date = parseDate(value);
  if (!date) return "Огноо тохируулаагүй";
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ulaanbaatar",
  }).format(date);
}

function relativeDate(value: string | Date | null, now: number | null) {
  const date = parseDate(value);
  if (!date) return "Огноо тохируулаагүй";
  if (now === null) return "Саяхан";

  const elapsed = Math.max(0, now - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Дөнгөж сая";
  if (minutes < 60) return `${minutes} минутын өмнө`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} хоногийн өмнө`;

  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} долоо хоногийн өмнө`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} сарын өмнө`;
  return `${Math.floor(months / 12)} жилийн өмнө`;
}

function dateTimeValue(value: string | Date | null) {
  return parseDate(value)?.toISOString();
}

export function EntryDirectory({
  kind,
  contentId,
  cover,
  entries,
  hasVip,
}: {
  kind: "anime" | "manga";
  contentId: string;
  cover: string;
  entries: DetailEntry[];
  hasVip: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [now, setNow] = useState<number | null>(null);
  const [readEntries, setReadEntries] = useState<Set<number>>(() => new Set());
  const readsCacheKey = `entry-reads:${contentId}`;
  useEffect(() => {
    if (kind !== "manga") return;
    let active = true;
    void requestCachedJson<ReadEntriesResponse>(
      readsCacheKey,
      `/api/app/entry-reads?contentId=${encodeURIComponent(contentId)}`,
      30_000,
    ).then((data) => {
      if (active) setReadEntries(new Set(data.entries.map((entry) => Number(entry.entryNumber))));
    }).catch(() => {
      if (active) setReadEntries(new Set());
    });
    return () => { active = false; };
  }, [contentId, kind, readsCacheKey]);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("mn");
    return entries
      .filter((entry) => !search || `${kind === "anime" ? "анги" : "бүлэг"} ${entry.number}`.includes(search))
      .sort((a, b) => order === "newest" ? b.number - a.number : a.number - b.number);
  }, [entries, kind, order, query]);

  const noun = kind === "anime" ? "Анги" : "Бүлэг";
  return <div className="entry-directory">
    <header className="entry-directory-head"><div><h2>{kind === "anime" ? "АНГИУД" : "БҮЛГҮҮД"}</h2></div></header>
    <div className="entry-toolbar">
      <label><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${noun} хайх...`}/></label>
      <button type="button" onClick={() => setOrder((value) => value === "newest" ? "oldest" : "newest")} aria-label={order === "newest" ? "Хуучнаас шинэ рүү эрэмбэлэх" : "Шинээс хуучин руу эрэмбэлэх"}>{order === "newest" ? <ArrowDown size={17}/> : <ArrowUp size={17}/>}<span>{order === "newest" ? "Шинэ эхэнд" : "Хуучин эхэнд"}</span></button>
    </div>
    <div className={`entry-list ${kind}`}>
      {visible.map((entry) => {
        const media = keys(entry.mediaKeys)[0];
        const isRead = kind === "manga" && readEntries.has(entry.number);
        const locked = kind === "anime" ? !hasVip : entry.access === "vip" && !hasVip;
        const href = locked ? "/vip" : kind === "anime" ? (media ? `/watch/${encodeURIComponent(contentId)}/${entry.number}` : "#episodes") : `/read/${contentId}/${entry.number}`;
        return <a href={href} key={entry.id} className={isRead ? "is-read" : undefined} onClick={(event)=>{
          if(locked){
            if(kind==="manga"&&window.matchMedia("(max-width: 720px)").matches){
              event.preventDefault();
              window.sessionStorage.setItem("zuraas-previous-route",`${window.location.pathname}${window.location.search}${window.location.hash}`);
              window.dispatchEvent(new CustomEvent("zuraas-settings-tab",{detail:"vip"}));
              router.push("/settings?tab=vip#vip-status");
            }
            return;
          }
        }}>
          {kind === "anime" && <span className="entry-cover"><img src={cover} alt=""/><i><Play size={15}/></i></span>}
          <span className="entry-number">{entry.number}</span>
          <span className="entry-copy"><b>{noun} {entry.number}</b><span className="entry-copy-meta"><time dateTime={dateTimeValue(entry.publishAt||entry.createdAt)} title={displayDate(entry.publishAt||entry.createdAt)}>{relativeDate(entry.publishAt||entry.createdAt, now)}</time>{isRead&&<em className="entry-read-state"><CheckCircle2 size={12}/><span>Уншсан</span></em>}</span></span>
          <span className={`entry-access ${entry.access === "vip" || kind === "anime" ? "vip" : ""}`}>
            {entry.access === "vip" || kind === "anime"
              ? <><Crown size={13}/><span>VIP</span></>
              : <><BookOpen size={13}/><span>Үнэгүй</span></>}
          </span>
          <ArrowRight className="entry-arrow" size={18}/>
        </a>;
      })}
      {!visible.length && <div className="entry-empty">
        <span>{kind === "anime" ? <Play size={22}/> : <BookOpen size={22}/>}</span>
        <b>{query ? `Хайлтад тохирох ${noun.toLocaleLowerCase("mn")} олдсонгүй` : `${noun} одоогоор нэмэгдээгүй байна`}</b>
        <p>{query ? "Хайлтын үгээ өөрчлөөд дахин оролдоно уу." : `Шинэ ${noun.toLocaleLowerCase("mn")} нэмэгдэхэд энд харагдана.`}</p>
      </div>}
    </div>
  </div>;
}
