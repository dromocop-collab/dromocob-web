"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query as fsQuery,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getIdTokenResult, onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import {
  defaultSubAdminPermissions,
  fullAdminPermissions,
  permissionLabels,
  type AdminPermissions,
  type AdminRole,
} from "@/lib/adminTypes";
import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import styles from "./permissions.module.css";

type ViewRole = AdminRole | "member";
type RoleFilter = "all" | ViewRole;

type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  role: ViewRole;
  isActive: boolean;
  permissions: AdminPermissions;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function roleRank(role: ViewRole) {
  if (role === "admin") return 0;
  if (role === "sub_admin") return 1;
  return 2;
}

function roleLabel(role: ViewRole) {
  if (role === "admin") return "Ana Admin";
  if (role === "sub_admin") return "Sub Admin";
  return "Üye";
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
    if (typeof v === "string") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === "number") return new Date(v);
    return null;
  } catch {
    return null;
  }
}

function fmtDate(v: any) {
  const d = toDateSafe(v);
  if (!d) return "—";

  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeRole(raw: any): ViewRole {
  const r = safeStr(raw);
  if (r === "admin" || r === "sub_admin") return r;
  return "member";
}

function buildPermissions(role: ViewRole, rawPerms: any): AdminPermissions {
  if (role === "admin") return { ...fullAdminPermissions };

  return {
    ...defaultSubAdminPermissions,
    ...(rawPerms || {}),
  };
}

function countEnabledPermissions(perms: AdminPermissions) {
  return permissionLabels.reduce((sum, p) => {
    return sum + (perms[p.key] ? 1 : 0);
  }, 0);
}

function AdminPermissionsPageInner() {
  const db = useMemo(() => getFirebaseDb(), []);
  const auth = useMemo(() => getFirebaseAuth(), []);

  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUid, setCurrentUid] = useState("");
  const [_currentIsMainAdmin, setCurrentIsMainAdmin] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

  const [savingUid, setSavingUid] = useState("");
  const [note, setNote] = useState("");
  const [noteTone, setNoteTone] = useState<"ok" | "bad" | "info">("info");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUid("");
        setCurrentIsMainAdmin(false);
        return;
      }

      setCurrentUid(user.uid);

      try {
        const token = await getIdTokenResult(user, true);
        const claims: any = token.claims || {};
        const roles = Array.isArray(claims.roles) ? claims.roles.map(String) : [];
        const claimRole = safeStr(claims.role);

        const isMain =
          claims.admin === true ||
          claimRole === "admin" ||
          roles.includes("admin");

        setCurrentIsMainAdmin(isMain);
      } catch {
        setCurrentIsMainAdmin(false);
      }
    });

    return () => unsub();
  }, [auth]);

  useEffect(() => {
    setLoading(true);

    const qy = fsQuery(collection(db, "users"), orderBy("email", "asc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const x = d.data() as any;

          const role = normalizeRole(x?.role);

          const displayName =
            safeStr(x?.displayName) ||
            `${safeStr(x?.firstName)} ${safeStr(x?.lastName)}`.trim() ||
            "İsimsiz Kullanıcı";

          return {
            uid: d.id,
            email: safeStr(x?.email),
            displayName,
            role,
            isActive: x?.isActive !== false,
            permissions: buildPermissions(role, x?.permissions),
            createdAt: x?.createdAt,
            updatedAt: x?.updatedAt,
            createdBy: safeStr(x?.createdBy),
          } as AdminUserRow;
        });

        rows.sort((a, b) => {
          const rr = roleRank(a.role) - roleRank(b.role);
          if (rr !== 0) return rr;

          const aa = a.email || a.displayName || a.uid;
          const bb = b.email || b.displayName || b.uid;

          return aa.localeCompare(bb, "tr");
        });

        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error("users snapshot error:", err);
        setItems([]);
        setLoading(false);
        setNoteTone("bad");
        setNote("Kullanıcılar alınırken hata oluştu.");
      }
    );

    return () => unsub();
  }, [db]);

  function showNote(text: string, tone: "ok" | "bad" | "info" = "info") {
    setNote(text);
    setNoteTone(tone);

    window.clearTimeout((showNote as any)._t);
    (showNote as any)._t = window.setTimeout(() => {
      setNote("");
    }, 3200);
  }

  function updateRole(uid: string, role: ViewRole) {
    setItems((prev) =>
      prev.map((x) => {
        if (x.uid !== uid) return x;

        if (x.uid === currentUid && x.role === "admin" && role !== "admin") {
          showNote("Kendini admin rolünden çıkaramazsın. Kanka güvenlik kemeri takılı.", "bad");
          return x;
        }

        if (role === "admin") {
          return {
            ...x,
            role,
            isActive: true,
            permissions: { ...fullAdminPermissions },
          };
        }

        if (role === "sub_admin") {
          return {
            ...x,
            role,
            isActive: true,
            permissions:
              x.role === "member"
                ? { ...defaultSubAdminPermissions }
                : {
                    ...defaultSubAdminPermissions,
                    ...x.permissions,
                  },
          };
        }

        return {
          ...x,
          role: "member",
          permissions: { ...defaultSubAdminPermissions },
        };
      })
    );
  }

  function toggleActive(uid: string) {
    setItems((prev) =>
      prev.map((x) => {
        if (x.uid !== uid) return x;

        if (x.uid === currentUid && x.role === "admin") {
          showNote("Kendini pasife alamazsın. Panelin anahtarı cebinde kalmalı.", "bad");
          return x;
        }

        return { ...x, isActive: !x.isActive };
      })
    );
  }

  function togglePerm(uid: string, key: keyof AdminPermissions) {
    setItems((prev) =>
      prev.map((x) =>
        x.uid === uid
          ? {
              ...x,
              permissions: {
                ...x.permissions,
                [key]: !x.permissions[key],
              },
            }
          : x
      )
    );
  }

  function applyPreset(uid: string, preset: "sales" | "catalog" | "content" | "support" | "fullSub") {
    setItems((prev) =>
      prev.map((x) => {
        if (x.uid !== uid) return x;
        if (x.role !== "sub_admin") return x;

        let permissions: AdminPermissions = { ...defaultSubAdminPermissions };

        if (preset === "sales") {
          permissions = {
            ...permissions,
            dashboard: true,
            orders: true,
            support: true,
          };
        }

        if (preset === "catalog") {
          permissions = {
            ...permissions,
            dashboard: true,
            products: true,
            categories: true,
            home_settings: true,
          };
        }

        if (preset === "content") {
          permissions = {
            ...permissions,
            dashboard: true,
            home_settings: true,
            footer_settings: true,
            pages_admin: true,
          };
        }

        if (preset === "support") {
          permissions = {
            ...permissions,
            dashboard: true,
            support: true,
            orders: true,
          };
        }

        if (preset === "fullSub") {
          permissions = {
            ...permissions,
            dashboard: true,
            orders: true,
            products: true,
            categories: true,
            home_settings: true,
            footer_settings: true,
            pages_admin: true,
            settings_admin: true,
            support: true,
            system: true,
          };
        }

        return {
          ...x,
          permissions,
        };
      })
    );
  }

  async function saveUser(user: AdminUserRow) {
    if (!user.uid) return;

    setSavingUid(user.uid);
    setNote("");

    try {
      const ref = doc(db, "users", user.uid);

      if (user.uid === currentUid && user.role !== "admin") {
        throw new Error("Kendini admin rolünden çıkaramazsın.");
      }

      if (user.uid === currentUid && user.isActive === false) {
        throw new Error("Kendini pasife alamazsın.");
      }

      if (user.role === "admin") {
        await setDoc(
          ref,
          {
            email: user.email || "",
            displayName: user.displayName || "",
            role: "admin",
            isActive: true,
            permissions: fullAdminPermissions,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else if (user.role === "sub_admin") {
        await setDoc(
          ref,
          {
            email: user.email || "",
            displayName: user.displayName || "",
            role: "sub_admin",
            isActive: user.isActive,
            permissions: {
              ...defaultSubAdminPermissions,
              ...user.permissions,
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await setDoc(
          ref,
          {
            email: user.email || "",
            displayName: user.displayName || "",
            role: deleteField(),
            permissions: deleteField(),
            isActive: user.isActive,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      showNote(`${user.email || user.displayName || user.uid} kaydedildi.`, "ok");
    } catch (e: any) {
      console.error("save user permission error:", e);
      showNote(e?.message || "Kayıt sırasında hata oluştu.", "bad");
    } finally {
      setSavingUid("");
    }
  }

  const filteredItems = useMemo(() => {
    const q = safeStr(search).toLocaleLowerCase("tr-TR");

    return items.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (activeOnly && !user.isActive) return false;

      if (!q) return true;

      const haystack = [
        user.displayName,
        user.email,
        user.uid,
        roleLabel(user.role),
        user.role,
        user.isActive ? "aktif" : "pasif",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      return haystack.includes(q);
    });
  }, [items, search, roleFilter, activeOnly]);

  const counts = useMemo(() => {
    const total = items.length;
    const admin = items.filter((x) => x.role === "admin").length;
    const subAdmin = items.filter((x) => x.role === "sub_admin").length;
    const member = items.filter((x) => x.role === "member").length;
    const passive = items.filter((x) => !x.isActive).length;

    return {
      total,
      admin,
      subAdmin,
      member,
      passive,
    };
  }, [items]);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBg} />

        <div className={styles.heroLeft}>
          <div className={styles.kicker}>DROMOCOB • ADMIN SECURITY</div>
          <h1 className={styles.title}>Yönetici Yetkileri</h1>
          <p className={styles.desc}>
            Kullanıcı rollerini, sub admin izinlerini ve panel erişimlerini tek
            merkezden yönet. Yanlış yetki = yanlış operasyon; burada kapı sağlam
            kilitlenir.
          </p>

          <div className={styles.heroBadges}>
            <span>Canlı kullanıcı okuma</span>
            <span>Rol bazlı erişim</span>
            <span>Sub admin preset</span>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span>Toplam</span>
            <strong>{counts.total}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.statAdmin}`}>
            <span>Admin</span>
            <strong>{counts.admin}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.statSub}`}>
            <span>Sub Admin</span>
            <strong>{counts.subAdmin}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.statMember}`}>
            <span>Üye</span>
            <strong>{counts.member}</strong>
          </div>

          <div className={`${styles.statCard} ${styles.statPassive}`}>
            <span>Pasif</span>
            <strong>{counts.passive}</strong>
          </div>
        </div>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kullanıcı ara: ad, e-posta, UID, rol..."
          />
        </div>

        <div className={styles.filterRow}>
          {[
            { key: "all", label: "Hepsi" },
            { key: "admin", label: "Admin" },
            { key: "sub_admin", label: "Sub Admin" },
            { key: "member", label: "Üye" },
          ].map((x) => (
            <button
              key={x.key}
              type="button"
              className={`${styles.filterBtn} ${
                roleFilter === x.key ? styles.filterBtnOn : ""
              }`}
              onClick={() => setRoleFilter(x.key as RoleFilter)}
            >
              {x.label}
            </button>
          ))}

          <button
            type="button"
            className={`${styles.filterBtn} ${activeOnly ? styles.filterBtnOn : ""}`}
            onClick={() => setActiveOnly((v) => !v)}
          >
            Sadece Aktif
          </button>
        </div>

        {note ? (
          <div
            className={`${styles.note} ${
              noteTone === "ok"
                ? styles.noteOk
                : noteTone === "bad"
                ? styles.noteBad
                : styles.noteInfo
            }`}
          >
            {note}
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className={styles.loadingGrid}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : (
        <section className={styles.list}>
          {filteredItems.map((user) => {
            const isAdmin = user.role === "admin";
            const isSubAdmin = user.role === "sub_admin";
            const isMember = user.role === "member";
            const isMe = user.uid === currentUid;
            const enabledPermCount = isAdmin
              ? permissionLabels.length
              : isMember
              ? 0
              : countEnabledPermissions(user.permissions);

            return (
              <article
                key={user.uid}
                className={`${styles.card} ${isAdmin ? styles.cardAdmin : ""} ${
                  !user.isActive ? styles.cardPassive : ""
                }`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.identity}>
                    <div className={styles.avatarWrap}>
                      <div className={styles.avatar}>
                        {(user.email || user.displayName || "U").charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`${styles.liveDot} ${
                          user.isActive ? styles.liveDotOn : styles.liveDotOff
                        }`}
                      />
                    </div>

                    <div className={styles.identityText}>
                      <div className={styles.nameRow}>
                        <h2>{user.displayName || "İsimsiz Kullanıcı"}</h2>

                        <span
                          className={`${styles.roleBadge} ${
                            isAdmin
                              ? styles.roleAdmin
                              : isSubAdmin
                              ? styles.roleSubAdmin
                              : styles.roleMember
                          }`}
                        >
                          {roleLabel(user.role)}
                        </span>

                        {isMe ? <span className={styles.meBadge}>Sen</span> : null}
                      </div>

                      <div className={styles.userMeta}>
                        {user.email || "E-posta yok"}
                      </div>

                      <div className={styles.userUid}>UID: {user.uid}</div>

                      <div className={styles.userDates}>
                        <span>Güncelleme: {fmtDate(user.updatedAt)}</span>
                        {user.createdBy ? <span>Oluşturan: {user.createdBy}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className={styles.controls}>
                    <label className={styles.controlField}>
                      <span>Rol</span>
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.uid, e.target.value as ViewRole)}
                        disabled={isMe && isAdmin}
                      >
                        <option value="member">Üye</option>
                        <option value="sub_admin">Sub Admin</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className={`${styles.stateBtn} ${
                        user.isActive ? styles.stateActive : styles.statePassive
                      }`}
                      onClick={() => toggleActive(user.uid)}
                      disabled={isMe && isAdmin}
                    >
                      <span />
                      {user.isActive ? "Aktif" : "Pasif"}
                    </button>

                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={() => saveUser(user)}
                      disabled={savingUid === user.uid}
                    >
                      {savingUid === user.uid ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                  </div>
                </div>

                <div className={styles.accessStrip}>
                  <div>
                    <span>Yetki Durumu</span>
                    <strong>
                      {isAdmin
                        ? "Tam erişim"
                        : isMember
                        ? "Panel erişimi yok"
                        : `${enabledPermCount} yetki açık`}
                    </strong>
                  </div>

                  <div>
                    <span>Hesap</span>
                    <strong>{user.isActive ? "Operasyona açık" : "Pasif"}</strong>
                  </div>

                  <div>
                    <span>Güvenlik</span>
                    <strong>{isMe ? "Kendi hesabın" : "Yönetilebilir"}</strong>
                  </div>
                </div>

                {isSubAdmin ? (
                  <div className={styles.presetRow}>
                    <span>Hızlı preset:</span>

                    <button type="button" onClick={() => applyPreset(user.uid, "sales")}>
                      Satış
                    </button>

                    <button type="button" onClick={() => applyPreset(user.uid, "catalog")}>
                      Katalog
                    </button>

                    <button type="button" onClick={() => applyPreset(user.uid, "content")}>
                      İçerik
                    </button>

                    <button type="button" onClick={() => applyPreset(user.uid, "support")}>
                      Destek
                    </button>

                    <button type="button" onClick={() => applyPreset(user.uid, "fullSub")}>
                      Full Sub
                    </button>
                  </div>
                ) : null}

                <div className={styles.permWrap}>
                  <div className={styles.permHead}>
                    <div>
                      <h3>Yetkiler</h3>
                      <p>
                        {isAdmin
                          ? "Admin kullanıcı tüm yetkilere otomatik sahiptir. Buradaki anahtarlar kilitli gösterilir."
                          : isMember
                          ? "Üye kullanıcıda admin panel yetkisi yoktur. Yetki vermek için sub_admin rolüne alın."
                          : "Sub admin kullanıcının erişeceği modülleri seç."}
                      </p>
                    </div>

                    <div className={styles.permCounter}>
                      {enabledPermCount}/{permissionLabels.length}
                    </div>
                  </div>

                  <div className={styles.permGrid}>
                    {permissionLabels.map((perm) => {
                      const checked = isAdmin
                        ? true
                        : isMember
                        ? false
                        : Boolean(user.permissions[perm.key]);

                      return (
                        <label
                          key={perm.key}
                          className={`${styles.permCard} ${
                            checked ? styles.permCardOn : ""
                          } ${isAdmin || isMember ? styles.permCardDisabled : ""}`}
                        >
                          <div className={styles.permTop}>
                            <div>
                              <strong>{perm.label}</strong>
                              <small>{String(perm.key)}</small>
                            </div>

                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isAdmin || isMember}
                              onChange={() => togglePerm(user.uid, perm.key)}
                            />
                          </div>

                          <div className={styles.permText}>{perm.desc}</div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}

          {!filteredItems.length ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>⌕</div>
              <strong>Kullanıcı bulunamadı</strong>
              <span>Arama veya filtreleri değiştir kanka, kayıt burada saklanmıyor.</span>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

export default function AdminPermissionsPage() {
  return (
    <AdminGate>
      <PermissionGate permission="users_admin">
        <AdminPermissionsPageInner />
      </PermissionGate>
    </AdminGate>
  );
}