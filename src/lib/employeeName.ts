/** Legal name, then nickname in brackets, then the Chinese name when present. */
export function getEmployeeDisplayName(emp: {
  name?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  surnameEn?: string | null;
  givenNameEn?: string | null;
  chineseName?: string | null;
  nameChinese?: string | null;
  nickname?: string | null;
  preferredName?: string | null;
}): string {
  const legalName = (
    emp.fullName ||
    emp.name ||
    `${emp.surnameEn || emp.lastName || ""} ${emp.givenNameEn || emp.firstName || ""}`.trim()
  ).trim();
  const nickname = (emp.nickname || emp.preferredName || "").trim();
  const chineseName = (emp.nameChinese || emp.chineseName || "").trim();
  return `${legalName}${nickname ? ` (${nickname})` : ""}${chineseName ? ` ${chineseName}` : ""}`;
}

/** Match the name shown on screen. A short query such as "AT" matches that
 *  nickname on its own, and does not match a longer name that merely contains those letters. */
export function employeeNameMatches(displayName: string, query: string): boolean {
  const hay = displayName.trim().toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (needle.length <= 2) {
    return hay.split(/[^\p{L}\p{N}]+/u).some((word) => word === needle);
  }
  return hay.includes(needle);
}
