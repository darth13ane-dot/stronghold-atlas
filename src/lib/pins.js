export const PIN_PATTERN = /^\d{8}$/;
export const PIN_REQUIREMENTS = "Use exactly 8 numbers.";

export function normalizePin(value) {
  return value.replace(/\D/g, "").slice(0, 8);
}
