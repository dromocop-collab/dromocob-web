"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, BadgeCheck, PackageCheck, ShieldCheck } from "lucide-react";
import { useLocale } from "@/lib/useT";
import styles from "./homeEditorialHero.module.css";
import AppointmentModal from "@/components/appointments/AppointmentModal";

export default function HomeEditorialHero() {
  const loc = useLocale();
  const en = loc === "en";
  const [appointmentOpen, setAppointmentOpen] = useState(false);

  return (
    <section className={styles.section} aria-labelledby="home-editorial-hero-title">
      <div className={styles.hero}>
        <Image
          src="/home/home-editorial-hero-v1.jpg"
          alt={en ? "A refined lifestyle collection" : "Seçkin yaşam tarzı koleksiyonu"}
          fill
          priority
          sizes="100vw"
          className={styles.image}
        />
        <div className={styles.overlay} />
        <div className={styles.grain} />

        <div className={styles.copy}>
          <span className={styles.eyebrow}>{en ? "A new point of view" : "Tarzın yeni yorumu"}</span>
          <h1 id="home-editorial-hero-title" className={styles.title}>
            {en ? <>Timeless brilliance,<br /><i>modern presence.</i></> : <>Zamansız ışıltı,<br /><i>çağdaş bir duruş.</i></>}
          </h1>
          <p className={styles.text}>
            {en
              ? "Discover lifestyle shaped by master craftsmanship, certified quality and a distinctly modern point of view."
              : "Usta işçilik, sertifikalı kalite ve modern bir bakış açısıyla şekillenen seçkin özel ürünleri keşfedin."}
          </p>
          <div className={styles.actions}>
            <Link href="/shop" className={styles.primary}>{en ? "Explore collection" : "Koleksiyonu keşfet"}<ArrowUpRight size={17} /></Link>
            <button type="button" className={styles.secondary} onClick={() => setAppointmentOpen(true)}>{en ? "Book a private viewing" : "Özel randevu oluştur"}</button>
          </div>
        </div>

        <div className={styles.signature}>DROMOCOB <span>lifestyle</span></div>

        <div className={styles.assurances}>
          <span><BadgeCheck size={17} />{en ? "Certified lifestyle" : "Sertifikalı özel ürün"}</span>
          <span><ShieldCheck size={17} />{en ? "Secure payment" : "Güvenli ödeme"}</span>
          <span><PackageCheck size={17} />{en ? "Insured delivery" : "Sigortalı teslimat"}</span>
        </div>
      </div>
      <AppointmentModal open={appointmentOpen} onClose={() => setAppointmentOpen(false)} loc={loc} />
    </section>
  );
}
