"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Comment = { id: number; displayName: string; body: string; createdAt: string };

export function TitleActions({ contentId, primaryHref }: { contentId: string; primaryHref: string }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const read = async () => { await fetch("/api/app/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, progress: 1 }) }); window.location.href=primaryHref; };
  const save = async () => { const response=await fetch("/api/app/library", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId }) }); if(!response.ok){setMessage("Санд нэмэхэд алдаа гарлаа");return}setSaved(true);setMessage("Миний санд хадгаллаа"); };
  return <><div className="title-actions clean-title-actions"><button onClick={read}>▶ Унших</button><button className={saved ? "saved" : ""} onClick={save}>{saved ? "✓ Санд нэмсэн" : "＋ Санд нэмэх"}</button></div>{message && <small className="action-message">{message}</small>}</>;
}

export function Comments({ contentId }: { contentId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const load = () => fetch(`/api/app/comments?contentId=${contentId}`).then((r) => r.json()).then((data) => setComments(data.comments || [])).catch(() => null);
  useEffect(() => { void load(); }, [contentId]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!body.trim()) return; await fetch("/api/app/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, body }) }); setBody(""); load(); };
  return <section className="comments-section"><div className="detail-heading"><h2>Сэтгэгдэл</h2><span>{comments.length}</span></div><form onSubmit={submit}><span>ЗУ</span><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Энэ бүтээлийн талаар сэтгэгдлээ бичээрэй..." /><button type="submit">Илгээх</button></form><div className="public-comments">{comments.map((comment) => <article key={comment.id}><span>{comment.displayName.slice(0,2).toUpperCase()}</span><div><b>{comment.displayName}</b><time>{comment.createdAt}</time><p>{comment.body}</p></div></article>)}{comments.length === 0 && <p className="no-comments">Анхны сэтгэгдлийг та бичээрэй.</p>}</div></section>;
}
