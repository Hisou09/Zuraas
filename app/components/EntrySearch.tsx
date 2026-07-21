"use client";

import { useEffect } from "react";

export function EntrySearch(){
  useEffect(()=>{
    const input=document.querySelector<HTMLInputElement>(".entries .detail-heading input");
    if(!input)return;
    const filter=()=>{
      const query=input.value.trim().toLowerCase();
      document.querySelectorAll<HTMLElement>(".entries .episode-list>a,.entries .chapter-table>a").forEach(entry=>{
        entry.hidden=Boolean(query&&!entry.textContent?.toLowerCase().includes(query));
      });
    };
    input.addEventListener("input",filter);
    return()=>input.removeEventListener("input",filter);
  },[]);
  return null;
}
