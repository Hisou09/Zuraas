"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Camera, Check, ChevronRight, Clock3, Crown, Images, KeyRound, Laptop, LogOut, MonitorSmartphone, Trash2, UserRound, X } from "lucide-react";
import { VipPurchaseFlow } from "./VipPage";
import { requestSocials,type Socials } from "../data/social-cache";
import { invalidateCachedJson,peekCachedJson,requestCachedJson } from "../data/client-cache";
import { emitProfileUpdated,type ProfileUpdatedDetail } from "../data/profile-events";
import { SocialBrandIcon,type SocialBrand } from "./SocialBrandIcon";

type SettingsData = {
  profile: { displayName: string; authEmail: string; contactEmail: string; usercode: string; vipUntil: string | null; avatarUrl: string | null; coverUrl: string | null; canChangePassword: boolean };
  devices: { deviceId: string; label: string; lastIp: string; createdAt: string; lastSeenAt: string }[];
  currentDeviceId: string;
  payments: { id: number; days: number; source: string; grantedAt: string; expiresAt: string | null }[];
  mediaOptions: {
    avatars: ProfileMediaOption[];
    covers: ProfileMediaOption[];
  };
};
type ProfileMediaOption = {
  id: string;
  url: string;
  title: string;
  kind: "character" | "cover" | "banner";
};
type SettingsTab = "profile" | "vip" | "login";
type DeviceLogoutConfirm =
  | { kind: "others" }
  | { kind: "device"; deviceId: string; label: string };

const socialOptions = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "discord", label: "Discord" },
  { key: "telegram", label: "Telegram" },
] as const satisfies ReadonlyArray<{ key: SocialBrand; label: string }>;

