// app/src/utils/phone.ts
export function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeUsPhoneDigits(value: string) {
  let digits = digitsOnly(value);

  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function formatUsPhoneInput(value: string) {
  const digits = normalizeUsPhoneDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

export function toE164Us(value: string) {
  const digits = normalizeUsPhoneDigits(value);
  if (digits.length !== 10) return null;
  return `+1${digits}`;
}

export function looksLikeCompleteUsPhone(value: string) {
  return normalizeUsPhoneDigits(value).length === 10;
}