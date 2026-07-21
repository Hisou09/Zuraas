"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "./data/catalog";

const icons = {
  home: "⌂", search: "⌕", vip: "♔", history: "◷", library: "▥", admin: "♢", random: "⤨", facebook: "●", settings: "⚙",
};

function Card({ item }: { item: CatalogItem }) {
  const count = item.type === "anime" ? `${item.episodes ?? 0} eps` : `${item.chapters ?? 0} ch`;
  return (
    <article className="card" tabIndex={0}>
      <div className="cover">
        <img src={item.image} alt={`${item.title} cover`} loading="lazy" />
        <button aria-label={`${item.title}-г нээх`}>▶</button>
      </div>
      <h3>{item.title}</h3>
      <div className="badges"><span>{item.status}</span><small>{count}</small></div>
    </article>
  );
}

function NavLink({ icon, label, active = false, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return <button className={`nav-link ${active ? "active" : ""}`} onClick={onClick}><i>{icon}</i><span>{label}</span>{label === "VIP эрх" && <b>PRO</b>}</button>;
}

export default function Home() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/catalog")
      .then((response) => response.json())
      .then((data: { items: CatalogItem[] }) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); document.getElementById("side-search")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const result = useMemo(() => {
    const needle = query.toLowerCase();
    return items.filter((item) => `${item.title} ${item.originalTitle} ${item.genres.join(" ")}`.toLowerCase().includes(needle));
  }, [items, query]);

  const anime = result.filter((item) => item.type === "anime");
  const manga = result.filter((item) => item.type !== "anime");

  return (
    <main>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Цэс нээх">☰</button>
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="identity"><img src="/logo.png" alt="Зураас лого" /><div><b>ЗУРААС</b><small>ANIME & MANHWA</small></div></div>
        <label className="side-search"><i>{icons.search}</i><input id="side-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Хайх..." /><kbd>Ctrl+K</kbd></label>

        <nav>
          <section><div className="nav-title"><span>ЦЭС</span><i /></div><NavLink icon={icons.home} label="Нүүр" active /><NavLink icon={icons.search} label="Хайх" onClick={() => document.getElementById("side-search")?.focus()} /><NavLink icon={icons.vip} label="VIP эрх" /></section>
          <section><div className="nav-title"><span>МИНИЙ САН</span><i /></div><NavLink icon={icons.history} label="Сүүлд үзсэн" /><NavLink icon={icons.library} label="Миний сан" /></section>
          <section><div className="nav-title"><span>АДМИН</span><i /></div><NavLink icon={icons.admin} label="Удирдлага" /></section>
        </nav>

        <div className="sidebar-bottom"><button className="random"><span>{icons.random} &nbsp; Хийгүй</span><b>RANDOM</b></button><button className="plain"><i>{icons.facebook}</i> Фэйсбүүк хуудас</button><button className="plain"><i>{icons.settings}</i> Тохиргоо</button></div>
      </aside>
      {menuOpen && <button className="backdrop" aria-label="Цэс хаах" onClick={() => setMenuOpen(false)} />}

      <div className="content">
        <header><div><img src="/logo.png" alt="" /><span>ЗУРААС</span></div><p>Анимэ үз. Манхва унш. Хязгааргүй ертөнцөөр аял.</p></header>

        <section className="shelf">
          <div className="shelf-title"><h2>Popular Anime</h2><span>{anime.length} бүтээл</span></div>
          <div className="card-row">{anime.map((item) => <Card item={item} key={item.id} />)}</div>
        </section>

        <section className="shelf">
          <div className="shelf-title"><h2>Trending Manga</h2><span>{manga.length} бүтээл</span></div>
          <div className="card-row">{manga.map((item) => <Card item={item} key={item.id} />)}</div>
        </section>

        {result.length === 0 && <div className="empty"><strong>Илэрц олдсонгүй</strong><span>Өөр түлхүүр үгээр хайгаад үзээрэй.</span></div>}
      </div>
    </main>
  );
}
