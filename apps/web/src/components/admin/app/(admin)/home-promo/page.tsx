"use client";

import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import PromoDealSlidesEditor from "./PromoDealSlidesEditor";

function AdminHomePromoPageInner() {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>ADMIN • İÇERİK</div>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: "-0.02em" }}>
          Promo Slider
        </h1>
        <div style={{ opacity: 0.75 }}>
          Firestore: <b>site_options / home_settings</b> → <b>promoDealSlides</b>
        </div>
      </div>

      <PromoDealSlidesEditor />
    </div>
  );
}

export default function AdminHomePromoPage() {
  return (
    <AdminGate>
      <PermissionGate permission="home_settings">
        <AdminHomePromoPageInner />
      </PermissionGate>
    </AdminGate>
  );
}