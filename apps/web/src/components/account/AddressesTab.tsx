"use client";

import { CITIES, findPostalCodeByIds } from "@/lib/trLocations";
import styles from "@/styles/account-addresses-tab.module.css";

type Address = {
  id: string;
  title?: string;

  invoiceType?: "individual" | "company";

  firstName?: string;
  lastName?: string;
  phone?: string;

  nationalId?: string;

  companyName?: string;
  taxNumber?: string;
  taxOffice?: string;

  line1?: string;
  line2?: string;
  cityId?: string;
  cityName?: string;
  districtId?: string;
  districtName?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
};

type AddressErrors = Partial<Record<keyof Address, string>>;

function onlyDigits(v: string) {
  return String(v || "").replace(/\D+/g, "");
}

function formatPhoneTR(v: string) {
  const d = onlyDigits(v).slice(0, 11);

  if (!d) return "";
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (d.length < 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}



function validateAddressForm(a: Address, loc: "tr" | "en"): AddressErrors {
  const errors: AddressErrors = {};

  const title = String(a.title || "").trim();
  const invoiceType = String(a.invoiceType || "individual").trim() as "individual" | "company";

  const firstName = String(a.firstName || "").trim();
  const lastName = String(a.lastName || "").trim();
  const phone = onlyDigits(a.phone || "");
  const nationalId = onlyDigits(a.nationalId || "");

  const companyName = String(a.companyName || "").trim();
  const taxNumber = onlyDigits(a.taxNumber || "");
  const taxOffice = String(a.taxOffice || "").trim();


  const line1 = String(a.line1 || "").trim();
  const cityId = String(a.cityId || "").trim();
  const districtId = String(a.districtId || "").trim();
  const postalCode = onlyDigits(a.postalCode || "").trim();


  if (!title) {
    errors.title = loc === "en" ? "Address title is required." : "Adres başlığı zorunlu.";
  }

  if (!phone) {
    errors.phone = loc === "en" ? "Phone is required." : "Telefon zorunlu.";
  } else if (!(phone.length === 10 || phone.length === 11)) {
    errors.phone = loc === "en" ? "Enter a valid phone number." : "Geçerli bir telefon gir.";
  }

if (!firstName) {
  errors.firstName =
    loc === "en" ? "Recipient first name is required." : "Alıcı adı zorunlu.";
}

if (!lastName) {
  errors.lastName =
    loc === "en" ? "Recipient last name is required." : "Alıcı soyadı zorunlu.";
}

if (invoiceType === "individual") {
  if (nationalId && nationalId.length !== 11) {
    errors.nationalId =
      loc === "en"
        ? "National ID must be 11 digits."
        : "TC kimlik no 11 haneli olmalı.";
  }
}

  if (invoiceType === "company") {
    if (!companyName) {
      errors.companyName =
        loc === "en" ? "Company name is required." : "Firma adı zorunlu.";
    }

    if (!taxNumber) {
      errors.taxNumber =
        loc === "en" ? "Tax number is required." : "Vergi numarası zorunlu.";
    } else if (!(taxNumber.length === 10 || taxNumber.length === 11)) {
      errors.taxNumber =
        loc === "en"
          ? "Enter a valid tax number."
          : "Geçerli bir vergi numarası gir.";
    }

    if (!taxOffice) {
      errors.taxOffice =
        loc === "en" ? "Tax office is required." : "Vergi dairesi zorunlu.";
    }

    
  }

  if (!line1) {
    errors.line1 =
      loc === "en" ? "Address line is required." : "Adres satırı zorunlu.";
  }

  if (!cityId) {
    errors.cityId = loc === "en" ? "Select city." : "Şehir seç.";
  }

  if (!districtId) {
    errors.districtId = loc === "en" ? "Select district." : "İlçe seç.";
  }

  if (!postalCode) {
    errors.postalCode =
      loc === "en" ? "Postal code is required." : "Posta kodu zorunlu.";
  } else if (postalCode.length !== 5) {
    errors.postalCode =
      loc === "en" ? "Postal code must be 5 digits." : "Posta kodu 5 haneli olmalı.";
  }



  return errors;
}

export default function AddressesTab({
  loc,
  editing,
  setEditing,
  addresses,
  districtOptions,
  aBusy,
  aMsg,
  canWrite,
  lockMsg,
  onStartAdd,
  onStartEdit,
  onSave,
  onCancel,
  onSetCity,
  onSetDistrict,
  onMakeDefault,
  onDelete,
}: {
  loc: "tr" | "en";
  editing: Address | null;
  setEditing: React.Dispatch<React.SetStateAction<Address | null>>;
  addresses: Address[];
  districtOptions: any[];
  aBusy: boolean;
  aMsg: string | null;
  canWrite: boolean;
  lockMsg: string;
  onStartAdd: () => void;
  onStartEdit: (a: Address) => void;
  onSave: () => void;
  onCancel: () => void;
  onSetCity: (cityId: string) => void;
  onSetDistrict: (districtId: string) => void;
  onMakeDefault: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const errors = editing ? validateAddressForm(editing, loc) : {};
  const hasErrors = editing ? Object.keys(errors).length > 0 : false;
const saveBlockReason = !canWrite
  ? lockMsg || "Yazma yetkisi yok."
  : aBusy
  ? (loc === "en" ? "Saving..." : "Kaydediliyor...")
  : hasErrors
  ? Object.values(errors)[0] || (loc === "en" ? "Complete required fields." : "Zorunlu alanları tamamla.")
  : "";
const text = {
  title: loc === "en" ? "Addresses" : "Adresler",
  desc:
    loc === "en"
      ? "Manage your saved shipping addresses."
      : "Kayıtlı teslimat adreslerini yönet.",
  add: loc === "en" ? "+ Add address" : "+ Adres ekle",

  invoiceType: loc === "en" ? "Invoice type" : "Fatura tipi",
  individual: loc === "en" ? "Individual" : "Bireysel",
  company: loc === "en" ? "Company" : "Kurumsal",

  addressTitle: loc === "en" ? "Address title" : "Adres başlığı",
  recipientFirstName: loc === "en" ? "Recipient first name" : "Alıcı adı",
  recipientLastName: loc === "en" ? "Recipient last name" : "Alıcı soyadı",
  phone: loc === "en" ? "Phone" : "Telefon",

  city: loc === "en" ? "City" : "Şehir",
  district: loc === "en" ? "District" : "İlçe",
  selectCity: loc === "en" ? "Select city" : "Şehir seç",
  selectDistrict: loc === "en" ? "Select district" : "İlçe seç",
  selectCityFirst: loc === "en" ? "Select city first" : "Önce şehir seç",

  line1: loc === "en" ? "Address line 1" : "Adres satırı 1",
  line2: loc === "en" ? "Address line 2 (optional)" : "Adres satırı 2 (opsiyonel)",
  postalCode: loc === "en" ? "Postal code" : "Posta kodu",

  nationalId: loc === "en" ? "National ID (optional)" : "TC Kimlik No (opsiyonel)",
  companyName: loc === "en" ? "Company name" : "Firma adı",
  taxNumber: loc === "en" ? "Tax number" : "Vergi numarası",
  taxOffice: loc === "en" ? "Tax office" : "Vergi dairesi",

  setDefault: loc === "en" ? "Set as default address" : "Varsayılan adres yap",
  save: loc === "en" ? "Save address" : "Adresi kaydet",
  saving: loc === "en" ? "Saving..." : "Kaydediliyor...",
  cancel: loc === "en" ? "Cancel" : "Vazgeç",
  edit: loc === "en" ? "Edit" : "Düzenle",
  makeDefault: loc === "en" ? "Make default" : "Varsayılan yap",
  delete: loc === "en" ? "Delete" : "Sil",
  default: loc === "en" ? "Default" : "Varsayılan",

  noAddressTitle: loc === "en" ? "No addresses yet." : "Henüz adres yok.",
  noAddressText:
    loc === "en"
      ? "Add an address to speed up checkout."
      : "Ödeme sürecini hızlandırmak için bir adres ekle.",
  completeRequired:
    loc === "en" ? "Complete required fields." : "Zorunlu alanları tamamla.",
};

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{text.title}</h2>
          <p className={styles.desc}>{text.desc}</p>
        </div>

        {!editing ? (
          <button
            className={styles.secondaryBtn}
            onClick={onStartAdd}
            type="button"
            disabled={!canWrite}
            title={!canWrite ? lockMsg : ""}
          >
            {text.add}
          </button>
        ) : null}
      </div>

      {aMsg ? <div className={styles.alert}>{aMsg}</div> : null}

      {editing ? (
        <div className={styles.formWrap}>
  <div className={styles.grid}>
    <div className={styles.field}>
      <span>{text.invoiceType}</span>

      <div className={styles.segmented}>
        <button
          type="button"
          className={`${styles.segmentBtn} ${
            (editing.invoiceType || "individual") === "individual"
              ? styles.segmentBtnActive
              : ""
          }`}
         onClick={() =>
  setEditing((prev) =>
    prev
      ? {
          ...prev,
          invoiceType: "individual",
          companyName: "",
          taxNumber: "",
          taxOffice: "",
        }
      : prev
  )
}
          disabled={!canWrite}
        >
          {text.individual}
        </button>

        <button
          type="button"
          className={`${styles.segmentBtn} ${
            editing.invoiceType === "company" ? styles.segmentBtnActive : ""
          }`}
          onClick={() =>
            setEditing((prev) =>
              prev
                ? {
                    ...prev,
                    invoiceType: "company",
                    nationalId: "",
                  }
                : prev
            )
          }
          disabled={!canWrite}
        >
          {text.company}
        </button>
      </div>
    </div>

    <label className={styles.field}>
      <span>{text.addressTitle}</span>
      <input
        className={`${styles.input} ${errors.title ? styles.inputError : ""}`}
        value={editing.title || ""}
        onChange={(e) =>
          setEditing((prev) => ({
            ...(prev as Address),
            title: e.target.value,
          }))
        }
        placeholder={loc === "en" ? "Home / Office" : "Ev / Ofis"}
        disabled={!canWrite}
      />
      {errors.title ? <small className={styles.error}>{errors.title}</small> : null}
    </label>

    <label className={styles.field}>
      <span>{text.recipientFirstName}</span>
      <input
        className={`${styles.input} ${errors.firstName ? styles.inputError : ""}`}
        value={editing.firstName || ""}
        onChange={(e) =>
          setEditing((prev) => ({
            ...(prev as Address),
            firstName: e.target.value,
          }))
        }
        disabled={!canWrite}
      />
      {errors.firstName ? (
        <small className={styles.error}>{errors.firstName}</small>
      ) : null}
    </label>

    <label className={styles.field}>
      <span>{text.recipientLastName}</span>
      <input
        className={`${styles.input} ${errors.lastName ? styles.inputError : ""}`}
        value={editing.lastName || ""}
        onChange={(e) =>
          setEditing((prev) => ({
            ...(prev as Address),
            lastName: e.target.value,
          }))
        }
        disabled={!canWrite}
      />
      {errors.lastName ? (
        <small className={styles.error}>{errors.lastName}</small>
      ) : null}
    </label>

    <label className={styles.field}>
      <span>{text.phone}</span>
      <input
        className={`${styles.input} ${errors.phone ? styles.inputError : ""}`}
        value={formatPhoneTR(editing.phone || "")}
        onChange={(e) =>
          setEditing((prev) => ({
            ...(prev as Address),
            phone: onlyDigits(e.target.value).slice(0, 11),
          }))
        }
        inputMode="numeric"
        placeholder="05xx xxx xx xx"
        disabled={!canWrite}
      />
      {errors.phone ? <small className={styles.error}>{errors.phone}</small> : null}
    </label>

    <label className={styles.field}>
      <span>{text.city}</span>
      <select
        className={`${styles.input} ${errors.cityId ? styles.inputError : ""}`}
        value={editing.cityId || ""}
        onChange={(e) => {
          const cityId = e.target.value;
          onSetCity(cityId);

          setEditing((prev) =>
            prev
              ? {
                  ...prev,
                  cityId,
                  districtId: "",
                  districtName: "",
                  postalCode: "",
                }
              : prev
          );
        }}
        disabled={!canWrite}
      >
        <option value="">{text.selectCity}</option>
        {CITIES.map((c) => (
          <option key={c.sehir_id} value={c.sehir_id}>
            {c.sehir_adi}
          </option>
        ))}
      </select>
      {errors.cityId ? <small className={styles.error}>{errors.cityId}</small> : null}
    </label>

    <label className={styles.field}>
      <span>{text.district}</span>
      <select
        className={`${styles.input} ${errors.districtId ? styles.inputError : ""}`}
        value={editing.districtId || ""}
        onChange={(e) => {
          const districtId = e.target.value;
          onSetDistrict(districtId);

          const postalCode = findPostalCodeByIds(editing.cityId || "", districtId);

          setEditing((prev) =>
            prev
              ? {
                  ...prev,
                  districtId,
                  postalCode: postalCode || prev.postalCode || "",
                }
              : prev
          );
        }}
        disabled={!canWrite || !editing.cityId}
      >
        <option value="">
          {editing.cityId ? text.selectDistrict : text.selectCityFirst}
        </option>
        {districtOptions.map((d) => (
          <option key={d.ilce_id} value={d.ilce_id}>
            {d.ilce_adi}
          </option>
        ))}
      </select>
      {errors.districtId ? (
        <small className={styles.error}>{errors.districtId}</small>
      ) : null}
    </label>
  </div>

  <label className={styles.field}>
    <span>{text.line1}</span>
    <input
      className={`${styles.input} ${errors.line1 ? styles.inputError : ""}`}
      value={editing.line1 || ""}
      onChange={(e) =>
        setEditing((prev) => ({
          ...(prev as Address),
          line1: e.target.value,
        }))
      }
      placeholder={loc === "en" ? "Street, building, no..." : "Mahalle, sokak, no..."}
      disabled={!canWrite}
    />
    {errors.line1 ? <small className={styles.error}>{errors.line1}</small> : null}
  </label>

  <label className={styles.field}>
    <span>{text.line2}</span>
    <input
      className={styles.input}
      value={editing.line2 || ""}
      onChange={(e) =>
        setEditing((prev) => ({
          ...(prev as Address),
          line2: e.target.value,
        }))
      }
      placeholder={loc === "en" ? "Apartment, floor..." : "Daire, kat..."}
      disabled={!canWrite}
    />
  </label>

  <div className={styles.grid}>
    <label className={styles.field}>
      <span>{text.postalCode}</span>
      <input
        className={`${styles.input} ${errors.postalCode ? styles.inputError : ""}`}
        value={editing.postalCode || ""}
        onChange={(e) =>
          setEditing((prev) => ({
            ...(prev as Address),
            postalCode: onlyDigits(e.target.value).slice(0, 5),
          }))
        }
        inputMode="numeric"
        maxLength={5}
        disabled={!canWrite}
        placeholder="34000"
      />
      {errors.postalCode ? (
        <small className={styles.error}>{errors.postalCode}</small>
      ) : null}
    </label>
  </div>

  {(editing.invoiceType || "individual") === "individual" ? (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span>{text.nationalId}</span>
        <input
          className={`${styles.input} ${errors.nationalId ? styles.inputError : ""}`}
          value={editing.nationalId || ""}
          onChange={(e) =>
            setEditing((prev) => ({
              ...(prev as Address),
              nationalId: onlyDigits(e.target.value).slice(0, 11),
            }))
          }
          inputMode="numeric"
          maxLength={11}
          placeholder="11111111111"
          disabled={!canWrite}
        />
        {errors.nationalId ? (
          <small className={styles.error}>{errors.nationalId}</small>
        ) : null}
      </label>
    </div>
  ) : (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span>{text.companyName}</span>
        <input
          className={`${styles.input} ${errors.companyName ? styles.inputError : ""}`}
          value={editing.companyName || ""}
          onChange={(e) =>
            setEditing((prev) => ({
              ...(prev as Address),
              companyName: e.target.value,
            }))
          }
          disabled={!canWrite}
        />
        {errors.companyName ? (
          <small className={styles.error}>{errors.companyName}</small>
        ) : null}
      </label>

      <label className={styles.field}>
        <span>{text.taxNumber}</span>
        <input
          className={`${styles.input} ${errors.taxNumber ? styles.inputError : ""}`}
          value={editing.taxNumber || ""}
          onChange={(e) =>
            setEditing((prev) => ({
              ...(prev as Address),
              taxNumber: onlyDigits(e.target.value).slice(0, 11),
            }))
          }
          inputMode="numeric"
          maxLength={11}
          placeholder="1234567890"
          disabled={!canWrite}
        />
        {errors.taxNumber ? (
          <small className={styles.error}>{errors.taxNumber}</small>
        ) : null}
      </label>

      <label className={styles.field}>
        <span>{text.taxOffice}</span>
        <input
          className={`${styles.input} ${errors.taxOffice ? styles.inputError : ""}`}
          value={editing.taxOffice || ""}
          onChange={(e) =>
            setEditing((prev) => ({
              ...(prev as Address),
              taxOffice: e.target.value,
            }))
          }
          disabled={!canWrite}
        />
        {errors.taxOffice ? (
          <small className={styles.error}>{errors.taxOffice}</small>
        ) : null}
      </label>
    </div>
  )}

  <label className={styles.switchRow}>
    <input
      type="checkbox"
      checked={Boolean(editing.isDefault)}
      onChange={(e) =>
        setEditing((prev) => ({
          ...(prev as Address),
          isDefault: e.target.checked,
        }))
      }
      disabled={!canWrite}
    />
    <span>{text.setDefault}</span>
  </label>

  <div className={styles.actions}>
    {saveBlockReason ? (
  <div className={styles.alert}>
    {saveBlockReason}
  </div>
) : null}
    <button
      className={styles.primaryBtn}
      type="button"
      onClick={onSave}
      disabled={aBusy || !canWrite || hasErrors}
      title={!canWrite ? lockMsg : hasErrors ? text.completeRequired : ""}
    >
      {aBusy ? text.saving : text.save}
    </button>

    <button
      className={styles.secondaryBtn}
      type="button"
      onClick={onCancel}
      disabled={aBusy}
    >
      {text.cancel}
    </button>
  </div>
</div>
      ) : (
        <div className={styles.addressGrid}>
          {addresses.length ? (
            addresses.map((a) => {
              const full = `${a.firstName || ""} ${a.lastName || ""}`.trim() || "-";

              return (
                <article key={a.id} className={styles.addressItem}>
                  <div className={styles.addressHead}>
                    <div>
                      <div className={styles.addressTitle}>
                        {a.title || (loc === "en" ? "Address" : "Adres")}
                      </div>
                      <div className={styles.addressMeta}>{full}</div>
                    </div>

                    {a.isDefault ? (
                      <div className={styles.defaultBadge}>{text.default}</div>
                    ) : null}
                  </div>

                  <div className={styles.addressBody}>
                    <div>{a.phone || "-"}</div>
                    <div>{a.line1 || ""}</div>
                    {a.line2 ? <div>{a.line2}</div> : null}
                    <div>
                      {[a.districtName, a.cityName, a.postalCode, a.country]
                        .filter(Boolean)
                        .join(" / ")}
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.miniBtn}
                      onClick={() => onStartEdit(a)}
                      disabled={!canWrite || aBusy}
                      type="button"
                    >
                      {text.edit}
                    </button>

                    <button
                      className={styles.miniBtn}
                      onClick={() => onMakeDefault(a.id)}
                      disabled={!canWrite || aBusy}
                      type="button"
                    >
                      {text.makeDefault}
                    </button>

                    <button
                      className={styles.miniDangerBtn}
                      onClick={() => onDelete(a.id)}
                      disabled={!canWrite || aBusy}
                      type="button"
                    >
                      {text.delete}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className={styles.emptyCard}>
              <div className={styles.emptyTitle}>{text.noAddressTitle}</div>
              <div className={styles.emptyText}>{text.noAddressText}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}