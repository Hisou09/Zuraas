"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Comment = { id: number; displayName: string; body: string; createdAt: string };

export function TitleActions({ contentId, primaryHref }: { contentId: string; primaryHref: string }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{fetch("/api/app/user-items?kind=library").then(response=>response.ok?response.json():null).then(value=>setSaved(Boolean(value?.items?.some((item:{contentId:string})=>item.contentId===contentId)))).catch(()=>null)},[contentId]);
  const read = async () => { setBusy(true);await fetch("/api/app/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, progress: 1 }) }).catch(()=>null);window.location.assign(primaryHref); };
  const save = async () => {
    if(busy)return;setBusy(true);setMessage("");
    const response=await fetch(saved?`/api/app/library?contentId=${encodeURIComponent(contentId)}`:"/api/app/library",saved?{method:"DELETE"}:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contentId})}).catch(()=>null);
    if(!response?.ok){setMessage(saved?"Сангаас хасахад алдаа гарлаа":"Санд нэмэхэд алдаа гарлаа");setBusy(false);return}
    setSaved(!saved);setMessage(saved?"Миний сангаас хаслаа":"Миний санд хадгаллаа");setBusy(false);
  };
  return <><div className="title-actions clean-title-actions"><button onClick={read} disabled={busy}>▶ Унших</button><button className={saved ? "saved" : ""} onClick={save} disabled={busy}>{busy?"Түр хүлээнэ үү...":saved?"✓ Санд нэмсэн":"＋ Санд нэмэх"}</button></div>{message && <small className="action-message">{message}</small>}</>;
}

export function Comments({ contentId }: { contentId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [sending,setSending]=useState(false);
  const [message,setMessage]=useState("");
  const load = () => fetch(`/api/app/comments?contentId=${contentId}`).then((r) => r.json()).then((data) => setComments(data.comments || [])).catch(() => null);
  useEffect(() => { void load(); }, [contentId]);
  const submit = async (event: FormEvent) => { event.preventDefault();if(!body.trim()||sending)return;setSending(true);setMessage("");const response=await fetch("/api/app/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, body }) }).catch(()=>null);if(!response?.ok){setMessage("Сэтгэгдэл илгээгдсэнгүй. Дахин оролдоно уу.");setSending(false);return}setBody("");await load();setSending(false); };
  return <section className="comments-section"><div className="detail-heading"><h2>Сэтгэгдэл</h2><span>{comments.length}</span></div><form onSubmit={submit}><span>ЗУ</span><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Энэ бүтээлийн талаар сэтгэгдлээ бичээрэй..." /><button type="submit" disabled={sending||!body.trim()}>{sending?"Илгээж байна...":"Илгээх"}</button></form>{message&&<small className="action-message">{message}</small>}<div className="public-comments">{comments.map((comment) => <article key={comment.id}><span>{comment.displayName.slice(0,2).toUpperCase()}</span><div><b>{comment.displayName}</b><time>{comment.createdAt}</time><p>{comment.body}</p></div></article>)}{comments.length === 0 && <p className="no-comments">Анхны сэтгэгдлийг та бичээрэй.</p>}</div></section>;
}
