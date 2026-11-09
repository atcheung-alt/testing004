/** HR Plus is the parent agency, not a client company. A blank company means this. */
export function isInternalCompanyName(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "") === "hrplus";
}

export function clientCompanies<T extends { name: string }>(companies: T[]) {
  return companies.filter((company) => !isInternalCompanyName(company.name));
}
