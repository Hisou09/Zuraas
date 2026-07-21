"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Chrome } from "./Chrome";

type VipData = { settings: { bankName:string; accountNumber:string; accountHolder:string; promotion:string; globalDiscount:number; accentColor:string }; packages: { id:number; name:string; durationDays:number; price:number }[] };

export function VipPage() {
  const [data,setData]=useState<VipData|null>(null); const [selected,setSelected]=useState<number|null>(null);
  useEffect(()=>{fetch("/api/app/vip").then(r=>r.json()).then((value:VipData)=>{setData(value);if(value.packages.length)setSelected(value.packages[0].id)}).catch(()=>null)},[]);
  const settings=data?.settings||{bankName:"Хаан банк",accountNumber:"0000 0000 0000",accountHolder:"Зураас ХХК",promotion:"",globalDiscount:0,accentColor:"#8b6cf6"};
  const active=useMemo(()=>data?.packages.find(p=>p.id===selected)||data?.packages[0],[data,selected]); const pay=active?Math.round(active.price*(1-(settings.globalDiscount||0)/100)):0;
  return <Chrome><main className="vip-page" style={{"--vip-accent":settings.accentColor} as CSSProperties}><section className="vip-hero"><span>♔ ZURAAS VIP</span><h1>VIP эрхээ сонгоорой</h1><p>Зар сурталчилгаагүй үзэж, VIP бүтээлүүд болон шинэ анги, бүлгийг түрүүлж нээгээрэй.</p></section><div className="vip-purchase-flow"><section><h2>1. Багцаа сонгох</h2><div className="package-grid">{data?.packages.map(p=><button className={`${selected===p.id?"selected":""}`} key={p.id} onClick={()=>setSelected(p.id)}><small>{p.durationDays} ХОНОГ</small><h3>{p.name}</h3><strong>{Math.round(p.price*(1-settings.globalDiscount/100)).toLocaleString()}₮</strong>{settings.globalDiscount>0&&<del>{p.price.toLocaleString()}₮</del>}<span>{selected===p.id?"✓ Сонгосон":"Сонгох"}</span></button>)}</div></section><section className="payment-section"><h2>2. Төлбөрөө шилжүүлэх</h2><div className="payment-layout"><aside className="bank-card"><small>ТӨЛБӨР ШИЛЖҮҮЛЭХ</small><h2>{settings.bankName}</h2><label>Дансны дугаар</label><strong>{settings.accountNumber}</strong><label>Данс эзэмшигч</label><b>{settings.accountHolder}</b></aside><div className="payment-summary"><small>СОНГОСОН БАГЦ</small><h3>{active?.name||"Багц сонгоно уу"}</h3><span>{active?.durationDays||0} хоногийн VIP эрх</span><label>Шилжүүлэх дүн</label><strong>{pay.toLocaleString()}₮</strong><p>Гүйлгээний утга дээр профайл дахь <b>6 оронтой usercode</b>-оо бичнэ үү.</p><button>Төлбөр шалгуулах</button></div></div></section></div></main></Chrome>;
}
