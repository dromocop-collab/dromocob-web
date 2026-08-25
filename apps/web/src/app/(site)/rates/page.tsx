// src/app/rates/page.tsx
"use client";

import RatesTable from "@/components/RatesTable";

export default function RatesPage() {
  return (
    <main className="px-container" style={{ padding: "28px 18px 56px" }}>
      <RatesTable />
    </main>
  );
}