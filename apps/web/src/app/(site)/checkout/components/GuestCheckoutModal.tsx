import { CITIES, getDistrictsByCity, findPostalCodeByIds } from "@/lib/trLocations";
import s from "../checkout.module.css";


type GuestForm = {
  email: string;
  invoiceType: "individual" | "company";
  firstName: string;
  lastName: string;
  phone: string;
  cityId: string;
  cityName: string;
  districtId: string;
  districtName: string;
  line1: string;
  line2: string;
  postalCode: string;
  nationalId: string;
  companyName: string;
  taxNumber: string;
  taxOffice: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  err: string;
  tUI: any;
  form: GuestForm;
  setForm: React.Dispatch<React.SetStateAction<GuestForm>>;
  onClose: () => void;
  onSubmit: () => void;
};

export default function GuestCheckoutModal({
  open,
  busy,
  err,
  tUI,
  form,
  setForm,
  onClose,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div className={s.modalBackdrop} onClick={() => !busy && onClose()}>
      <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={s.modalHead}>
          <div>
            <div className={s.modalKicker}>{tUI.guestModalKicker}</div>
            <h3 className={s.modalTitle}>{tUI.guestModalTitle}</h3>
            <p className={s.modalDesc}>{tUI.guestModalDesc}</p>
          </div>

          <button
            type="button"
            className={s.modalClose}
            onClick={() => !busy && onClose()}
          >
            ×
          </button>
        </div>

        {err ? <div className={s.alert}>{err}</div> : null}

        <div className={s.modalForm}>
          <label className={s.field}>
            <span>{tUI.email}</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder={tUI.emailPlaceholder}
            />
          </label>

          <label className={s.field}>
            <span>{tUI.invoiceType}</span>
            <select
              value={form.invoiceType}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  invoiceType: e.target.value === "company" ? "company" : "individual",
                  ...(e.target.value === "company"
                    ? { nationalId: "" }
                    : { companyName: "", taxNumber: "", taxOffice: "" }),
                }))
              }
            >
              <option value="individual">{tUI.individual}</option>
              <option value="company">{tUI.company}</option>
            </select>
          </label>

          <div className={s.grid2}>
            <label className={s.field}>
              <span>{tUI.firstName}</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </label>

            <label className={s.field}>
              <span>{tUI.lastName}</span>
              <input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </label>
          </div>

          <label className={s.field}>
            <span>{tUI.phone}</span>
            <input
              value={form.phone}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  phone: e.target.value.replace(/\D+/g, "").slice(0, 11),
                }))
              }
              inputMode="numeric"
              placeholder={tUI.phonePlaceholder}
            />
          </label>

          <div className={s.grid2}>
            <label className={s.field}>
              <span>{tUI.city}</span>
              <select
                value={form.cityId}
                onChange={(e) => {
                  const cityId = e.target.value;
                  const cityObj = CITIES.find((c) => c.sehir_id === cityId);

                  setForm((p) => ({
                    ...p,
                    cityId,
                    cityName: cityObj?.sehir_adi || "",
                    districtId: "",
                    districtName: "",
                    postalCode: "",
                  }));
                }}
              >
                <option value="">{tUI.selectCity}</option>
                {CITIES.map((c) => (
                  <option key={c.sehir_id} value={c.sehir_id}>
                    {c.sehir_adi}
                  </option>
                ))}
              </select>
            </label>

            <label className={s.field}>
              <span>{tUI.district}</span>
              <select
                value={form.districtId}
                onChange={(e) => {
                  const districtId = e.target.value;
                  const districtObj = getDistrictsByCity(form.cityId).find(
                    (d) => d.ilce_id === districtId
                  );
                  const postal = findPostalCodeByIds(form.cityId, districtId);

                  setForm((p) => ({
                    ...p,
                    districtId,
                    districtName: districtObj?.ilce_adi || "",
                    postalCode: postal || p.postalCode || "",
                  }));
                }}
                disabled={!form.cityId}
              >
                <option value="">
                  {form.cityId ? tUI.selectDistrict : tUI.selectCityFirst}
                </option>

                {getDistrictsByCity(form.cityId).map((d) => (
                  <option key={d.ilce_id} value={d.ilce_id}>
                    {d.ilce_adi}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={s.field}>
            <span>{tUI.addressLine1}</span>
            <input
              value={form.line1}
              onChange={(e) => setForm((p) => ({ ...p, line1: e.target.value }))}
              placeholder={tUI.addressLine1Placeholder}
            />
          </label>

          <label className={s.field}>
            <span>{tUI.addressLine2}</span>
            <input
              value={form.line2}
              onChange={(e) => setForm((p) => ({ ...p, line2: e.target.value }))}
              placeholder={tUI.addressLine2Placeholder}
            />
          </label>

          <label className={s.field}>
            <span>{tUI.postal}</span>
            <input
              value={form.postalCode}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  postalCode: e.target.value.replace(/\D+/g, "").slice(0, 5),
                }))
              }
              inputMode="numeric"
              placeholder="34000"
            />
          </label>

          {form.invoiceType === "individual" ? (
            <label className={s.field}>
              <span>{tUI.nationalIdOptional}</span>
              <input
                value={form.nationalId}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    nationalId: e.target.value.replace(/\D+/g, "").slice(0, 11),
                  }))
                }
                inputMode="numeric"
                placeholder="11111111111"
              />
            </label>
          ) : (
            <div className={s.grid2}>
              <label className={s.field}>
                <span>{tUI.companyName}</span>
                <input
                  value={form.companyName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, companyName: e.target.value }))
                  }
                />
              </label>

              <label className={s.field}>
                <span>{tUI.taxNumber}</span>
                <input
                  value={form.taxNumber}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      taxNumber: e.target.value.replace(/\D+/g, "").slice(0, 11),
                    }))
                  }
                  inputMode="numeric"
                />
              </label>

              <label className={s.field}>
                <span>{tUI.taxOffice}</span>
                <input
                  value={form.taxOffice}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, taxOffice: e.target.value }))
                  }
                />
              </label>
            </div>
          )}
        </div>

        <div className={s.modalActions}>
          <button
            type="button"
            className={s.ghostBtn}
            onClick={() => !busy && onClose()}
            disabled={busy}
          >
            {tUI.cancel}
          </button>

          <button
            type="button"
            className={s.primaryBtn}
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? tUI.creatingAccount : tUI.createAccountAndContinue}
          </button>
        </div>
      </div>
    </div>
  );
}