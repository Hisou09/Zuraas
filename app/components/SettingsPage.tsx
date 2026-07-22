"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Bell, Camera, ChevronRight, Clock3, Crown, KeyRound, LogOut, MonitorSmartphone, UserRound, X } from "lucide-react";
import { VipPurchaseFlow } from "./VipPage";

type SettingsData = {
  profile: { displayName: string; authEmail: string; contactEmail: string; usercode: string; vipUntil: string | null; avatarUrl: string | null; coverUrl: string | null };
  devices: { deviceId: string; label: string; createdAt: string; lastSeenAt: string }[];
  currentDeviceId: string;
  payments: { id: number; days: number; source: string; grantedAt: string; expiresAt: string | null }[];
};
type SettingsTab = "profile" | "vip" | "login";
type Notice = { id: number; title: string; body: string; isRead: number; createdAt: string };

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("mn-MN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value.replace(" ", "T") + (/Z$/.test(value) ? "" : "Z"))) : "—";

export function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const load = async () => {
    const [response, sessionResponse] = await Promise.all([fetch("/api/app/settings"), fetch("/api/app/session")]);
    if (response.status === 401) { window.location.assign("/signout-with-chatgpt?return_to=/"); return; }
    const value = await response.json() as SettingsData;
    const session = sessionResponse.ok ? await sessionResponse.json() : null;
    setData(value);
    setNotices(session?.notifications || []);
    setDisplayName(value.profile.displayName);
    setContactEmail(value.profile.contactEmail);
    setAvatarPreview(value.profile.avatarUrl || "");
    setCoverPreview(value.profile.coverUrl || "");
  };
  useEffect(() => { document.title = "Тохиргоо"; void load(); }, []);

  const pick = (file: File | undefined, kind: "avatar" | "cover") => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (kind === "avatar") { setAvatar(file); setAvatarPreview(url); } else { setCover(file); setCoverPreview(url); }
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const body = new FormData(); body.set("displayName", displayName); body.set("contactEmail", contactEmail);
    if (avatar) body.set("avatar", avatar); if (cover) body.set("cover", cover);
    const response = await fetch("/api/app/settings/profile", { method: "POST", body });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(result.error || "Хадгалахад алдаа гарлаа"); return; }
    setAvatar(null); setCover(null); setMessage("Хувийн мэдээлэл хадгалагдлаа"); await load();
  };
  const logoutOthers = async () => {
    if (!window.confirm("Бусад бүх төхөөрөмжөөс гарах уу?")) return;
    setBusy(true); const response = await fetch("/api/app/settings/devices/logout-others", { method: "POST" }); setBusy(false);
    if (response.ok) { setMessage("Бусад төхөөрөмжүүдээс гарлаа"); await load(); } else setMessage("Төхөөрөмжөөс гаргахад алдаа гарлаа");
  };
  const markNotices = async () => {
    if (!notices.some(item => !item.isRead)) return;
    const response = await fetch("/api/app/notifications/read-all", { method: "POST" });
    if (response.ok) setNotices(current => current.map(item => ({ ...item, isRead: 1 })));
  };

  const nav = [
    { id: "profile" as const, label: "Хувийн мэдээлэл", icon: UserRound },
    { id: "vip" as const, label: "VIP эрх", icon: Crown },
    { id: "login" as const, label: "Нэвтрэлт", icon: MonitorSmartphone, badge: data?.devices.length },
  ];
  if (!data) return <main className="settings-page"><div className="settings-loading">Тохиргоо ачаалж байна...</div></main>;

  return <main className="settings-page">
    <header className="settings-title"><div><small>БҮРТГЭЛ</small><h1>Тохиргоо</h1><p>Хувийн мэдээлэл, аюулгүй байдал болон төхөөрөмжүүдээ удирдана.</p></div></header>
    {message && <div className="settings-message">{message}</div>}
    <div className="settings-layout">
      <aside className="settings-nav">
        {nav.map(({ id, label, icon: Icon, badge }) => <button className={tab === id ? "active" : ""} onClick={() => { setTab(id); setMessage(""); setNoticeOpen(false); }} key={id}><Icon size={17}/><span>{label}</span>{badge !== undefined && <b>{badge}</b>}<ChevronRight size={15}/></button>)}
        <button className="settings-notice-button" onClick={() => setNoticeOpen(value => !value)} aria-label="Мэдэгдэл"><Bell size={19}/>{notices.some(item => !item.isRead) && <i/>}</button>
        {noticeOpen && <div className="settings-notification-popover">
          <header><div><b>Мэдэгдэл</b><button type="button" onClick={markNotices}>Бүгдийг унших</button></div><button type="button" onClick={() => setNoticeOpen(false)} aria-label="Хаах"><X size={18}/></button></header>
          {notices.length ? <div>{notices.map(item => <article key={item.id} className={item.isRead ? "" : "unread"}><span><Bell size={15}/></span><div><b>{item.title}</b><p>{item.body}</p><small>{dateTime(item.createdAt)}</small></div></article>)}</div> : <section><Bell size={28}/><b>Мэдэгдэл хоосон байна</b><p>Одоогоор танд ирсэн шинэ мэдэгдэл алга.</p></section>}
        </div>}
      </aside>
      <section className="settings-content">
        {tab === "profile" && <>
          <form className="profile-settings" onSubmit={saveProfile}>
            <div className="settings-card profile-visual">
              <div className="profile-cover" style={coverPreview ? { backgroundImage: `linear-gradient(0deg,rgba(8,10,14,.35),rgba(8,10,14,.08)),url(${coverPreview})` } : undefined}><label><Camera size={15}/> Ковер зураг солих<input type="file" accept="image/*" onChange={event => pick(event.target.files?.[0], "cover")}/></label></div>
              <div className="profile-avatar-wrap"><div className="profile-avatar-large">{avatarPreview ? <img src={avatarPreview} alt="Нүүр зураг"/> : <span>{displayName.slice(0, 2).toUpperCase()}</span>}<label aria-label="Нүүр зураг солих"><Camera size={15}/><input type="file" accept="image/*" onChange={event => pick(event.target.files?.[0], "avatar")}/></label></div><div><h2>{displayName}</h2><p>{contactEmail}</p></div></div>
            </div>
            <div className="settings-card settings-form-card">
              <div className="settings-section-head"><UserRound size={19}/><div><h2>Хувийн мэдээлэл</h2><p>Сайтад харагдах нэр болон холбоо барих имэйл.</p></div></div>
              <label>Хэрэглэгчийн нэр<input value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={50} required/></label>
              <label>Имэйл хаяг<input type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} required/><small>Нэвтрэх үндсэн имэйл: {data.profile.authEmail}</small></label>
              <div className={`settings-vip-expiry ${data.profile.vipUntil ? "active" : ""}`}><span><Crown size={21}/></span><div><small>VIP ЭРХИЙН ДУУСАХ ХУГАЦАА</small><strong>{data.profile.vipUntil ? dateTime(data.profile.vipUntil) : "VIP эрх идэвхгүй"}</strong><p>{data.profile.vipUntil ? "Эрхийн хугацаа дуусах хүртэл VIP контент үзэх боломжтой." : "VIP эрх хэсгээс өөрт тохирох багцаа сонгон эрхээ аваарай."}</p></div></div>
              <div className="settings-form-actions"><span>Зураг JPG, PNG эсвэл WebP · 8MB хүртэл</span><button disabled={busy}>{busy ? "Хадгалж байна..." : "Өөрчлөлт хадгалах"}</button></div>
            </div>
          </form>
          <div className="settings-card security-card"><span><KeyRound size={25}/></span><div><small>НУУЦ ҮГ</small><h2>ChatGPT бүртгэлээр хамгаалагдсан</h2><p>Зураас нь таны нууц үгийг хадгалдаггүй. Нэвтрэх нууц үг болон хоёр шатлалт баталгаажуулалтыг ChatGPT бүртгэлийн аюулгүй байдлын тохиргооноос солино.</p><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT аюулгүй байдлыг нээх <ChevronRight size={15}/></a></div></div>
        </>}
        {tab === "login" && <div className="settings-card">
          <div className="settings-section-head devices-head"><MonitorSmartphone size={20}/><div><h2>Идэвхтэй төхөөрөмж</h2><p>Одоогоор {data.devices.length} төхөөрөмжөөс нэвтэрсэн байна.</p></div><button onClick={logoutOthers} disabled={busy}><LogOut size={15}/> Бусад бүх төхөөрөмжөөс гарах</button></div>
          <div className="device-list">{data.devices.map(device => <article key={device.deviceId}><i><MonitorSmartphone size={19}/></i><div><b>{device.label}</b><small>Сүүлд идэвхтэй: {dateTime(device.lastSeenAt)}</small></div>{device.deviceId === data.currentDeviceId ? <span>Энэ төхөөрөмж</span> : <em>Идэвхтэй</em>}</article>)}</div>
        </div>}
        {tab === "vip" && <div className="settings-vip-purchase"><header><Crown size={21}/><div><h2>VIP эрх авах</h2><p>Багцаа сонгоод төлбөрийн мэдээллийн дагуу шилжүүлэг хийнэ.</p></div>{data.profile.vipUntil && <span><Clock3 size={14}/> {dateTime(data.profile.vipUntil)} хүртэл</span>}</header><VipPurchaseFlow usercode={data.profile.usercode}/></div>}
      </section>
    </div>
  </main>;
}
