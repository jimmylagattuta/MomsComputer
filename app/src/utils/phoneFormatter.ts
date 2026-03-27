export function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function formatPhoneNumber(value: string) {
  const digits = digitsOnly(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidUSPhone(value: string) {
  return digitsOnly(value).length === 10;
}

export function toE164US(value: string) {
  const digits = digitsOnly(value);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+1${digits.slice(0, 10)}`;
}