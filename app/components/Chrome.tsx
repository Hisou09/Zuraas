"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { catalog } from "../data/catalog";

type ChromeProps = {
  children: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
};

function NavItem({ href, icon, label, active = false, badge }: { href: string; icon: string; label: string; active?: boolean; badge?: string }) {
  return <a className={`nav-link ${active ? "active" : ""}`} href={href}><i>{icon}</i><span>{label}</span>{badge && <b>{badge}</b>}</a>;
}

export function Chrome({ children, searchValue, onSearchChange }: ChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const value = searchValue ?? localSearch;

  const setSearch = (next: string) => {
    setLocalSearch(next);
    onSearchChange?.(next);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (!onSearchChange && value.trim()) window.location.assign(`/?q=${encodeURIComponent(value.trim())}`);
  };

  const randomTitle = () => {
    const pick = catalog[Math.floor(Math.random() * catalog.length)];
    window.location.assign(`/title/${pick.id}`);
  };

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  return (
    <div className="app-shell">
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Цэс нээх">☰</button>
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a className="identity" href="/"><img src="/logo.png" alt="Зураас лого" /><div><b>ЗУРААС</b><small>ANIME & MANHWA</small></div></a>
        <nav>
          <section><div className="nav-title"><span>ЦЭС</span><i /></div><NavItem href="/" icon="⌂" label="Нүүр" active /><NavItem href="/#catalog" icon="⊞" label="Бүх бүтээл" /><NavItem href="#vip" icon="♔" label="VIP эрх" badge="PRO" /></section>
          <section><div className="nav-title"><span>МИНИЙ САН</span><i /></div><NavItem href="#history" icon="◷" label="Сүүлд үзсэн" /><NavItem href="#library" icon="▥" label="Миний сан" /></section>
          <section><div className="nav-title"><span>АДМИН</span><i /></div><NavItem href="#admin" icon="♢" label="Удирдлага" /></section>
        </nav>
        <div className="sidebar-bottom"><button className="random" onClick={randomTitle}><span>⤨ &nbsp; Хийцгүй</span><b>RANDOM</b></button><a className="plain" href="#facebook"><i>●</i> Фэйсбүүк хуудас</a><a className="plain" href="#settings"><i>⚙</i> Тохиргоо</a></div>
      </aside>
      {menuOpen && <button className="backdrop" aria-label="Цэс хаах" onClick={() => setMenuOpen(false)} />}

      <div className="site-area">
        <header className="topbar">
          <div className="history-buttons"><button aria-label="Буцах" onClick={() => history.back()}>‹</button><button aria-label="Урагшлах" onClick={() => history.forward()}>›</button></div>
          <form className="global-search" onSubmit={submitSearch}><span>⌕</span><input id="global-search" value={value} onChange={(e) => setSearch(e.target.value)} placeholder="Anime, Manga болон бусдыг хайх" aria-label="Бүтээл хайх" /><kbd>Ctrl+K</kbd></form>
          <button className="bell" aria-label="Мэдэгдэл">♧<i /></button>
        </header>
        {children}
      </div>
    </div>
  );
}
