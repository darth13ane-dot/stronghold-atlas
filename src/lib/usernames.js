export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
export const USERNAME_REQUIREMENTS = "3 to 24 letters, numbers, or underscores.";

export function normalizeUsername(value) {
  return value.trim();
}
