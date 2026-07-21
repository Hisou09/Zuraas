"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Chrome } from "./Chrome";

type VipData = { settings: { bankName: string; accountNumber: string; accountHolder: string; headline: string; promotion: string; accentColor: string }; packages: { id: number; name: string; durationDays: number; price: number; discountPercent: number }[] };

export function VipPage() {
  const [data, setData] = useState<VipData | null>(null);
  useEffect(() => { fetch("/api/app/vip").then((r) => r.json()).then(setData).catch(() => null); }, []);
  const s = data?.settings ?? { bankName: "Хаан банк", accountNumber: "0000 0000 0000", accountHolder: "Зураас ХХК", headline: "VIP ертөнцөд нэгдээрэй", promotion: "", accentColor: "#8b6cf6" };
  return <Chrome><main className="vip-page" style={{ "--vip-accent": s.accentColor } as React.CSSProperties}><section className="vip-hero"><span>♔ ZURAAS VIP</span><h1>{s.headline}</h1><p>Зар сурталчилгаагүй үзэж, VIP бүтээлүүд болон шинэ анги, бүлгийг түрүүлж нээгээрэй.</p>{s.promotion && <b>{s.promotion}</b>}</section><div className="vip-layout"><section><h2>Багцаа сонгох</h2><div className="package-grid">{data?.packages.length ? data.packages.map((p, index) => <article className={index === 1 ? "featured" : ""} key={p.id}>{p.discountPercent > 0 && <em>-{p.discountPercent}%</em>}<small>{p.durationDays} ХОНОГ</small><h3>{p.name}</h3><strong>{Math.round(p.price * (1 - p.discountPercent / 100)).toLocaleString()}₮</strong>{p.discountPercent > 0 && <del>{p.price.toLocaleString()}₮</del>}<button>Сонгох</button></article>) : <div className="vip-loading">Багц удахгүй нэмэгдэнэ</div>}</div></section><aside className="bank-card"><small>ТӨЛБӨР ШИЛЖҮҮЛЭХ</small><h2>{s.bankName}</h2><label>Дансны дугаар</label><strong>{s.accountNumber}</strong><label>Данс эзэмшигч</label><b>{s.accountHolder}</b><p>Гүйлгээний утгад бүртгэлтэй и-мэйл хаягаа бичнэ үү.</p></aside></div></main></Chrome>;
}
