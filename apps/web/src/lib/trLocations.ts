import citiesRaw from "@/data/tr/sehirler.json";
import districtsRaw from "@/data/tr/ilceler.json";
import postalCodesRaw from "@/data/tr/postaKodlari.json";

export type City = {
  sehir_id: string;
  sehir_adi: string;
};

export type District = {
  ilce_id: string;
  ilce_adi: string;
  sehir_id: string;
  sehir_adi?: string;
};

export type PostalCodeRow = {
  country_code?: string;
  zipcode?: string;
  place?: string;
  state?: string;
  state_code?: string;
  province?: string;
  province_code?: string;
  community?: string;
  community_code?: string;
  latitude?: string;
  longitude?: string;
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function toStr(v: unknown): string {
  return String(v ?? "").trim();
}

export function normalizeTRText(v: string): string {
  return toStr(v)
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}

export const CITIES: City[] = asArray<any>(citiesRaw)
  .map((x) => ({
    sehir_id: toStr(x?.sehir_id),
    sehir_adi: toStr(x?.sehir_adi),
  }))
  .filter((x) => x.sehir_id && x.sehir_adi)
  .sort((a, b) => a.sehir_adi.localeCompare(b.sehir_adi, "tr"));

export const DISTRICTS: District[] = asArray<any>(districtsRaw)
  .map((x) => ({
    ilce_id: toStr(x?.ilce_id),
    ilce_adi: toStr(x?.ilce_adi),
    sehir_id: toStr(x?.sehir_id),
    sehir_adi: x?.sehir_adi ? toStr(x.sehir_adi) : undefined,
  }))
  .filter((x) => x.ilce_id && x.ilce_adi && x.sehir_id)
  .sort((a, b) => a.ilce_adi.localeCompare(b.ilce_adi, "tr"));

export const POSTAL_CODES: PostalCodeRow[] = asArray<any>(postalCodesRaw)
  .map((x) => ({
    country_code: toStr(x?.country_code),
    zipcode: toStr(x?.zipcode),
    place: toStr(x?.place),
    state: toStr(x?.state),
    state_code: toStr(x?.state_code),
    province: toStr(x?.province),
    province_code: toStr(x?.province_code),
    community: toStr(x?.community),
    community_code: toStr(x?.community_code),
    latitude: toStr(x?.latitude),
    longitude: toStr(x?.longitude),
  }))
  .filter((x) => x.zipcode && x.state && x.province);

/** Şehir seçilince ilçeleri filtrele */
export function getDistrictsByCity(cityId: string): District[] {
  const id = toStr(cityId);
  if (!id) return [];
  return DISTRICTS.filter((d) => d.sehir_id === id);
}

/** Firestore’a hem id hem ad kaydetmek için yardımcı */
export function findCity(cityId: string): City | null {
  const id = toStr(cityId);
  if (!id) return null;
  return CITIES.find((c) => c.sehir_id === id) || null;
}

export function findDistrict(districtId: string): District | null {
  const id = toStr(districtId);
  if (!id) return null;
  return DISTRICTS.find((d) => d.ilce_id === id) || null;
}

export function findCityByName(cityName: string): City | null {
  const q = normalizeTRText(cityName);
  if (!q) return null;
  return CITIES.find((c) => normalizeTRText(c.sehir_adi) === q) || null;
}

export function findDistrictByName(cityId: string, districtName: string): District | null {
  const q = normalizeTRText(districtName);
  const id = toStr(cityId);
  if (!q || !id) return null;

  return (
    DISTRICTS.find(
      (d) => d.sehir_id === id && normalizeTRText(d.ilce_adi) === q
    ) || null
  );
}

/** Şehir + ilçe adına göre ilk eşleşen posta kodunu getir */
export function findPostalCodeByNames(cityName?: string, districtName?: string): string {
  const city = normalizeTRText(cityName || "");
  const district = normalizeTRText(districtName || "");

  if (!city || !district) return "";

  const exact = POSTAL_CODES.find(
    (x) =>
      normalizeTRText(x.state || "") === city &&
      normalizeTRText(x.province || "") === district
  );

  if (exact?.zipcode) return exact.zipcode;

  return "";
}

/** Şehir id + ilçe id ile posta kodu getir */
export function findPostalCodeByIds(cityId?: string, districtId?: string): string {
  const city = cityId ? findCity(cityId) : null;
  const district = districtId ? findDistrict(districtId) : null;

  if (!city || !district) return "";

  return findPostalCodeByNames(city.sehir_adi, district.ilce_adi);
}

/** Aynı ilçe için birden fazla posta kodu varsa hepsini döndür */
export function findAllPostalCodesByNames(cityName?: string, districtName?: string): string[] {
  const city = normalizeTRText(cityName || "");
  const district = normalizeTRText(districtName || "");

  if (!city || !district) return [];

  return POSTAL_CODES.filter(
    (x) =>
      normalizeTRText(x.state || "") === city &&
      normalizeTRText(x.province || "") === district
  )
    .map((x) => toStr(x.zipcode))
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

/** Mahalle/place bazlı daha detaylı arama */
export function findPostalCodeByPlace(
  cityName?: string,
  districtName?: string,
  placeName?: string
): string {
  const city = normalizeTRText(cityName || "");
  const district = normalizeTRText(districtName || "");
  const place = normalizeTRText(placeName || "");

  if (!city || !district || !place) return "";

  const exact = POSTAL_CODES.find(
    (x) =>
      normalizeTRText(x.state || "") === city &&
      normalizeTRText(x.province || "") === district &&
      normalizeTRText(x.place || "") === place
  );

  if (exact?.zipcode) return exact.zipcode;

  return findPostalCodeByNames(cityName, districtName);
}