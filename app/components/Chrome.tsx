"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { catalog } from "../data/catalog";

type ChromeProps = { children: ReactNode; searchValue?: string; onSearchChange?: (value: string) => void };
type Session = { user: { email: string; displayName: string; usercode?: string; vipUntil?: string }; notifications: { id: number; title: string; body: string; isRead: number; createdAt: string }[] };

function NavItem({ href, icon, label, badge, pathname }: { href: string; icon: string; label: string; badge?: string; pathname: string }) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <a className={`nav-link ${active ? "active" : ""}`} href={href}><i>{icon}</i><span>{label}</span>{badge && <b>{badge}</b>}</a>;
}

export function Chrome({ children, searchValue, onSearchChange }: ChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [pathname, setPathname] = useState("/");
  const [localSearch, setLocalSearch] = useState("");
  const noticeRef = useRef<HTMLDivElement>(null);
  const value = searchValue ?? localSearch;

  const setSearch = (next: string) => { setLocalSearch(next); onSearchChange?.(next); };
  const submitSearch = (event: FormEvent) => { event.preventDefault(); if (!onSearchChange && value.trim()) window.location.assign(`/?q=${encodeURIComponent(value.trim())}`); };
  const randomTitle = () => { const pick = catalog[Math.floor(Math.random() * catalog.length)]; window.location.assign(`/title/${pick.id}`); };

  useEffect(() => {
    setPathname(window.location.pathname);
    fetch("/api/app/session").then((response) => response.ok ? response.json() : null).then(setSession).catch(() => null);
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.getElementById("global-search")?.focus(); } };
    const close = (event: MouseEvent) => { if (noticeRef.current && !noticeRef.current.contains(event.target as Node)) setNoticeOpen(false); };
    window.addEventListener("keydown", shortcut); document.addEventListener("mousedown", close);
    return () => { window.removeEventListener("keydown", shortcut); document.removeEventListener("mousedown", close); };
  }, []);

  const initials = (session?.user.displayName || "ЗУ").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <div className="app-shell">
    <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Цэс нээх">☰</button>
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
      <a className="identity" href="/"><img src="/logo.png" alt="Зураас лого" /><div><b>ЗУРААС</b><small>ANIME & MANHWA</small></div></a>
      <nav>
        <section><div className="nav-title"><span>ЦЭС</span><i /></div><NavItem href="/" icon="⌂" label="Нүүр" pathname={pathname} /><NavItem href="/#catalog" icon="⊞" label="Бүх бүтээл" pathname={pathname} /><NavItem href="/vip" icon="♔" label="VIP эрх" badge="PRO" pathname={pathname} /></section>
        <section><div className="nav-title"><span>МИНИЙ САН</span><i /></div><NavItem href="/history" icon="◷" label="Сүүлд үзсэн" pathname={pathname} /><NavItem href="/library" icon="▥" label="Миний сан" pathname={pathname} /></section>
        <section><div className="nav-title"><span>АДМИН</span><i /></div><NavItem href="/admin" icon="♢" label="Удирдлага" pathname={pathname} /></section>
      </nav>
      <div className="sidebar-bottom"><button className="random" onClick={randomTitle}><span>⤨ &nbsp; Хийцгүй</span><b>RANDOM</b></button><a className="plain" href="#facebook"><i>●</i> Фэйсбүүк хуудас</a><a className="plain" href="#settings"><i>⚙</i> Тохиргоо</a></div>
    </aside>
    {menuOpen && <button className="backdrop" aria-label="Цэс хаах" onClick={() => setMenuOpen(false)} />}
    <div className="site-area">
      <header className="topbar">
        <div className="history-buttons"><button aria-label="Буцах" onClick={() => history.back()}>‹</button><button aria-label="Урагшлах" onClick={() => history.forward()}>›</button></div>
        <form className="global-search" onSubmit={submitSearch}><span>⌕</span><input id="global-search" value={value} onChange={(e) => setSearch(e.target.value)} placeholder="Anime, Manga болон бусдыг хайх" aria-label="Бүтээл хайх" /><kbd>Ctrl+K</kbd></form>
        <div className="account-actions" ref={noticeRef}>
          <button className="bell" aria-label="Мэдэгдэл" onClick={() => { setNoticeOpen(!noticeOpen); setProfileOpen(false); }}>♧{session?.notifications.some((item) => !item.isRead) && <i />}</button>
          <button className="avatar" aria-label="Хэрэглэгчийн профайл" onClick={() => { setProfileOpen(!profileOpen); setNoticeOpen(false); }}>{initials}</button>
          {noticeOpen && <div className="notification-popover"><header><div><b>Мэдэгдэл</b><small>Бүгдийг уншсан</small></div><button onClick={() => setNoticeOpen(false)}>×</button></header>{session?.notifications.length ? <div className="notification-list">{session.notifications.map((item) => <article key={item.id}><i>♧</i><div><b>{item.title}</b><p>{item.body}</p><small>{item.createdAt}</small></div></article>)}</div> : <div className="notification-empty"><span>♧</span><b>Мэдэгдэл байхгүй байна</b><p>VIP эрхийн өөрчлөлт болон таны сэтгэгдэлд ирсэн хариунууд энд харагдана.</p></div>}</div>}
          {profileOpen && <div className="profile-popover"><div className="profile-head"><span>{initials}</span><div><b>{session?.user.displayName || "Зураас хэрэглэгч"}</b><small>{session?.user.email || "Нэвтэрсэн хэрэглэгч"}</small>{session?.user.usercode && <code>USERCODE · {session.user.usercode}</code>}</div></div><a href="/library">Миний сан</a><a href="/history">Сүүлд үзсэн</a><a href="/vip">VIP эрх</a><a href="/signout-with-chatgpt?return_to=/">Гарах</a></div>}
        </div>
      </header>{children}
    </div>
  </div>;
}