const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("mn-MN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value.replace(" ", "T") + (/Z$/.test(value) ? "" : "Z"))) : "—";

export function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [socials, setSocials] = useState<Socials | null>(null);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [avatarSource, setAvatarSource] = useState("");
  const [coverSource, setCoverSource] = useState("");
  const [imagePicker, setImagePicker] = useState<"avatar" | "cover" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deviceLogoutConfirm, setDeviceLogoutConfirm] = useState<DeviceLogoutConfirm | null>(null);
  const applyData = (value: SettingsData) => {
    setData(value);
    setDisplayName(value.profile.displayName);
    setContactEmail(value.profile.contactEmail);
    setAvatarPreview(value.profile.avatarUrl || "");
    setCoverPreview(value.profile.coverUrl || "");
  };
  const load = async (force=false) => {
    const cached=peekCachedJson<SettingsData>("settings");
    if(cached&&!force)applyData(cached);
    const [value, socialValue] = await Promise.all([requestCachedJson<SettingsData>("settings","/api/app/settings",60_000,force), requestSocials()]);
    setSocials(socialValue);
    applyData(value);
  };
  useEffect(() => {
    document.title = "Тохиргоо";
    const requested=new URLSearchParams(window.location.search).get("tab");
    if(requested==="profile"||requested==="vip"||requested==="login")setTab(requested);
    const openTab=(event:Event)=>{const requested=(event as CustomEvent<string>).detail;if(requested==="profile"||requested==="vip"||requested==="login")setTab(requested)};
    window.addEventListener("zuraas-settings-tab",openTab);
    void load();
    return()=>window.removeEventListener("zuraas-settings-tab",openTab);
  }, []);
  useEffect(()=>{
    if(!data||tab!=="vip"||window.location.hash!=="#vip-status")return;
    requestAnimationFrame(()=>document.getElementById("vip-status")?.scrollIntoView({behavior:"smooth",block:"center"}));
  },[data,tab]);
  useEffect(() => {
    if (!deviceLogoutConfirm) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setDeviceLogoutConfirm(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deviceLogoutConfirm, busy]);

  const persistProfile = async (sources?: { avatarSource?: string; coverSource?: string }) => {
    if (busy) return false;
    setBusy(true); setMessage("");
    try {
      const body = new FormData(); body.set("displayName", displayName); body.set("contactEmail", contactEmail);
      const nextAvatarSource = sources?.avatarSource ?? avatarSource;
      const nextCoverSource = sources?.coverSource ?? coverSource;
      if (nextAvatarSource) body.set("avatarSource", nextAvatarSource);
      if (nextCoverSource) body.set("coverSource", nextCoverSource);
      const response = await fetch("/api/app/settings/profile", { method: "POST", body });
      const result = await response.json() as { error?: string; profile?: ProfileUpdatedDetail | null };
      if (!response.ok) {
        setMessage(result.error || "Хадгалахад алдаа гарлаа");
        return false;
      }
      setAvatarSource(""); setCoverSource("");
      if (result.profile) {
        invalidateCachedJson("session");
        emitProfileUpdated(result.profile);
      }
      invalidateCachedJson("settings");
      await load(true);
      return true;
    } catch {
      setMessage("Зургийг хадгалахад алдаа гарлаа");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const chooseLibraryImage = async (option: ProfileMediaOption) => {
    const target = imagePicker;
    if (!target || busy) return;
    const previousPreview = target === "avatar" ? avatarPreview : coverPreview;
    if (target === "avatar") setAvatarPreview(option.url);
    else setCoverPreview(option.url);
    const saved = await persistProfile(target === "avatar" ? { avatarSource: option.url } : { coverSource: option.url });
    if (!saved) {
      if (target === "avatar") setAvatarPreview(previousPreview);
      else setCoverPreview(previousPreview);
      return;
    }
    setImagePicker(null);
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await persistProfile();
    if (saved) setMessage("Хувийн мэдээлэл хадгалагдлаа");
  };
  const confirmDeviceLogout = async () => {
    if (!deviceLogoutConfirm || busy) return;
    const pending = deviceLogoutConfirm;
    setBusy(true);
    setMessage("");
    try {
      const response = pending.kind === "others"
        ? await fetch("/api/app/settings/devices/logout-others", { method: "POST" })
        : await fetch(`/api/app/settings/devices/${encodeURIComponent(pending.deviceId)}/logout`, { method: "POST" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(result.error || "Төхөөрөмжөөс гаргахад алдаа гарлаа");
        return;
      }
      setDeviceLogoutConfirm(null);
      setMessage(pending.kind === "others" ? "Бусад төхөөрөмжүүдээс гарлаа" : "Төхөөрөмжөөс амжилттай гарлаа");
      invalidateCachedJson("settings");
      await load(true);
    } catch {
      setMessage("Төхөөрөмжөөс гаргахад алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
    const result = await response.json() as { error?: string }; setBusy(false);
    if (!response.ok) { setMessage(result.error || "Нууц үг солиход алдаа гарлаа"); return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setMessage("Нууц үг амжилттай солигдлоо");
  };
  const nav = [
    { id: "profile" as const, label: "Хувийн мэдээлэл", icon: UserRound },
    { id: "vip" as const, label: "VIP эрх", icon: Crown },
    { id: "login" as const, label: "Нэвтрэлт", icon: MonitorSmartphone, badge: data?.devices.length },
  ];
  const visibleNav = nav;
  if (!data) return <main className="settings-page"><div className="settings-loading">Тохиргоо ачаалж байна...</div></main>;

  const normalizedVipUntil = data.profile.vipUntil
    ? new Date(data.profile.vipUntil.replace(" ", "T") + (/Z$/.test(data.profile.vipUntil) ? "" : "Z"))
    : null;
  const vipActive = Boolean(normalizedVipUntil && !Number.isNaN(normalizedVipUntil.getTime()) && normalizedVipUntil.getTime() > Date.now());
  const vipExpiryText = normalizedVipUntil && !Number.isNaN(normalizedVipUntil.getTime())
    ? `${normalizedVipUntil.getFullYear()}-${normalizedVipUntil.getMonth() + 1}-${normalizedVipUntil.getDate()} ${String(normalizedVipUntil.getHours()).padStart(2, "0")}:${String(normalizedVipUntil.getMinutes()).padStart(2, "0")} цагт дуусна`
    : "";
  const configuredSocials = socialOptions.filter(({ key }) => Boolean(socials?.[key]));
  const pickerOptions = imagePicker === "avatar"
    ? data.mediaOptions?.avatars ?? []
    : data.mediaOptions?.covers ?? [];

  return <main className="settings-page">
    <header className="settings-title"><div><h1>Тохиргоо</h1></div></header>
    {message && <div className="settings-message">{message}</div>}
    <div className="settings-layout">
      <aside className="settings-nav">
        {visibleNav.map(({ id, label, icon: Icon, badge }) => <button className={`settings-nav-button settings-nav-${id} ${tab === id ? "active" : ""}`} onClick={() => { setTab(id); setMessage(""); }} key={id}><Icon size={17}/><span>{label}</span>{badge !== undefined && <b>{badge}</b>}<ChevronRight size={15}/></button>)}
      </aside>
      <section className="settings-content">
        {tab === "profile" && <>
          <form className="profile-settings" onSubmit={saveProfile}>
            <div className="settings-card profile-visual">
              <div className="profile-cover" style={coverPreview ? { backgroundImage: `linear-gradient(0deg,rgba(8,10,14,.35),rgba(8,10,14,.08)),url(${coverPreview})` } : undefined}>
                <div className="profile-cover-actions">
                  <button type="button" onClick={() => setImagePicker("cover")}><Images size={15}/> Бүтээлээс сонгох</button>
                </div>
              </div>
              <div className="profile-avatar-wrap">
                <div className="profile-avatar-large">
                  {avatarPreview ? <img src={avatarPreview} alt="Нүүр зураг"/> : <span>{displayName.slice(0, 2).toUpperCase()}</span>}
                  <button type="button" aria-label="Нүүр зураг сонгох" onClick={() => setImagePicker("avatar")}><Camera size={15}/></button>
                </div>
                <div><h2>{displayName}</h2><p>{contactEmail}</p></div>
              </div>
            </div>
            <div className="settings-card settings-form-card">
              <div className="settings-section-head"><UserRound size={19}/><div><h2>Хувийн мэдээлэл</h2></div></div>
              <label>Хэрэглэгчийн нэр<input value={displayName} onChange={event => setDisplayName(event.target.value)} minLength={2} maxLength={50} required/></label>
              <label>Имэйл хаяг<input type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} required/></label>
              <div className="settings-form-actions"><button disabled={busy}>{busy ? "Хадгалж байна..." : "Өөрчлөлт хадгалах"}</button></div>
            </div>
          </form>
          {data.profile.canChangePassword && <form className="settings-card security-card password-card" onSubmit={changePassword}><div className="password-card-copy"><span><KeyRound size={25}/></span><div><h2>Нууц үг солих</h2><p>Одоогийн нууц үгээ баталгаажуулаад шинэ нууц үгээ оруулна уу.</p></div></div><div className="password-fields"><input type="password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} placeholder="Одоогийн нууц үг" autoComplete="current-password" required/><input type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} placeholder="Шинэ нууц үг" autoComplete="new-password" minLength={8} required/><input type="password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="Шинэ нууц үгээ давтах" autoComplete="new-password" minLength={8} required/><button disabled={busy}><KeyRound size={16}/>{busy?"Хадгалж байна...":"Нууц үг шинэчлэх"}</button></div></form>}
          {configuredSocials.length > 0 && <nav className="mobile-social-links" aria-label="Сошиал хаягууд">{configuredSocials.map(({ key, label }) => <a className={`mobile-social-${key}`} href={socials?.[key]} target="_blank" rel="noreferrer" aria-label={label} title={label} key={key}><SocialBrandIcon brand={key} size={21}/></a>)}</nav>}
        </>}
        {tab === "login" && <div className="settings-card device-access-card">
          <div className="device-access-head"><div><h2>Идэвхтэй хандалтууд</h2><p>Таны бүртгэлээр нэвтэрсэн төхөөрөмжүүдийн жагсаалт. Сэжигтэй хандалт байвал шууд гаргана уу.</p></div><button type="button" onClick={() => setDeviceLogoutConfirm({ kind: "others" })} disabled={busy || data.devices.length < 2}><LogOut size={16}/> Бусад бүх төхөөрөмжөөс гарах</button></div>
          <div className="device-list">{data.devices.map(device => {
            const current = device.deviceId === data.currentDeviceId;
            return <article className={current ? "current" : ""} key={device.deviceId}>
              <i><Laptop size={20}/></i>
              <div className="device-copy">
                <div className="device-title"><b>{device.label}</b>{current && <span>ЭНЭ ТӨХӨӨРӨМЖ</span>}</div>
                <small><span>IP: {device.lastIp || "Тодорхойгүй"}</span><span className="device-meta-dot">•</span><span>Сүүлийн идэвх: {dateTime(device.lastSeenAt)}</span></small>
              </div>
              {!current && <button type="button" className="device-revoke" onClick={() => setDeviceLogoutConfirm({ kind: "device", deviceId: device.deviceId, label: device.label })} disabled={busy} aria-label={`${device.label} төхөөрөмжөөс гарах`} title="Төхөөрөмжөөс гарах"><Trash2 size={17}/></button>}
            </article>;
          })}</div>
        </div>}
        {tab === "vip" && <div className="settings-vip-tab">
          <div id="vip-status" className={`settings-vip-expiry ${vipActive ? "active" : ""}`}>
            <span><Crown size={21}/></span>
            <div className="settings-vip-expiry-copy">
              <small>VIP ЭРХИЙН ТӨЛӨВ</small>
              <strong>{vipActive ? "VIP эрх идэвхтэй" : "VIP эрх идэвхгүй"}</strong>
              <p>{vipActive
                ? "Таны VIP эрх энэ хугацаа хүртэл хүчинтэй."
                : data.profile.vipUntil
                  ? "Таны VIP эрхийн хугацаа дууссан байна."
                  : "Одоогоор VIP эрх идэвхжээгүй байна."}</p>
            </div>
            {normalizedVipUntil && !Number.isNaN(normalizedVipUntil.getTime()) && <div className="settings-vip-expiry-date">
              <small>{vipActive ? "ДУУСАХ ХУГАЦАА" : "ДУУССАН ХУГАЦАА"}</small>
              <strong>{vipExpiryText}</strong>
            </div>}
          </div>
          <section className="settings-vip-history" aria-labelledby="vip-history-title">
            <header>
              <span><Clock3 size={20}/></span>
              <div>
                <h2 id="vip-history-title">Эрх авсан түүх</h2>
                <p>Таны VIP эрх идэвхжсэн огноо, хугацаа болон төлөв.</p>
              </div>
              <b>{data.payments.length}</b>
            </header>
            {data.payments.length > 0 ? <div className="settings-vip-history-list">
              {data.payments.map(payment => {
                const expiresAt = payment.expiresAt ? new Date(payment.expiresAt.replace(" ", "T") + (/Z$/.test(payment.expiresAt) ? "" : "Z")) : null;
                const isActive = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now());
                const source = payment.source.toLowerCase().includes("admin") ? "Админаас олгосон" : "Төлбөрөөр авсан";
                return <article key={payment.id}>
                  <i><Crown size={18}/></i>
                  <div>
                    <strong>{payment.days} хоногийн VIP эрх</strong>
                    <span>{source}</span>
                  </div>
                  <dl>
                    <div><dt>Эрх авсан</dt><dd>{dateTime(payment.grantedAt)}</dd></div>
                    <div><dt>Дуусах хугацаа</dt><dd>{dateTime(payment.expiresAt)}</dd></div>
                  </dl>
                  <em className={isActive ? "active" : "expired"}>{isActive ? "Идэвхтэй" : "Дууссан"}</em>
                </article>;
              })}
            </div> : <div className="settings-vip-history-empty">
              <Clock3 size={25}/>
              <strong>Эрх авсан түүх байхгүй</strong>
              <p>VIP эрх идэвхжсэн мэдээлэл энд харагдана.</p>
            </div>}
          </section>
          <div className="settings-vip-purchase">
            <header><Crown size={21}/><div><h2>VIP эрх авах</h2><p>Багцаа сонгоод төлбөрийн мэдээллийн дагуу шилжүүлэг хийнэ.</p></div>{vipActive && <span><Clock3 size={14}/> {dateTime(data.profile.vipUntil)} хүртэл</span>}</header>
            <VipPurchaseFlow usercode={data.profile.usercode}/>
          </div>
        </div>}
      </section>
    </div>
    {imagePicker && <div className="profile-media-backdrop" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target) setImagePicker(null);
    }}>
      <section className="profile-media-picker" role="dialog" aria-modal="true" aria-labelledby="profile-media-title" aria-busy={busy}>
        <header>
          <span><Images size={21}/></span>
          <div>
            <h2 id="profile-media-title">{imagePicker === "avatar" ? "Нүүр зураг сонгох" : "Ковер зураг сонгох"}</h2>
            <p>{imagePicker === "avatar"
              ? "Нэмсэн бүтээлүүдийн дүрийн зургаас сонгоно."
              : "Нэмсэн бүтээлүүдийн ковер болон banner зургаас сонгоно."}</p>
          </div>
          <button type="button" onClick={() => setImagePicker(null)} aria-label="Хаах" disabled={busy}><X size={19}/></button>
        </header>
        <div className={`profile-media-grid profile-media-grid-${imagePicker}`}>
          {pickerOptions.map(option => {
            const selected = (imagePicker === "avatar" ? avatarPreview : coverPreview) === option.url;
            return <button type="button" className={selected ? "selected" : ""} onClick={() => void chooseLibraryImage(option)} disabled={busy} key={option.id}>
              <img src={option.url} alt=""/>
              <span><b>{option.title}</b><small>{option.kind === "character" ? "Дүр" : option.kind === "banner" ? "Banner зураг" : "Ковер зураг"}</small></span>
              {selected && <i><Check size={15}/></i>}
            </button>;
          })}
        </div>
        {pickerOptions.length === 0 && <div className="profile-media-empty">
          <Images size={30}/>
          <strong>Сонгох зураг алга байна</strong>
          <p>{imagePicker === "avatar"
            ? "Бүтээлд дүрийн зураг нэмэгдсэний дараа энд харагдана."
            : "Бүтээлд ковер эсвэл banner зураг нэмэгдсэний дараа энд харагдана."}</p>
        </div>}
      </section>
    </div>}
    {deviceLogoutConfirm && <div className="settings-confirm-backdrop" role="presentation" onMouseDown={event => {
      if (event.currentTarget === event.target && !busy) setDeviceLogoutConfirm(null);
    }}>
      <section className="settings-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="device-logout-title">
        <button type="button" className="settings-confirm-close" onClick={() => setDeviceLogoutConfirm(null)} disabled={busy} aria-label="Хаах"><X size={19}/></button>
        <span className="settings-confirm-icon"><LogOut size={24}/></span>
        <small>НЭВТРЭЛТИЙН УДИРДЛАГА</small>
        <h2 id="device-logout-title">{deviceLogoutConfirm.kind === "others"
          ? "Бусад бүх төхөөрөмжөөс гарах уу?"
          : `${deviceLogoutConfirm.label} төхөөрөмжөөс гарах уу?`}</h2>
        <p>{deviceLogoutConfirm.kind === "others"
          ? "Одоогийн төхөөрөмжөөс бусад бүх идэвхтэй нэвтрэлтийг хаана."
          : "Сонгосон төхөөрөмж дээрх идэвхтэй нэвтрэлтийг хаана."}</p>
        <div className="settings-confirm-actions">
          <button type="button" className="settings-confirm-cancel" onClick={() => setDeviceLogoutConfirm(null)} disabled={busy}>Цуцлах</button>
          <button type="button" className="settings-confirm-submit" onClick={() => void confirmDeviceLogout()} disabled={busy}><LogOut size={16}/>{busy ? "Гаргаж байна..." : "Гарах"}</button>
        </div>
      </section>
    </div>}
  </main>;
}
