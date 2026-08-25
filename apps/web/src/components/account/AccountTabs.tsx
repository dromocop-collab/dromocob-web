"use client";

import styles from "@/styles/account-tabs.module.css";

export type AccountTab =
  | "profile"
  | "addresses"
  | "orders"
  | "notifications"
  | "security";

export default function AccountTabs({
  tab,
  onChange,
  canWrite,
  loc,
}: {
  tab: AccountTab;
  onChange: (tab: AccountTab) => void;
  canWrite: boolean;
  loc: "tr" | "en";
}) {
  const tabs: Array<{ key: AccountTab; label: string; disabled?: boolean }> = [
    { key: "profile", label: loc === "en" ? "Profile" : "Profil" },
    {
      key: "addresses",
      label: loc === "en" ? "Addresses" : "Adresler",
      disabled: !canWrite,
    },
    {
      key: "orders",
      label: loc === "en" ? "Orders" : "Siparişler",
      disabled: !canWrite,
    },
    {
      key: "notifications",
      label: loc === "en" ? "Notifications" : "Bildirimler",
      disabled: !canWrite,
    },
    { key: "security", label: loc === "en" ? "Security" : "Güvenlik" },
  ];

  return (
    <div
      className={styles.wrap}
      role="tablist"
      aria-label={loc === "en" ? "Account tabs" : "Hesap sekmeleri"}
    >
      {tabs.map((item) => {
        const active = tab === item.key;
        const disabled = !!item.disabled;

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={disabled}
            className={[
              styles.tabBtn,
              active ? styles.tabBtnActive : "",
              disabled ? styles.tabBtnDisabled : "",
            ].join(" ")}
            onClick={() => {
              if (!disabled) onChange(item.key);
            }}
            disabled={disabled}
            title={
              disabled
                ? loc === "en"
                  ? "Verify email first"
                  : "Önce e-posta doğrula"
                : item.label
            }
          >
            <span className={styles.tabText}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}