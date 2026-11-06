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

/** True when the typed text appears in the employee name shown on the row. */
export function employeeNameMatches(displayName: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return displayName.toLowerCase().includes(needle);
}
