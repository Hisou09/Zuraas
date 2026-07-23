"use client";

import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MobileBackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const goBack = () => {
    if (leaving) return;
    setLeaving(true);

    const current = `${window.location.pathname}${window.location.search}`;
    const previous = window.sessionStorage.getItem("zuraas-previous-route");
    let sameSiteReferrer = false;
    try {
      sameSiteReferrer = Boolean(document.referrer && new URL(document.referrer).origin === window.location.origin);
    } catch {/* use the safe fallback below */}

    if ((previous && previous !== current) || sameSiteReferrer) {
      window.history.back();
      window.setTimeout(() => {
        if (`${window.location.pathname}${window.location.search}` === current) router.replace(fallbackHref);
      }, 550);
      return;
    }

    router.replace(fallbackHref);
  };

  return <button className="mobile-detail-back" type="button" onClick={goBack} disabled={leaving} aria-label="Өмнөх хуудас руу буцах" title="Буцах"><ArrowLeft size={22}/></button>;
}
