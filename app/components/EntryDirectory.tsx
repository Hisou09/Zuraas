"use client";

import { ArrowRight, ArrowUpDown, Crown, Play, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type DetailEntry = {
  id: number;
  number: number;
  access: string;
  publishAt: string | null;
  mediaKeys: string;
};

function keys(value: string) {
  try { return JSON.parse(value || "[]") as string[]; } catch { return []; }
}

function displayDate(value: string | null) {
  if (!value) return "Огноо тохируулаагүй";
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  if (Number.isNaN(date.getTime())) return "Огноо тохируулаагүй";
  return new Intl.DateTimeFormat("mn-MN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("mn");
    return entries
      .filter((entry) => !search || `${kind === "anime" ? "анги" : "бүлэг"} ${entry.number}`.includes(search))
      .sort((a, b) => order === "newest" ? b.number - a.number : a.number - b.number);
  }, [entries, kind, order, query]);

  const noun = kind === "anime" ? "Анги" : "Бүлэг";
  return <div className="entry-directory">
    <header className="entry-directory-head">
      <span>{kind === "anime" ? "ҮЗЭХ" : "УНШИХ"}</span>
      <div><h2>{kind === "anime" ? "АНГИУД" : "БҮЛГҮҮД"}</h2><b>{entries.length}</b></div>
    </header>
    <div className="entry-toolbar">
      <label><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${noun} хайх...`}/></label>
      <button type="button" onClick={() => setOrder((value) => value === "newest" ? "oldest" : "newest")} aria-label="Дараалал солих"><ArrowUpDown size={17}/>{order === "newest" ? "Шинэ" : "Хуучин"}</button>
    </div>
    <div className={`entry-list ${kind}`}>
      {visible.map((entry) => {
        const media = keys(entry.mediaKeys)[0];
        const locked = kind === "anime" ? !hasVip : entry.access === "vip" && !hasVip;
        const href = locked ? "/vip" : kind === "anime" ? (media ? `/api/app/media/${encodeURIComponent(media)}` : "#episodes") : `/read/${contentId}/${entry.number}`;
        return <a href={href} key={entry.id}>
          {kind === "anime" && <span className="entry-cover"><img src={cover} alt=""/><i><Play size={15}/></i></span>}
          <span className="entry-number">{entry.number}</span>
          <span className="entry-copy"><b>{noun} {entry.number}</b><time>{displayDate(entry.publishAt)}</time></span>
          <span className={`entry-access ${entry.access === "vip" || kind === "anime" ? "vip" : ""}`}>{entry.access === "vip" || kind === "anime" ? <><Crown size={13}/> VIP</> : "Бүртгэлтэй"}</span>
          <ArrowRight className="entry-arrow" size={18}/>
        </a>;
      })}
      {!visible.length && <div className="entry-empty">Хайлтад тохирох {noun.toLocaleLowerCase("mn")} олдсонгүй.</div>}
    </div>
  </div>;
}
