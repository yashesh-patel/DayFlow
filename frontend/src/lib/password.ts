/**
 * Mirrors the server-side rule in backend/src/lib/validators.js. Keep the two in
 * sync -- the backend stays the source of truth, this only saves a round trip.
 */
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

export const passwordRules: PasswordRule[] = [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /\d/.test(p) },
];

/** Returns an error message, or null when the password is acceptable. */
export function getPasswordError(password: string): string | null {
  if (!password) return "Password is required";
  const failed = passwordRules.filter((rule) => !rule.test(password));
  if (failed.length === 0) return null;
  return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include an uppercase letter, a lowercase letter, and a number`;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordError(password) === null;
}
