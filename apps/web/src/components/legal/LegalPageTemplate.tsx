import Link from "next/link";

type LegalSection = {
  title: string;
  body: string;
};

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
};

const COMPANY_NAME =
  "DROMOCOB DEMO MAĞAZACILIK A.Ş.";
const COMPANY_ADDRESS =
  "İstanbul · Demo Showroom";
const COMPANY_EMAIL = "hello@dromocob.com";

export default function LegalPageTemplate({
  eyebrow,
  title,
  description,
  updatedAt,
  sections,
}: Props) {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-[#171717]">
      <section className="border-b border-black/5 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.18),_transparent_28%),linear-gradient(135deg,#fbf8f2_0%,#f4efe6_45%,#f8f5ef_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-14 md:px-8 lg:py-20">
          <div className="inline-flex rounded-full border border-[#d4af37]/25 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8f6a16] backdrop-blur">
            {eyebrow}
          </div>

          <h1 className="mt-5 text-4xl font-black tracking-[-0.03em] text-[#101828] md:text-6xl">
            {title}
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-[#475467] md:text-lg">
            {description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-[#667085]">
            <span className="rounded-full bg-white/80 px-4 py-2">
              Son güncelleme: {updatedAt}
            </span>
            <span className="rounded-full bg-white/80 px-4 py-2">
              Kurumsal Bilgilendirme
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12 md:px-8 lg:py-16">
        <div className="grid gap-6">
          {sections.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-black/6 bg-white p-7 shadow-[0_14px_40px_rgba(16,24,40,0.05)]"
            >
              <h2 className="text-2xl font-black tracking-[-0.02em] text-[#101828]">
                {item.title}
              </h2>
              <p className="mt-4 text-sm leading-8 text-[#475467] md:text-base">
                {item.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-black/6 bg-white p-7 shadow-[0_14px_40px_rgba(16,24,40,0.05)]">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#b3871b]">
              Kurumsal Bilgiler
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                  Şirket Unvanı
                </div>
                <div className="mt-1 text-sm font-semibold leading-7 text-[#101828]">
                  {COMPANY_NAME}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                  Adres
                </div>
                <div className="mt-1 text-sm font-semibold leading-7 text-[#101828]">
                  {COMPANY_ADDRESS}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                  E-posta
                </div>
                <div className="mt-1 text-sm font-semibold leading-7 text-[#101828]">
                  {COMPANY_EMAIL}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-black/6 bg-[linear-gradient(135deg,#0f1728_0%,#18243b_55%,#22304c_100%)] p-7 text-white shadow-[0_20px_60px_rgba(16,24,40,0.14)]">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#e6c874]">
              Destek ve İletişim
            </div>

            <h3 className="mt-4 text-2xl font-black tracking-[-0.02em]">
              Sorularınız için bizimle iletişime geçin
            </h3>

            <p className="mt-4 text-sm leading-8 text-white/78 md:text-base">
              Yasal metinler, sipariş süreçleri, gizlilik, iade veya kullanıcı hesabınızla
              ilgili sorularınız için iletişim ve destek kanallarımız üzerinden bize
              ulaşabilirsiniz.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/iletisim"
                className="inline-flex items-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#101828] transition hover:translate-y-[-1px]"
              >
                İletişim
              </Link>
              <a
                href={`mailto:${COMPANY_EMAIL}`}
                className="inline-flex items-center rounded-2xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-black text-white transition hover:bg-white/12"
              >
                {COMPANY_EMAIL}
              </a>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}