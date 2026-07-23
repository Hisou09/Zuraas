"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Bookmark, Check, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { invalidateCachedJson, peekCachedJson, requestCachedJson } from "../data/client-cache";
import { PROFILE_UPDATED_EVENT,type ProfileUpdatedDetail } from "../data/profile-events";

type Comment = { id: number; userEmail?: string; displayName: string; body: string; createdAt: string; avatarUrl?: string | null };
type CommentSession = { user?: { email?: string; contactEmail?: string; displayName?: string; avatarUrl?: string | null; coverUrl?: string | null } };

function formatCommentDate(value: string) {
  const [date = value, time = ""] = value.replace("T", " ").split(" ");
  return `${date.replaceAll("-", ".")}${time ? ` · ${time.slice(0, 5)}` : ""}`;
}

export function TitleActions({ contentId, primaryHref, contentType }: { contentId: string; primaryHref: string; contentType: "anime"|"manga" }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [progress,setProgress]=useState(0);
  const [resumePage,setResumePage]=useState(0);
  const [message, setMessage] = useState("");
  const [opening,setOpening]=useState(false);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    const apply=(library:{items?:{contentId:string}[]} | null,history:{items?:{contentId:string;progress?:number;pageIndex?:number}[]} | null)=>{setSaved(Boolean(library?.items?.some(item=>item.contentId===contentId)));const record=history?.items?.find(item=>item.contentId===contentId);setProgress(Number(record?.progress)||0);setResumePage(Math.max(0,Number(record?.pageIndex)||0))};
    const cachedLibrary=peekCachedJson<{items?:{contentId:string}[]}>("user-items:library");
    const cachedHistory=peekCachedJson<{items?:{contentId:string;progress?:number;pageIndex?:number}[]}>("user-items:history");
    if(cachedLibrary||cachedHistory)apply(cachedLibrary,cachedHistory);
    Promise.all([
      requestCachedJson<{items?:{contentId:string}[]}>("user-items:library","/api/app/user-items?kind=library",30_000),
      requestCachedJson<{items?:{contentId:string;progress?:number;pageIndex?:number}[]}>("user-items:history","/api/app/user-items?kind=history",30_000),
    ]).then(([library,history])=>apply(library,history)).catch(()=>null)
  },[contentId]);
  const read = async () => {
    if(opening)return;
    setOpening(true);
    if(primaryHref==="/vip"){
      window.sessionStorage.setItem("zuraas-previous-route",`${window.location.pathname}${window.location.search}${window.location.hash}`);
      if(contentType==="manga"&&window.matchMedia("(max-width: 720px)").matches){
        window.dispatchEvent(new CustomEvent("zuraas-settings-tab",{detail:"vip"}));
        router.push("/settings?tab=vip#vip-status");
      }else{
        router.push(primaryHref);
      }
      return;
    }
    if(contentType==="manga")await fetch("/api/app/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentId, progress: Math.max(1,progress||1) }),
      keepalive: true,
    }).then(response=>{if(response.ok)invalidateCachedJson("user-items:history")}).catch(()=>null);
    const pageQuery=resumePage>0?`?page=${resumePage}`:"";
    const href=contentType==="anime"&&progress>0?`/watch/${encodeURIComponent(contentId)}/${progress}`:contentType==="manga"&&progress>0?`/read/${encodeURIComponent(contentId)}/${progress}${pageQuery}`:primaryHref;
    window.sessionStorage.setItem("zuraas-previous-route",`${window.location.pathname}${window.location.search}${window.location.hash}`);
    router.push(href);
  };
  const save = async () => {
    if(saving)return;
    const previousSaved=saved;
    const nextSaved=!previousSaved;
    setSaving(true);
    setSaved(nextSaved);
    setMessage("");
    try{
      const response=await fetch(previousSaved?`/api/app/library?contentId=${encodeURIComponent(contentId)}`:"/api/app/library",previousSaved?{method:"DELETE"}:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contentId})});
      if(!response.ok)throw new Error("library update failed");
      invalidateCachedJson("user-items:library");
    }catch{
      setSaved(previousSaved);
      setMessage(previousSaved?"Сангаас хасахад алдаа гарлаа":"Санд нэмэхэд алдаа гарлаа");
    }finally{
      setSaving(false);
    }
  };
  return <><div className={`title-actions clean-title-actions ${contentType==="anime"?"single-action":""}`}><button onClick={read} disabled={opening}><Play size={16} fill="currentColor"/>{progress>0?"Үргэлжлүүлэх":contentType==="anime"?"Үзэх":"Унших"}</button>{contentType==="manga"&&<button className={saved ? "saved" : ""} onClick={save} disabled={saving} aria-busy={saving}>{saved?<Check size={17}/>:<Bookmark size={17}/>}<span>{saved?"Санд нэмсэн":"Санд нэмэх"}</span></button>}</div>{message && <small className="action-message">{message}</small>}</>;
}

