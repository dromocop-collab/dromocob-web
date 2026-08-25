"use client";

import { usePathname } from "next/navigation";
import ChatWidget from "@/components/ChatWidget/ChatWidget";
import FloatingButtons from "@/components/FloatingButtons";
import OpeningPopup from "@/components/OpeningPopup";

export default function PublicFloatingLayer() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      <OpeningPopup />
      <FloatingButtons />
      <ChatWidget loc="tr" />
    </>
  );
}
