/**
 * Spanish tax ids (NIF/NIE/CIF) and EU VAT numbers.
 * Validation is used to warn the user, never to block a save: real-world
 * invoices (and OCR output) are messy.
 */

export const EU_COUNTRIES: Record<string, string> = {
  AT: "Austria",
  BE: "Bélgica",
  BG: "Bulgaria",
  CY: "Chipre",
  CZ: "Chequia",
  DE: "Alemania",
  DK: "Dinamarca",
  EE: "Estonia",
  ES: "España",
  FI: "Finlandia",
  FR: "Francia",
  GR: "Grecia",
  HR: "Croacia",
  HU: "Hungría",
  IE: "Irlanda",
  IT: "Italia",
  LT: "Lituania",
  LU: "Luxemburgo",
  LV: "Letonia",
  MT: "Malta",
  NL: "Países Bajos",
  PL: "Polonia",
  PT: "Portugal",
  RO: "Rumanía",
  SE: "Suecia",
  SI: "Eslovenia",
  SK: "Eslovaquia",
};

export function isEuCountry(country: string): boolean {
  return country.toUpperCase() in EU_COUNTRIES;
}

/** An operation is intra-community when the other party is in another EU member state. */
export function isIntraCommunityCountry(country: string): boolean {
  const c = country.toUpperCase();
  return c !== "ES" && isEuCountry(c);
}

export function countryName(country: string): string {
  return EU_COUNTRIES[country.toUpperCase()] ?? country.toUpperCase();
}

export function normalizeTaxId(value: string): string {
  return value.toUpperCase().replace(/[\s.\-/]/g, "");
}

/** Greece uses the "EL" prefix in VAT numbers instead of its ISO code. */
function vatPrefix(country: string): string {
  const c = country.toUpperCase();
  return c === "GR" ? "EL" : c;
}

/** NIF-IVA as declared in Modelo 349: country prefix + number. */
export function toEuVatNumber(country: string, taxId: string): string {
  const id = normalizeTaxId(taxId);
  const prefix = vatPrefix(country);
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

function isValidDni(id: string): boolean {
  const match = id.match(/^(\d{8})([A-Z])$/);
  return !!match && DNI_LETTERS[Number(match[1]) % 23] === match[2];
}

function isValidNie(id: string): boolean {
  const match = id.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (!match) return false;
  const prefix = { X: "0", Y: "1", Z: "2" }[match[1] as "X" | "Y" | "Z"];
  return isValidDni(`${prefix}${match[2]}${match[3]}`);
}

function isValidCif(id: string): boolean {
  const match = id.match(/^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/);
  if (!match) return false;
  const digits = match[2];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += n;
    }
  }
  const control = (10 - (sum % 10)) % 10;
  const expected = match[3];
  const letter = "JABCDEFGHI"[control];
  // Some entity types require a letter, others a digit; accept either form.
  return expected === String(control) || expected === letter;
}

export function isValidSpanishTaxId(value: string): boolean {
  const id = normalizeTaxId(value).replace(/^ES/, "");
  return isValidDni(id) || isValidNie(id) || isValidCif(id);
}

/** Loose format check for foreign EU VAT numbers (prefix + 2–13 alphanumerics). */
export function looksLikeEuVatNumber(country: string, value: string): boolean {
  const vat = toEuVatNumber(country, value);
  return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(vat);
}

export function validateTaxId(country: string, value: string): string | null {
  if (!value.trim()) return "El NIF es obligatorio.";
  if (country.toUpperCase() === "ES") {
    return isValidSpanishTaxId(value) ? null : "El NIF/CIF no parece válido.";
  }
  if (isEuCountry(country)) {
    return looksLikeEuVatNumber(country, value) ? null : "El NIF-IVA no parece válido.";
  }
  return null;
}
