"use client";

import s from "../builder.module.css";

export default function LegacyHtmlPanel({
  htmlTr,
  htmlEn,
  setHtmlTr,
  setHtmlEn,
}: {
  htmlTr: string;
  htmlEn: string;
  setHtmlTr: (v: string) => void;
  setHtmlEn: (v: string) => void;
}) {
  return (
    <div className={s.card}>
      <b className={s.miniTitle}>HTML (Legacy) — TR/EN</b>
      <div className={s.grid2}>
        <div>
          <div className={s.miniTitle}>TR (HTML)</div>
          <textarea className={s.textarea} value={htmlTr} onChange={(e) => setHtmlTr(e.target.value)} />
        </div>
        <div>
          <div className={s.miniTitle}>EN (HTML)</div>
          <textarea className={s.textarea} value={htmlEn} onChange={(e) => setHtmlEn(e.target.value)} />
        </div>
      </div>
      <div className={s.hint}>Blocks kullanıyorsan HTML’i boş bırakabilirsin.</div>
    </div>
  );
}