"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Copy, Landmark, ShieldCheck, Sparkles } from "lucide-react";
import { Chrome } from "./Chrome";

type VipData = {
  settings: { bankName:string; accountNumber:string; accountHolder:string; promotion:string; globalDiscount:number; accentColor:string };
  packages: { id:number; name:string; durationDays:number; price:number }[];
};
type SessionData = { user?: { usercode?:string } };

export function VipPage() {
  const [data,setData]=useState<VipData|null>(null);
  const [selected,setSelected]=useState<number|null>(null);
  const [usercode,setUsercode]=useState("------");
  const [copied,setCopied]=useState("");

  useEffect(()=>{
    Promise.all([
      fetch("/api/app/vip").then(r=>r.json()),
      fetch("/api/app/session").then(r=>r.ok?r.json():null),
    ]).then(([vip,session]:[VipData,SessionData|null])=>{
      setData(vip);
      if(vip.packages.length)setSelected(vip.packages[0].id);
      if(session?.user?.usercode)setUsercode(session.user.usercode);
    }).catch(()=>null);
  },[]);

  const settings=data?.settings||{bankName:"Хаан банк",accountNumber:"0000 0000 0000",accountHolder:"Зураас ХХК",promotion:"",globalDiscount:0,accentColor:"#ffbd00"};
  const active=useMemo(()=>data?.packages.find(p=>p.id===selected)||data?.packages[0],[data,selected]);
  const pay=active?Math.round(active.price*(1-(settings.globalDiscount||0)/100)):0;
  const copy=async(value:string,key:string)=>{try{await navigator.clipboard.writeText(value);setCopied(key);window.setTimeout(()=>setCopied(""),1400)}catch{setCopied("")}};

  return <Chrome><main className="vip-page vip-checkout-page" style={{"--vip-accent":"#ffbd00"} as CSSProperties}>
    <div className="vip-purchase-flow">
      <section className="vip-package-grid" aria-label="VIP эрхийн багцууд">
        {data?.packages.map((pkg,index)=>{const current=selected===pkg.id;const price=Math.round(pkg.price*(1-settings.globalDiscount/100));return <button className={current?"selected":""} key={pkg.id} onClick={()=>setSelected(pkg.id)}>
          <i>{current?<Check size={20}/>:<Sparkles size={18}/>}</i>
          {index===1&&<em>ОНЦЛОХ</em>}
          <h3>{pkg.name}</h3>
          <strong>{price.toLocaleString()}₮</strong>
          {settings.globalDiscount>0&&<del>{pkg.price.toLocaleString()}₮</del>}
          <small>VIP бүрэн хандалт</small>
        </button>})}
      </section>

      <section className="vip-transfer-grid">
        <article className="vip-transfer-card bank-details">
          <header><i><Landmark size={19}/></i><div><small>АЛХАМ 1</small><h2>Шилжүүлэг хийх данс</h2></div></header>
          <div className="bank-detail-row"><span><small>БАНК</small><b>{settings.bankName}</b></span><button onClick={()=>copy(settings.bankName,"bank")} aria-label="Банкны нэр хуулах">{copied==="bank"?<Check size={18}/>:<Copy size={18}/>}</button></div>
          <div className="bank-detail-row"><span><small>ДАНСНЫ ДУГААР</small><b>{settings.accountNumber}</b></span><button onClick={()=>copy(settings.accountNumber,"account")} aria-label="Дансны дугаар хуулах">{copied==="account"?<Check size={18}/>:<Copy size={18}/>}</button></div>
          <div className="bank-detail-row"><span><small>ДАНС ЭЗЭМШИГЧ</small><b>{settings.accountHolder}</b></span><button onClick={()=>copy(settings.accountHolder,"holder")} aria-label="Данс эзэмшигч хуулах">{copied==="holder"?<Check size={18}/>:<Copy size={18}/>}</button></div>
        </article>

        <article className="vip-transfer-card transfer-purpose">
          <header><i><ShieldCheck size={19}/></i><div><small>АЛХАМ 2</small><h2>Шилжүүлгийн утга</h2></div></header>
          <div className="selected-package-summary"><span><small>СОНГОСОН БАГЦ</small><b>{active?.name||"Багц сонгоно уу"}</b></span><strong>{pay.toLocaleString()}₮</strong></div>
          <p>Доорх гүйлгээний утгыг (таны төлбөрийн код) шилжүүлгийн утга дээр яг хэвээр нь бичнэ үү.</p>
          <div className="usercode-copy"><span><small>ГҮЙЛГЭЭНИЙ УТГА (ТӨЛБӨРИЙН КОД)</small><b>{usercode}</b></span><button onClick={()=>copy(usercode,"code")} aria-label="Төлбөрийн код хуулах">{copied==="code"?<Check size={20}/>:<Copy size={20}/>}</button></div>
          <ol><li><b>{pay.toLocaleString()}₮</b>-ийг дээрх данс руу шилжүүлнэ.</li><li>Утга дээр зөвхөн өөрийн төлбөрийн кодоо бичнэ.</li><li>Төлбөр шалгагдсаны дараа админ VIP эрхийг идэвхжүүлнэ.</li></ol>
        </article>
      </section>
    </div>
  </main></Chrome>;
}
