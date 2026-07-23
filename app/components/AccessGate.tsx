"use client";

import { AlertTriangle, Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type View = "age" | "login" | "register";

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.35 12.2c0-.73-.06-1.43-.19-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.94 2.94v2.58h3.14c1.84-1.69 2.91-4.18 2.91-7.4Z"/>
    <path fill="#34A853" d="M12 21.7c2.62 0 4.83-.87 6.44-2.36l-3.14-2.58c-.87.58-1.98.93-3.3.93-2.53 0-4.68-1.71-5.45-4.01H3.31v2.66A9.72 9.72 0 0 0 12 21.7Z"/>
    <path fill="#FBBC05" d="M6.55 13.68A5.84 5.84 0 0 1 6.25 12c0-.58.1-1.14.3-1.68V7.66H3.31A9.7 9.7 0 0 0 2.3 12c0 1.56.37 3.04 1.01 4.34l3.24-2.66Z"/>
    <path fill="#EA4335" d="M12 6.31c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.36 9.36 0 0 0 12 2.3a9.72 9.72 0 0 0-8.69 5.36l3.24 2.66c.77-2.3 2.92-4.01 5.45-4.01Z"/>
  </svg>;
}

export function AccessGate({ authenticated, children }: { authenticated: boolean; children: ReactNode }) {
  const [view, setView] = useState<View>("age");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("authError");
    if (!oauthError) return;
    const messages: Record<string, string> = {
      google_config: "Google нэвтрэлт хараахан тохируулагдаагүй байна. Client ID болон Client Secret шаардлагатай.",
      google_state: "Google нэвтрэлтийн хүсэлтийг баталгаажуулж чадсангүй. Дахин оролдоно уу.",
      google_cancelled: "Google нэвтрэлтийг цуцаллаа.",
      google_failed: "Google хаягаар нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.",
    };
    setView("login");
    setError(messages[oauthError] || messages.google_failed);
    params.delete("authError");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>, mode: "login" | "register") => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = mode === "login"
      ? { identifier: data.get("identifier"), password: data.get("password"), remember: data.get("remember") === "on" }
      : { displayName: data.get("displayName"), email: data.get("email"), password: data.get("password"), confirmPassword: data.get("confirmPassword"), adult: data.get("adult") === "on", terms: data.get("terms") === "on" };
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error || "Нэвтрэхэд алдаа гарлаа."); setBusy(false); return; }
      window.location.reload();
    } catch {
      setError("Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.");
      setBusy(false);
    }
  };

  if (authenticated) return <>{children}</>;
  return <main className="access-gate">
    <div className="access-gate-glow one"/><div className="access-gate-glow two"/>
    {view === "age" && <section className="age-gate-card">
      <span className="age-alert"><AlertTriangle size={31}/></span>
      <h1>Насны баталгаажуулалт</h1>
      <p>Энэ вэбсайт нь насанд хүрэгчдэд зориулсан контент агуулсан болно.</p>
      <div className="age-mark"><b>18+</b><span>НАСАНД ХҮРЭГЧДЭД</span></div>
      <button className="gate-primary" onClick={() => { setView("login"); setError(""); }}>18-аас дээш настай — Нэвтрэх</button>
      <a className="gate-exit" href="https://www.google.com">18-аас доош настай — Гарах</a>
      <small>“Нэвтрэх” товчийг дарснаар та үйлчилгээний нөхцөлийг зөвшөөрч, насанд хүрэгчдэд зориулсан контент үзэх хууль ёсны эрхтэй гэдгээ баталж байна.</small>
    </section>}
    {view === "login" && <section className="auth-gate-card">
      <header><button onClick={() => { setView("age"); setError(""); }} aria-label="Хаах"><X size={20}/></button><img src="/logo-transparent.png" alt="Зураас"/><h1>Тавтай морил</h1><p>Зураас бүртгэлдээ нэвтэрч үргэлжлүүлнэ үү</p></header>
      <form onSubmit={event => submit(event, "login")}>
        <label>И-мэйл эсвэл хэрэглэгчийн нэр<div><Mail size={17}/><input name="identifier" type="text" autoComplete="username" placeholder="Мэйл эсвэл хэрэглэгчийн нэр" required/></div></label>
        <label>Нууц үг<div><LockKeyhole size={17}/><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Нууц үгээ оруулна уу" required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Нууц үг харах">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        <div className="auth-options"><label><input name="remember" type="checkbox"/>Намайг сана</label></div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Нэвтэрч байна..." : "Нэвтрэх"}</button>
      </form>
      <div className="auth-divider"><i/><span>ЭСВЭЛ</span><i/></div>
      <a className="google-auth" href="/api/auth/google"><GoogleMark/><span>Google-ээр нэвтрэх</span></a>
      <p className="auth-switch">Бүртгэлгүй юу? <button onClick={() => { setView("register"); setError(""); }}>Бүртгүүлэх</button></p>
    </section>}
    {view === "register" && <section className="auth-gate-card register-card">
      <header><button onClick={() => { setView("login"); setError(""); }} aria-label="Хаах"><X size={20}/></button><h1>Бүртгэл үүсгэх</h1><p>Зураас платформд өнөөдөр нэгдээрэй</p></header>
      <form onSubmit={event => submit(event, "register")}>
        <label>Хоч нэр<div><UserRound size={17}/><input name="displayName" type="text" autoComplete="nickname" placeholder="Нэр" minLength={2} maxLength={50} required/></div></label>
        <label>И-мэйл хаяг<div><Mail size={17}/><input name="email" type="email" autoComplete="email" placeholder="Мэйл хаяг" required/></div></label>
        <label>Нууц үг<div><LockKeyhole size={17}/><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Нууц үг" minLength={8} required/></div></label>
        <label>Баталгаажуулах<div><LockKeyhole size={17}/><input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Дахин оруулна уу" minLength={8} required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label="Нууц үг харах">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        <div className="register-checks"><label><input name="adult" type="checkbox" required/>Би 18 ба түүнээс дээш настай гэдгээ баталж байна</label><label><input name="terms" type="checkbox" required/>Би <a href="/terms">үйлчилгээний нөхцөлийг</a> зөвшөөрч байна</label></div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Үүсгэж байна..." : "Бүртгэл үүсгэх"}</button>
      </form>
      <div className="auth-divider"><i/><span>ЭСВЭЛ</span><i/></div>
      <a className="google-auth" href="/api/auth/google"><GoogleMark/><span>Google-ээр бүртгүүлэх</span></a>
      <p className="auth-switch">Бүртгэлтэй юу? <button onClick={() => { setView("login"); setError(""); }}>Нэвтрэх</button></p>
    </section>}
  </main>;
}
