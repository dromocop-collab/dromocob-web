"use client";
import Link from "next/link";
import { ArrowUpRight, Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";
import s from "./studioChrome.module.css";
export default function StudioHeader(){const[open,setOpen]=useState(false);return <header className={s.header}><div className={s.headerInner}><Link href="/" className={s.brand}><span>D</span><div><b>DROMOCOB</b><small>digital experience studio</small></div></Link><nav className={open?s.navOpen:""}><Link href="/#tasarimlar">Tasarımlar</Link><Link href="/#category-title">Sektörler</Link><Link href="/hakkimizda">Stüdyo</Link><Link href="/iletisim">İletişim</Link><button onClick={()=>setOpen(false)}><X/></button></nav><div className={s.actions}><Link href="/iletisim"><Sparkles/> Proje başlat <ArrowUpRight/></Link><button onClick={()=>setOpen(true)}><Menu/></button></div></div></header>}
