"use client";

import { ArrowLeft } from "lucide-react";

export function MobileBackButton() {
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  };

  return <button className="mobile-detail-back" type="button" onClick={goBack} aria-label="Буцах"><ArrowLeft size={21}/></button>;
}