export function Comments({ contentId }: { contentId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [session,setSession]=useState<CommentSession|null>(null);
  const [body, setBody] = useState("");
  const [sending,setSending]=useState(false);
  const [message,setMessage]=useState("");
  const load = useCallback(() => fetch(`/api/app/comments?contentId=${contentId}`).then((r) => r.json()).then((data) => setComments(data.comments || [])).catch(() => null), [contentId]);
  useEffect(() => { void load();requestCachedJson<CommentSession>("session","/api/app/session",30_000).then(setSession).catch(()=>null); }, [load]);
  useEffect(()=>{
    const updateProfile=(event:Event)=>{
      const profile=(event as CustomEvent<ProfileUpdatedDetail>).detail;
      setSession(current=>current?{
        ...current,
        user:{
          ...current.user,
          email:profile.email,
          displayName:profile.displayName,
          contactEmail:profile.contactEmail,
          avatarUrl:profile.avatarUrl,
          coverUrl:profile.coverUrl,
        },
      }:current);
      setComments(current=>current.map(comment=>
        comment.userEmail?.toLowerCase()===profile.email.toLowerCase()
          ? {...comment,displayName:profile.displayName,avatarUrl:profile.avatarUrl}
          : comment
      ));
    };
    window.addEventListener(PROFILE_UPDATED_EVENT,updateProfile);
    return()=>window.removeEventListener(PROFILE_UPDATED_EVENT,updateProfile);
  },[]);
  const submit = async (event: FormEvent) => { event.preventDefault();if(!body.trim()||sending)return;setSending(true);setMessage("");const response=await fetch("/api/app/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, body }) }).catch(()=>null);if(!response?.ok){setMessage("Сэтгэгдэл илгээгдсэнгүй. Дахин оролдоно уу.");setSending(false);return}setBody("");await load();setSending(false); };
  const currentName=session?.user?.displayName||"Зураас хэрэглэгч";
  return (
    <section className="comments-section">
      <div className="detail-heading">
        <h2>Сэтгэгдэл</h2>
        <span>{comments.length}</span>
      </div>
      <form className="comment-composer" onSubmit={submit}>
        <span className="comment-avatar">
          {session?.user?.avatarUrl
            ? <img src={session.user.avatarUrl} alt={`${currentName} профайл зураг`}/>
            : currentName.slice(0,2).toUpperCase()}
        </span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Сэтгэгдэл бичих"
          aria-label="Сэтгэгдэл бичих"
          rows={2}
        />
        <button type="submit" disabled={sending||!body.trim()}>
          {sending ? "Илгээж байна..." : "Илгээх"}
        </button>
      </form>
      {message&&<small className="action-message">{message}</small>}
      <div className="public-comments">
        {comments.map((comment) => (
          <article key={comment.id}>
            <span className="comment-avatar">
              {comment.avatarUrl
                ? <img src={comment.avatarUrl} alt={`${comment.displayName} профайл зураг`}/>
                : comment.displayName.slice(0,2).toUpperCase()}
            </span>
            <div className="public-comment-content">
              <header>
                <b>{comment.displayName}</b>
                <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
              </header>
              <p>{comment.body}</p>
            </div>
          </article>
        ))}
        {comments.length === 0 && <p className="no-comments">Анхны сэтгэгдлийг та бичээрэй.</p>}
      </div>
    </section>
  );
}
