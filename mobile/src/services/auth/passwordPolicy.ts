/** Local feedback. Supabase and the approved server policy must enforce registration. */
export function passwordChecks(password: string, email = "", name = "") {
  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  const identityParts = [name, email.split("@")[0] ?? ""]
    .flatMap(value => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter(value => value.length >= 3);
  const predictable = ["password", "qwerty", "letmein", "welcome", "admin", "123456", "abcdef"];
  return [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "An uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "A lowercase letter", passed: /[a-z]/.test(password) },
    { label: "A number", passed: /[0-9]/.test(password) },
    { label: "A special character", passed: /[^A-Za-z0-9\s]/.test(password) },
    {
      label: "Avoid common words, sequences and repetition",
      passed: !predictable.some(word => normalized.includes(word)) &&
        !/(.)\1{3}/.test(password) && !/^(.{1,4})\1{2,}$/.test(password),
    },
    {
      label: "Avoid your name and email address",
      passed: !identityParts.some(part => normalized.includes(part)),
    },
  ];
}

export function passwordIssue(password: string, email = "", name = "") {
  return passwordChecks(password, email, name).find(check => !check.passed)?.label;
}
