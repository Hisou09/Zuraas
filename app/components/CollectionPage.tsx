"use client";

import { useEffect, useState } from "react";
import { Chrome } from "./Chrome";
import { catalog, type CatalogItem } from "../data/catalog";

export function CollectionPage({ kind }: { kind: "history" | "library" }) {
  const [records, setRecords] = useState<{ contentId: string; progress?: number; date: string }[]>([]);
  useEffect(() => { fetch(`/api/app/user-items?kind=${kind}`).then((r) => r.json()).then((data) => setRecords(data.items || [])).catch(() => setRecords([])); }, [kind]);
  const items = records.map((record) => ({ record, item: catalog.find((entry) => entry.id === record.contentId) })).filter((entry): entry is { record: typeof records[number]; item: CatalogItem } => Boolean(entry.item));
  const remove = async (id: string) => { if (kind === "library") await fetch(`/api/app/library?contentId=${id}`, { method: "DELETE" }); setRecords((current) => current.filter((entry) => entry.contentId !== id)); };
  return <Chrome><main className="collection-page"><div className="page-heading"><div><small>МИНИЙ САН</small><h1>{kind === "history" ? "Сүүлд үзсэн" : "Хадгалсан бүтээлүүд"}</h1><p>{kind === "history" ? "Үзэж, уншиж эхэлсэн бүтээлүүдээ үргэлжлүүлээрэй." : "Дараа үзэхээр хадгалсан анимэ, манганууд."}</p></div><span>{items.length}</span></div>{items.length ? <div className="collection-grid">{items.map(({ item, record }) => <article key={item.id}><a href={`/title/${item.id}`}><img src={item.image} alt="" /><div><small>{item.type === "anime" ? "ANIME" : "MANGA"}</small><h2>{item.title}</h2><p>{kind === "history" ? `${record.progress || 1}-р ${item.type === "anime" ? "анги" : "бүлэг"} хүртэл` : item.genres.join(" · ")}</p><b>Үргэлжлүүлэх →</b></div></a>{kind === "library" && <button onClick={() => remove(item.id)} aria-label="Сангаас хасах">×</button>}</article>)}</div> : <div className="collection-empty"><span>▥</span><h2>Одоогоор хоосон байна</h2><p>Бүтээлийн хуудаснаас нэмэх товчийг дарахад энд хадгалагдана.</p><a href="/">Бүтээл үзэх</a></div>}</main></Chrome>;
}
