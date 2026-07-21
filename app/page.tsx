"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chrome } from "./components/Chrome";
import type { CatalogItem } from "./data/catalog";

function Card({ item }: { item: CatalogItem }) {
  const count = item.type === "anime" ? `${item.episodes ?? 0} eps` : `${item.chapters ?? 0} ch`;
  return <a className="card" href={`/title/${item.id}`}><div className="cover"><img src={item.image} alt={`${item.title} cover`} loading="lazy" /><span>▶</span></div><h3>{item.title}</h3><div className="badges"><span>{item.status}</span><small>{count}</small></div></a>;
}

function Shelf({ title, items }: { title: string; items: CatalogItem[] }) {
  const row = useRef<HTMLDivElement>(null);
  const move = (direction: number) => row.current?.scrollBy({ left: direction * row.current.clientWidth * .86, behavior: "smooth" });
  return <section className="shelf"><div className="shelf-title"><h2>{title}</h2><span>{items.length} бүтээл</span><div className="shelf-controls"><button onClick={() => move(-1)} aria-label={`${title} өмнөх`}>‹</button><button onClick={() => move(1)} aria-label={`${title} дараах`}>›</button></div></div><div className="card-row" ref={row}>{items.map((item) => <Card item={item} key={item.id} />)}</div></section>;
}

export default function Home() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q") ?? "";
    setQuery(initial);
    fetch("/api/catalog").then((response) => response.json()).then((data: { items: CatalogItem[] }) => setItems(data.items)).catch(() => setItems([]));
  }, []);

  const result = useMemo(() => {
    const needle = query.toLowerCase();
    return items.filter((item) => `${item.title} ${item.originalTitle} ${item.genres.join(" ")}`.toLowerCase().includes(needle));
  }, [items, query]);

  const anime = result.filter((item) => item.type === "anime");
  const manga = result.filter((item) => item.type !== "anime");

  return <Chrome searchValue={query} onSearchChange={setQuery}><main className="home-content" id="catalog"><Shelf title="Анимэ" items={anime} /><Shelf title="Манга" items={manga} />{result.length === 0 && <div className="empty"><strong>Илэрц олдсонгүй</strong><span>Өөр түлхүүр үгээр хайгаад үзээрэй.</span></div>}</main></Chrome>;
}
