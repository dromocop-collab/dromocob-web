import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import "@/styles/globals.css";
import "@/components/admin/ui/toast.css";
import ControlGate from "@/components/dromocob-control/control-gate";
import { getSeoSettings, resolveBaseUrl } from "@/lib/getSeoSettings";
import { getTrackingSettings } from "@/lib/trackingSettings.server";
import CookieConsent from "@/components/CookieConsent";
import MetaPixelRouteEvents from "@/components/meta/MetaPixelRouteEvents";
import AnalyticsTracker from "@/components/AnalyticsTracker";

export const dynamic = "force-dynamic";

function splitKeywords(v?: string) {
  return String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildGoogleBot(seo: Awaited<ReturnType<typeof getSeoSettings>>) {
  const robots = seo.robots;
  const raw = String(robots.googlebot || "").trim();

  if (raw) return raw;

  const parts: string[] = [];
  parts.push(robots.index ? "index" : "noindex");
  parts.push(robots.follow ? "follow" : "nofollow");

  if (typeof robots.maxSnippet === "number") {
    parts.push(`max-snippet:${robots.maxSnippet}`);
  }

  if (robots.maxImagePreview) {
    parts.push(`max-image-preview:${robots.maxImagePreview}`);
  }

  if (typeof robots.maxVideoPreview === "number") {
    parts.push(`max-video-preview:${robots.maxVideoPreview}`);
  }

  return parts.join(", ");
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const baseUrl = resolveBaseUrl(seo);
  const metadataBase = baseUrl ? new URL(baseUrl) : undefined;
  const keywords = splitKeywords(
    [seo.meta.defaultKeywords, seo.meta.brandAliases].filter(Boolean).join(", ")
  );

  return {
    metadataBase,
    title: {
      default: seo.meta.defaultTitle,
      template: seo.meta.titleTemplate || "Dromocob",
    },
    description: seo.meta.defaultDescription,
    keywords: keywords.length ? keywords : undefined,
    applicationName: seo.meta.appName || undefined,
    authors: seo.meta.author ? [{ name: seo.meta.author }] : undefined,
    creator: seo.meta.author || undefined,
    publisher: seo.meta.publisher || undefined,
    referrer: "origin-when-cross-origin",
    category: "lifestyle",
    robots: {
      index: seo.robots.index,
      follow: seo.robots.follow,
      googleBot: buildGoogleBot(seo),
    },
    alternates: {
      canonical: baseUrl || undefined,
    },
    openGraph: {
      title: seo.meta.defaultTitle,
      description: seo.meta.defaultDescription,
      url: baseUrl || undefined,
      siteName: seo.jsonld.organizationName || seo.meta.publisher || "Dromocob",
      locale: seo.openGraph.locale,
      type: seo.openGraph.defaultType === "product" ? "website" : "website",
      images: seo.meta.defaultOgImage
        ? [
          {
            url: seo.meta.defaultOgImage,
            alt: seo.meta.defaultTitle,
          },
        ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: seo.meta.defaultTitle,
      description: seo.meta.defaultDescription,
      images: seo.meta.defaultOgImage ? [seo.meta.defaultOgImage] : undefined,
      creator: seo.meta.twitterHandle || undefined,
    },
    verification: {
      google: seo.google.searchConsoleVerification || undefined,
    },

    icons: {
      icon: [
        { url: "/dromocob-mark.svg", type: "image/svg+xml", sizes: "any" },
      ],
      shortcut: "/dromocob-mark.svg",
      apple: [
        { url: "/dromocob-mark.svg", type: "image/svg+xml", sizes: "any" },
      ],
    },
  };
}
export async function generateViewport(): Promise<Viewport> {
  const seo = await getSeoSettings();

  return {
    themeColor: seo.meta.themeColor || "#0b0b0b",
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const seo = await getSeoSettings();
  const tracking = await getTrackingSettings();

  const gtmId = String(seo.google.tagManagerId || "").trim();
  const gaId = String(seo.google.analyticsMeasurementId || "").trim();
  const metaPixelId = (tracking.meta.enabled ? tracking.meta.pixelId : "") || String(process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
  const metaDomainVerification = tracking.meta.domainVerification || String(process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION || "ef3uxvbjae85z47h456x0v5dlwvxsr").trim();
  const gadsId = tracking.googleAds.enabled ? tracking.googleAds.conversionId : "";
  const useGtm = !!gtmId;
  const useGa = !!gaId;
  const useGads = !!gadsId && !useGtm;

  const baseUrl = resolveBaseUrl(seo);

  const organizationJsonLd =
    seo.jsonld.enabled
      ? {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: seo.jsonld.organizationName || "Dromocob",
        alternateName: (seo.meta.brandAliases || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        url: baseUrl || undefined,
        logo: seo.jsonld.organizationLogo || undefined,
        sameAs: Array.isArray(seo.jsonld.sameAs) ? seo.jsonld.sameAs : [],
        contactPoint: seo.jsonld.phone
          ? [
            {
              "@type": "ContactPoint",
              telephone: seo.jsonld.phone,
              contactType: "customer service",
              areaServed: seo.jsonld.addressCountry || "TR",
              availableLanguage: ["tr", "en"],
            },
          ]
          : undefined,
        email: seo.jsonld.email || undefined,
        address:
          seo.jsonld.addressLocality || seo.jsonld.addressCountry
            ? {
              "@type": "PostalAddress",
              addressLocality: seo.jsonld.addressLocality || undefined,
              addressCountry: seo.jsonld.addressCountry || undefined,
            }
            : undefined,
        priceRange: seo.jsonld.priceRange || undefined,
      }
      : null;

  return (
    <html lang="tr">
      <head>
        {metaDomainVerification ? (
          <meta name="facebook-domain-verification" content={metaDomainVerification} />
        ) : null}
        {/* Apple Smart App Banner — Safari iOS native indirme banner'ı */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {useGtm ? (
          <>
            <Script id="gtm-head" strategy="afterInteractive">
              {`
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${gtmId}');
              `}
            </Script>

            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
              />
            </noscript>
          </>
        ) : null}

        {useGa ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        ) : null}
        {metaPixelId ? (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');

        fbq('init', '${metaPixelId}');
        fbq('track', 'PageView');
      `}
            </Script>

            <Suspense fallback={null}>
              <MetaPixelRouteEvents />
            </Suspense>
          </>
        ) : null}
        {useGads ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gadsId}`}
              strategy="afterInteractive"
            />
            <Script id="gads-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gadsId}');
              `}
            </Script>
          </>
        ) : null}
        {organizationJsonLd ? (
          <Script
            id="jsonld-organization"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationJsonLd),
            }}
          />
        ) : null}

        {/* WebSite JSON-LD — Sitelinks Search Box desteği */}
        {baseUrl ? (
          <Script
            id="jsonld-website"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: seo.jsonld.organizationName || "Dromocob",
                alternateName: (seo.meta.brandAliases || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                url: baseUrl,
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${baseUrl}/search?q={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              }),
            }}
          />
        ) : null}

        {/* LocalBusiness (lifestyleStore) JSON-LD — Yerel arama ve Google Maps */}
        {seo.jsonld.enabled ? (
          <Script
            id="jsonld-local-business"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "lifestyleStore",
                name: "Bizim Dromocob",
                image: seo.jsonld.organizationLogo || undefined,
                url: baseUrl || undefined,
                telephone: seo.jsonld.phone || "+90 555 000 00 00",
                email: seo.jsonld.email || "hello@dromocob.com",
                priceRange: seo.jsonld.priceRange || "₺₺₺",
                address: {
                  "@type": "PostalAddress",
                  streetAddress: "Demo Showroom",
                  addressLocality: "İstanbul",
                  addressRegion: "İstanbul",
                  postalCode: "48303",
                  addressCountry: "TR",
                },
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: 36.621195,
                  longitude: 29.110598,
                },
                openingHoursSpecification: [
                  {
                    "@type": "OpeningHoursSpecification",
                    dayOfWeek: [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ],
                    opens: "09:00",
                    closes: "20:00",
                  },
                ],
                sameAs: Array.isArray(seo.jsonld.sameAs)
                  ? seo.jsonld.sameAs
                  : [],
              }),
            }}
          />
        ) : null}

        <ControlGate>{children}</ControlGate>

        <CookieConsent />

        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
