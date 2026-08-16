export type PasswordRule = {
  id: string;
  label: string;
  missingMessage: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    missingMessage: "Password needs at least 8 characters",
    test: (v) => v.length >= 8,
  },
  {
    id: "uppercase",
    label: "At least 1 uppercase letter",
    missingMessage: "Password needs at least one uppercase letter",
    test: (v) => /[A-Z]/.test(v),
  },
  {
    id: "number",
    label: "At least 1 number",
    missingMessage: "Password needs at least one number",
    test: (v) => /[0-9]/.test(v),
  },
  {
    id: "special",
    label: "At least 1 special character (! @ # $ %)",
    missingMessage: "Password needs at least one special character like ! @ # $ %",
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
];

/** Returns the first missing-rule message, or null when the password is valid. */
export function firstPasswordProblem(value: string): string | null {
  const failed = PASSWORD_RULES.filter((r) => !r.test(value));
  if (failed.length === 0) return null;
  if (failed.length === 1) return failed[0]!.missingMessage;
  return `${failed[0]!.missingMessage} (also: ${failed
    .slice(1)
    .map((r) => r.label.toLowerCase())
    .join(", ")})`;
}

export function isPasswordValid(value: string) {
  return PASSWORD_RULES.every((r) => r.test(value));
}
