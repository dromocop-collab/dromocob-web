// apps/web/src/components/partials/PixioHeader.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";

type MiniItem = {
  id: string;
  title?: string;
  price?: number;
  qty?: number;
  image?: string;
  slug?: string;
};

function moneyTRY(v: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(v);
}

export default function PixioHeader() {
  const router = useRouter();
  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);

  const [uid, setUid] = useState<string | null>(null);

  // offcanvas states
  const [menuOpen, setMenuOpen] = useState(false);   // LEFT
  const [cartOpen, setCartOpen] = useState(false);   // RIGHT
  const [searchOpen, setSearchOpen] = useState(false); // TOP

  const [tab, setTab] = useState<"cart" | "wish">("cart");

  const [q, setQ] = useState("");
  const [cartItems, setCartItems] = useState<MiniItem[]>([]);
  const [wishItems, setWishItems] = useState<MiniItem[]>([]);

  const anyOpen = menuOpen || cartOpen || searchOpen;

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  // cart realtime
  useEffect(() => {
    if (!uid) {
      setCartItems([]);
      return;
    }
    const ref = collection(db, "carts", uid, "items");
    const unsub = onSnapshot(ref, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MiniItem[];
      setCartItems(arr);
    });
    return () => unsub();
  }, [db, uid]);

  // wishlist realtime
  useEffect(() => {
    if (!uid) {
      setWishItems([]);
      return;
    }
    const ref = collection(db, "wishlists", uid, "items");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as MiniItem[];
        setWishItems(arr);
      },
      () => setWishItems([])
    );
    return () => unsub();
  }, [db, uid]);

  const cartCount = cartItems.reduce((s, it) => s + (Number(it.qty) || 1), 0);
  const wishCount = wishItems.length;

  const cartSubtotal = cartItems.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1),
    0
  );

  // body lock + ESC + resize behavior
  useEffect(() => {
    if (!anyOpen) {
      document.body.classList.remove("sb-open");
      return;
    }
    document.body.classList.add("sb-open");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setCartOpen(false);
        setSearchOpen(false);
      }
    };

    const onResize = () => {
      // desktop’a çıkınca mobil menüyü kapat
      if (window.innerWidth > 980) setMenuOpen(false);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("sb-open");
    };
  }, [anyOpen]);

  function closeAll() {
    setMenuOpen(false);
    setCartOpen(false);
    setSearchOpen(false);
  }

  function openCart(which: "cart" | "wish") {
    setTab(which);
    setCartOpen(true);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  function openSearch() {
    setSearchOpen(true);
    setMenuOpen(false);
    // cart açık kalmasın (Pixio gibi net olsun)
    setCartOpen(false);
  }

  function submitSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const s = q.trim();
    if (!s) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(s)}`);
  }

  async function inc(uid: string, id: string, currentQty: number) {
    await updateDoc(doc(db, "carts", uid, "items", id), { qty: (currentQty || 1) + 1 });
  }
  async function dec(uid: string, id: string, currentQty: number) {
    const next = (currentQty || 1) - 1;
    if (next <= 0) {
      await deleteDoc(doc(db, "carts", uid, "items", id));
      return;
    }
    await updateDoc(doc(db, "carts", uid, "items", id), { qty: next });
  }
  async function removeCart(uid: string, id: string) {
    await deleteDoc(doc(db, "carts", uid, "items", id));
  }
  async function removeWish(uid: string, id: string) {
    await deleteDoc(doc(db, "wishlists", uid, "items", id));
  }

  return (
    <>
      {/* HEADER */}
      <header className="px-header">
        <div className="px-container px-hwrap">
          {/* Mobile hamburger (LEFT MENU) */}
          <button
            className="px-hamb"
            type="button"
            aria-label="Open menu"
            onClick={() => {
              setMenuOpen(true);
              setCartOpen(false);
              setSearchOpen(false);
            }}
          >
            <span />
            <span />
          </button>

          <Link className="px-brand" href="/" aria-label="Home">
            <span className="px-logoMark" aria-hidden>◐</span>
            <span className="px-brandText">Pixio</span>
          </Link>

          {/* Desktop nav */}
          <nav className="px-nav" aria-label="Primary">
            <Link className="px-navLink" href="/">Home <span className="px-plus">+</span></Link>
            <Link className="px-navLink" href="/shop">Shop <span className="px-plus">+</span></Link>
            <Link className="px-navLink" href="/rates">Kurlar <span className="px-plus">+</span></Link>
            <Link className="px-navLink" href="/my-account">My Account <span className="px-plus">+</span></Link>
          </nav>

          <div className="px-right">
            <Link className="px-login" href={uid ? "/my-account" : "/login"}>
              {uid ? "My Account" : "Login / Register"}
            </Link>

            <button className="px-ic" type="button" aria-label="Search" onClick={openSearch}>
              🔍
            </button>

            <button className="px-ic" type="button" aria-label="Wishlist" onClick={() => openCart("wish")}>
              ♡
              {wishCount > 0 ? <span className="px-badge">{wishCount}</span> : null}
            </button>

            <button className="px-ic" type="button" aria-label="Cart" onClick={() => openCart("cart")}>
              🛒
              {cartCount > 0 ? <span className="px-badge">{cartCount}</span> : null}
            </button>

            <Link className="px-cta" href="/iletisim">Teklif Al</Link>
          </div>
        </div>
      </header>

      {/* BACKDROP (always under panels, above content) */}
      <div
        className={`px-backdrop ${anyOpen ? "is-open" : ""}`}
        onClick={closeAll}
        aria-hidden={!anyOpen}
      />

      {/* LEFT MENU DRAWER */}
      <aside
        className={`px-oc px-left ${menuOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!menuOpen}
      >
        <div className="px-ocHead">
          <div className="px-ocTitle">Menu</div>
          <button className="px-x" type="button" onClick={() => setMenuOpen(false)} aria-label="Close">✕</button>
        </div>

        <div className="px-ocBody">
          <button className="px-searchRow" type="button" onClick={openSearch}>
            <span className="px-searchPh">Search Product</span>
            <span className="px-searchIcon" aria-hidden>🔍</span>
          </button>

          <div className="px-menuList" role="navigation" aria-label="Mobile menu">
            <Link className="px-menuBtn" href="/" onClick={() => setMenuOpen(false)}>Anasayfa</Link>
            <Link className="px-menuBtn" href="/shop" onClick={() => setMenuOpen(false)}>Çok Satanlar</Link>
            <Link className="px-menuBtn" href="/rates" onClick={() => setMenuOpen(false)}>Kurlar</Link>
            <Link className="px-menuBtn" href="/my-account" onClick={() => setMenuOpen(false)}>My Account</Link>
          </div>

          <div className="px-menuSpacer" />

          <Link className="px-btnSolid w100" href="/shop" onClick={() => setMenuOpen(false)}>
            Shop →
          </Link>
        </div>
      </aside>

      {/* TOP SEARCH DRAWER */}
      <aside
        className={`px-oc px-top ${searchOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!searchOpen}
      >
        <div className="px-topInner">
          <button className="px-x px-topX" type="button" onClick={() => setSearchOpen(false)} aria-label="Close">
            ✕
          </button>

          <form className="px-topForm" onSubmit={submitSearch}>
            <select className="px-select" aria-label="Category">
              <option>All Categories</option>
              <option>Bileklik</option>
              <option>Yüzük</option>
              <option>Kolye</option>
              <option>Küpe</option>
            </select>

            <input
              className="px-topInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Product"
              autoFocus
            />

            <button className="px-topGo" type="submit" aria-label="Search">
              🔍
            </button>
          </form>

          <div className="px-quick2">
            <span className="px-muted">Quick Search :</span>
            <button className="px-quickLink" type="button" onClick={() => { setQ("bileklik"); submitSearch(); }}>
              Bileklik
            </button>
            <button className="px-quickLink" type="button" onClick={() => { setQ("yüzük"); submitSearch(); }}>
              Yüzük
            </button>
            <button className="px-quickLink" type="button" onClick={() => { setQ("kolye"); submitSearch(); }}>
              Kolye
            </button>
          </div>

          {/* Basit “You may also like” şeridi (placeholder) */}
          <div className="px-like">
            <div className="px-likeTitle">You May Also Like</div>
            <div className="px-likeRow">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="px-likeCard" key={i}>
                  <div className="px-likePh" />
                  <div className="px-likeMeta">
                    <b>Ürün</b>
                    <span className="px-muted">₺—</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT CART/WISHLIST DRAWER */}
      <aside
        className={`px-oc px-rightDrawer ${cartOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!cartOpen}
      >
        <div className="px-drawerHead">
          <div className="px-tabs">
            <button
              className={`px-tab ${tab === "cart" ? "is-active" : ""}`}
              onClick={() => setTab("cart")}
              type="button"
            >
              Shopping Cart <span className="px-tabBadge">{cartCount}</span>
            </button>

            <button
              className={`px-tab ${tab === "wish" ? "is-active" : ""}`}
              onClick={() => setTab("wish")}
              type="button"
            >
              Wishlist <span className="px-tabBadge">{wishCount}</span>
            </button>
          </div>

          <button className="px-x" type="button" onClick={() => setCartOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-drawerBody">
          {!uid ? (
            <div className="px-empty">
              <b>Giriş gerekli</b>
              <div className="px-muted">Devam etmek için giriş yap.</div>
              <div style={{ height: 12 }} />
              <Link className="px-btnSolid w100" href="/login" onClick={() => setCartOpen(false)}>
                Giriş Yap
              </Link>
            </div>
          ) : tab === "cart" ? (
            <>
              {cartItems.length === 0 ? (
                <div className="px-empty">
                  <b>Sepet boş</b>
                  <div className="px-muted">Hadi ürün ekleyelim.</div>
                  <div style={{ height: 12 }} />
                  <Link className="px-btnSolid w100" href="/shop" onClick={() => setCartOpen(false)}>
                    Shop →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="px-list">
                    {cartItems.map((it) => {
                      const qty = Number(it.qty) || 1;
                      const price = Number(it.price) || 0;

                      return (
                        <div key={it.id} className="px-item">
                          <div className="px-thumb">
                            {it.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.image} alt={it.title || "item"} />
                            ) : (
                              <div className="px-ph" />
                            )}
                          </div>

                          <div className="px-itemMid">
                            <div className="px-itemTitle">{it.title || "Ürün"}</div>

                            <div className="px-priceRow">
                              <div className="px-qtyCtrl">
                                <button onClick={() => dec(uid, it.id, qty)} type="button" aria-label="Decrease">
                                  −
                                </button>
                                <span>{qty}</span>
                                <button onClick={() => inc(uid, it.id, qty)} type="button" aria-label="Increase">
                                  +
                                </button>
                              </div>

                              <b>{moneyTRY(price)}</b>
                            </div>
                          </div>

                          <button
                            className="px-remove"
                            onClick={() => removeCart(uid, it.id)}
                            type="button"
                            aria-label="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-subtotal">
                    <span className="px-muted">Subtotal:</span>
                    <b>{moneyTRY(cartSubtotal)}</b>
                  </div>

                  <div className="px-drawerActions">
                    <Link className="px-btnOutline w100" href="/cart" onClick={() => setCartOpen(false)}>
                      View Cart
                    </Link>
                    <Link className="px-btnSolid w100" href="/checkout" onClick={() => setCartOpen(false)}>
                      Checkout
                    </Link>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {wishItems.length === 0 ? (
                <div className="px-empty">
                  <b>Wishlist boş</b>
                  <div className="px-muted">Beğendiğin ürünleri buraya ekle.</div>
                </div>
              ) : (
                <div className="px-list">
                  {wishItems.map((it) => (
                    <div key={it.id} className="px-item">
                      <div className="px-thumb">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image} alt={it.title || "wish"} />
                        ) : (
                          <div className="px-ph" />
                        )}
                      </div>

                      <div className="px-itemMid">
                        <div className="px-itemTitle">{it.title || "Ürün"}</div>
                        <div className="px-muted">{it.price ? moneyTRY(Number(it.price)) : ""}</div>

                        {it.slug ? (
                          <Link className="px-miniLink" href={`/p/${it.slug}`} onClick={() => setCartOpen(false)}>
                            View detail →
                          </Link>
                        ) : null}
                      </div>

                      <button
                        className="px-remove"
                        onClick={() => removeWish(uid!, it.id)}
                        type="button"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <style jsx global>{`
        :root{
          --px-ink:#111;
          --px-line:rgba(0,0,0,0.10);
          --px-bg:#fff;
          --px-sand:#fbf6ee;
        }

        /* ===== Header ===== */
        .px-header{
          position: sticky;
          top: 0;
          z-index: 120;
          background: var(--px-bg);
          border-bottom: 1px solid var(--px-line);
        }
        .px-container{ max-width: 1200px; margin: 0 auto; padding: 0 18px; }
        .px-hwrap{
          display:flex; align-items:center; justify-content:space-between; gap:18px;
          padding: 18px 0;
        }
        .px-hamb{
          display:none;
          width: 44px; height: 44px;
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.02);
          border-radius: 14px;
          cursor:pointer;
          position: relative;
        }
        .px-hamb span{
          position:absolute; left: 12px; right: 12px;
          height: 2px; background: #111; border-radius: 99px;
        }
        .px-hamb span:first-child{ top: 16px; }
        .px-hamb span:last-child{ top: 24px; opacity: .7; }

        .px-brand{ display:flex; align-items:center; gap:10px; text-decoration:none; color: var(--px-ink); }
        .px-logoMark{
          width: 34px; height:34px; border-radius: 12px;
          display:grid; place-items:center;
          background:#fbbb00; font-weight: 900;
        }
        .px-brandText{ font-weight:900; font-size:34px; letter-spacing:-0.8px; }
        .px-nav{ display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
        .px-navLink{
          text-decoration:none; color: var(--px-ink);
          font-weight:800; display:inline-flex; align-items:center; gap:6px;
        }
        .px-plus{ opacity:.5; font-weight:900; }
        .px-right{ display:flex; align-items:center; gap:12px; }
        .px-login{ text-decoration:none; color: var(--px-ink); font-weight:800; opacity:.8; margin-right:6px; }
        .px-ic{ border:0; background:transparent; cursor:pointer; font-size:18px; position:relative; }
        .px-badge{
          position:absolute; top:-10px; right:-10px;
          background:#ff2b2b; color:#fff;
          font-size:11px; padding:2px 6px;
          border-radius:999px; line-height:1.2; font-weight:900;
        }
        .px-cta{
          text-decoration:none;
          background: var(--px-ink);
          color:#fff;
          padding:10px 14px;
          border-radius:999px;
          font-weight:900;
        }

        /* ===== Backdrop ===== */
        .px-backdrop{
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          opacity: 0;
          pointer-events: none;
          z-index: 130; /* PANELLERİN ALTINDA */
          transition: opacity .18s ease;
        }
        .px-backdrop.is-open{
          opacity: 1;
          pointer-events: auto;
        }

        /* ===== Offcanvas base ===== */
        .px-oc{
          position: fixed;
          background: var(--px-sand);
          border: 1px solid rgba(0,0,0,0.10);
          box-shadow: 0 22px 60px rgba(0,0,0,0.18);
          z-index: 140; /* backdrop üstünde */
          transition: transform .22s ease, opacity .18s ease;
        }
        .px-ocHead{
          display:flex; align-items:center; justify-content:space-between;
          padding: 18px 18px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(10px);
        }
        .px-ocTitle{ font-weight: 1000; font-size: 18px; }
        .px-x{ border:0; background:transparent; cursor:pointer; font-size:20px; opacity:.75; }
        .px-ocBody{ padding: 18px; }

        /* LEFT (Menu) */
        .px-left{
          top:0; left:0; height:100vh;
          width: min(520px, 92vw);
          transform: translateX(-110%);
          border-top-right-radius: 22px;
          border-bottom-right-radius: 22px;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto 1fr;
        }
        .px-left.is-open{ transform: translateX(0); }

        .px-searchRow{
          width: 100%;
          display:flex; align-items:center; justify-content:space-between;
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(255,255,255,0.75);
          padding: 14px 16px;
          border-radius: 18px;
          cursor:pointer;
        }
        .px-searchPh{ font-weight: 800; opacity: .9; }
        .px-searchIcon{ opacity: .85; }
        .px-menuList{ margin-top: 14px; display:grid; gap: 12px; }
        .px-menuBtn{
          text-decoration:none; color:#111;
          font-weight: 1000; font-size: 22px;
          padding: 18px 18px;
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.10);
          background: rgba(255,255,255,0.75);
        }
        .px-menuSpacer{ height: 18px; }

        /* TOP (Search) */
        .px-top{
          left: 0; right: 0; top: 0;
          height: min(580px, 86vh);
          transform: translateY(-110%);
          border-bottom-left-radius: 22px;
          border-bottom-right-radius: 22px;
          overflow: auto;
          z-index: 145; /* hepsinin üstünde */
          background: var(--px-sand);
        }
        .px-top.is-open{ transform: translateY(0); }
        .px-topInner{ max-width: 1200px; margin: 0 auto; padding: 18px; position: relative; }
        .px-topX{ position:absolute; right: 18px; top: 12px; font-size: 22px; }

        .px-topForm{
          margin-top: 24px;
          display: grid;
          grid-template-columns: 240px 1fr auto;
          gap: 12px;
          align-items: center;
          border-bottom: 2px solid #111;
          padding-bottom: 14px;
        }
        .px-select{
          border: 0;
          background: transparent;
          font-weight: 900;
          font-size: 18px;
          outline: none;
        }
        .px-topInput{
          border: 0;
          background: transparent;
          font-size: 18px;
          font-weight: 800;
          outline: none;
          padding: 10px 0;
        }
        .px-topGo{
          width: 48px; height: 48px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.14);
          background: rgba(255,255,255,0.65);
          cursor:pointer;
          font-size: 18px;
        }

        .px-quick2{
          display:flex; gap: 14px; align-items:center; flex-wrap:wrap;
          padding: 14px 0;
        }
        .px-quickLink{
          border:0; background:transparent; cursor:pointer;
          font-weight: 900;
          opacity: .9;
        }

        .px-like{ margin-top: 14px; }
        .px-likeTitle{ font-weight: 1000; font-size: 18px; margin-bottom: 12px; }
        .px-likeRow{
          display:flex; gap: 16px;
          overflow:auto;
          padding-bottom: 8px;
        }
        .px-likeCard{
          min-width: 170px;
          background: rgba(255,255,255,0.75);
          border: 1px solid rgba(0,0,0,0.10);
          border-radius: 22px;
          padding: 14px;
        }
        .px-likePh{
          height: 160px;
          border-radius: 18px;
          background: rgba(0,0,0,0.12);
        }
        .px-likeMeta{
          display:flex; justify-content:space-between; align-items:center;
          margin-top: 10px;
          font-weight: 900;
        }

        /* RIGHT (Cart/Wish) */
        .px-rightDrawer{
          top:0; right:0; height:100vh;
          width: min(520px, 92vw);
          transform: translateX(110%);
          border-top-left-radius: 22px;
          border-bottom-left-radius: 22px;
          overflow: hidden;
          display:grid;
          grid-template-rows: auto 1fr;
          background:#fff;
        }
        .px-rightDrawer.is-open{ transform: translateX(0); }

        .px-drawerHead{
          display:flex; align-items:center; justify-content:space-between;
          padding: 14px 14px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          gap: 12px;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(10px);
        }
        .px-tabs{ display:flex; gap: 14px; align-items:center; }
        .px-tab{
          border:0; background:transparent; cursor:pointer;
          font-weight: 1000;
          opacity: .55;
          padding: 8px 0;
          border-bottom: 2px solid transparent;
        }
        .px-tab.is-active{ opacity: 1; border-bottom-color: #111; }
        .px-tabBadge{
          margin-left: 8px;
          background:#111; color:#fff;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 1000;
        }

        .px-drawerBody{ padding: 14px; overflow:auto; }
        .px-empty{ padding: 14px; border: 1px solid rgba(0,0,0,0.08); border-radius: 18px; background: rgba(0,0,0,0.02); }
        .px-muted{ color: rgba(17,17,17,0.65); }

        .px-list{ display:grid; gap: 14px; }
        .px-item{
          display:grid;
          grid-template-columns: 86px 1fr auto;
          gap: 12px;
          align-items: start;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .px-thumb{
          width: 86px; height: 86px;
          border-radius: 18px;
          overflow:hidden;
          background: rgba(0,0,0,0.08);
        }
        .px-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
        .px-ph{ width:100%; height:100%; background: rgba(0,0,0,0.14); }

        .px-itemTitle{ font-weight: 1000; font-size: 18px; line-height: 1.15; }
        .px-priceRow{ margin-top: 10px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .px-qtyCtrl{ display:inline-flex; align-items:center; gap: 10px; }
        .px-qtyCtrl button{
          width: 38px; height: 38px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.18);
          background:#fff;
          cursor:pointer;
          font-weight: 1000;
        }
        .px-qtyCtrl span{
          width: 40px; text-align:center; font-weight:1000;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.12);
          padding: 8px 0;
          background: rgba(0,0,0,0.02);
        }
        .px-remove{ border:0; background:transparent; cursor:pointer; font-size:20px; opacity:.7; }
        .px-miniLink{
          display:inline-block;
          margin-top: 8px;
          font-weight: 900;
          text-decoration:none;
          color:#111;
          opacity:.85;
        }

        .px-subtotal{
          display:flex; align-items:center; justify-content:space-between;
          padding: 14px 0;
          font-size: 18px;
        }
        .px-drawerActions{ display:grid; gap: 10px; padding-bottom: 8px; }

        /* Buttons */
        .w100{ width:100%; }
        .px-btnSolid{
          display:inline-flex; align-items:center; justify-content:center;
          gap:10px;
          text-decoration:none;
          border: 1px solid #111;
          background:#111; color:#fff;
          padding: 12px 14px;
          border-radius: 999px;
          font-weight: 1000;
          cursor:pointer;
        }
        .px-btnOutline{
          display:inline-flex; align-items:center; justify-content:center;
          gap:10px;
          text-decoration:none;
          border: 1px solid rgba(0,0,0,0.18);
          background:#fff; color:#111;
          padding: 12px 14px;
          border-radius: 999px;
          font-weight: 1000;
          cursor:pointer;
        }

        /* Lock scroll when open */
        body.sb-open{ overflow:hidden; }

        /* Responsive */
        @media (max-width: 980px){
          .px-nav{ display:none; }
          .px-login{ display:none; }
          .px-cta{ display:none; }
          .px-hamb{ display:inline-block; }
          .px-topForm{ grid-template-columns: 1fr auto; }
          .px-select{ display:none; }
        }
      `}</style>
    </>
  );
}