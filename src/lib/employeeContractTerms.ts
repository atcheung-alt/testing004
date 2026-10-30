// -----------------------------------------------------------------------------
// Terms text for the formal employment contract letter sent to an employee
// for e-signature — same template + placeholder-substitution mechanism as
// src/lib/recruitmentTerms.ts (renderRecruitmentTerms), just a different
// document with a different set of placeholders. Kept server/client-agnostic
// (no Prisma import) so it can be shared by the contract form, the send API
// route, and the PDF renderer.
//
// Format follows the HR Plus employment contract letter template (a signed
// reference copy for "Felix Fung" was used to derive the exact clause
// wording/order below): a short letter opening, an ordered-list clause
// style (each clause's bold label prefixed with "§" — see below), and a
// two-column Company/Employee signature block. Only the employee-specific
// and job-specific details (name, HKID, address, salutation, title,
// remuneration, annual leave) are placeholders — the surrounding legal
// boilerplate (overtime, confidentiality, data protection, notice periods,
// etc.) is the same fixed company policy text for every employee.
//
// Two lightweight markup conventions the PDF renderer (see TermsBody in
// EmployeeContractPdf.tsx) understands, same idea as the "| a | b | c |"
// pipe-table syntax in recruitmentTerms.ts:
//   - A block starting with "§" is rendered as the next number in an
//     ordered list, with **the bit between the leading double-asterisks**
//     bolded — e.g. "§**Contract Duration** – The Employee shall...".
//   - "**text**" anywhere else (e.g. around {{title}} below) is rendered
//     bold inline, without affecting list numbering.
// Both survive being hand-edited in the plain-text terms textarea, same as
// the pipe-table syntax does.
// -----------------------------------------------------------------------------

import { formatCurrency } from "@/lib/calculations";

export type EmployeeContractPlaceholders = {
  employeeName: string;
  // "Mr./Ms. {name}" (derived from gender — see greetingName() below), or
  // just the bare name if gender isn't on file. Used for the "Dear ..."
  // greeting and the recipient line under the letterhead.
  greetingName: string;
  companyName: string;
  companyAddress: string;
  employeeAddress: string;
  hkid: string;
  title: string;
  startDate: string; // already formatted (DD/MM/YYYY) or "________"
  // A single ready-to-drop-in sentence covering however this employee is
  // actually paid — flat monthly salary, or a daily/hourly/project rate —
  // see remunerationClause() below, which is what actually builds it.
  remuneration: string;
  annualLeaveDays: string;
  probationPeriod: string;
  // Appended straight onto the end of the Contract Duration clause (no
  // leading space needed — see buildValues() in EmployeeContractForm.tsx).
  // Empty for a permanent/indefinite position, so nothing is shown at all.
  contractEndDate: string;
  workLocation: string;
  workSchedule: string;
};

/**
 * The default employment contract letter template. Placeholders are
 * substituted per-employee (see renderEmployeeContractTerms below) —
 * identical {{name}} syntax to the recruitment terms template and the Q-I-R
 * system's own terms template.
 */
export const EMPLOYEE_CONTRACT_TERMS_TEMPLATE = `Dear {{greetingName}},

{{companyName}} is delighted to offer you the position of **{{title}}** with the terms and conditions given below:

The term of employment is made on {{startDate}} between {{companyName}}, registered address {{companyAddress}}, and {{employeeName}}, registered address {{employeeAddress}}. HKID NO.: {{hkid}} ('the Employee').

§**Contract Duration** – The Employee shall commence the assignment on {{startDate}}.{{contractEndDate}}

§**Assignment** – The Employee shall be assigned to work at {{companyName}} ('the Company') during the contract period.

§**Position** – The Employee shall be employed as **{{title}}** in the Company, carrying out those duties assigned directly by the Company.

§**Salary** – {{remuneration}}

§**Overtime** – Overtime payment is not applicable for this assignment.

§**Annual Leave** – {{annualLeaveDays}} days of Annual Leave per year, in addition to statutory holidays.

§**Working Hours** – {{workSchedule}}

§**Working Location** – {{workLocation}}

§**Notice of Termination** – During the first {{probationPeriod}}, no notice or payment in lieu of notice is required. After {{probationPeriod}}, either the Employer or the Employee may terminate this agreement by giving the other party 14 days' written notice or payment in lieu of notice.

§**Confidentiality** – The Employee shall not disclose, either during or after termination of the employment, to any person or party, any information relating to:

(i) the management or finances of the Company;

(ii) the identity, or any aspect of any of the affairs of clients or employees of the Company; and

(iii) any other matters relating to the affairs of the Company, which come to the Employee's attention during the course of the employment with the Company.

The Employer undertakes professional ethical obligations, including strict confidentiality of client affairs.

§**Data Protection** – The Employer shall have the right to collect personal data from the Employee for various human resources management purposes including but not limited to provision of benefits, compensation and payroll, performance appraisals, promotion and career development activities, completion of tax returns and review of employment decisions.

The Employee agrees that the personal data that the Employer has collected may be transferred to and used by the Company, insurers, payroll bankers, medical practices, administrators or managers of the Employer's MPF or other pension scheme and companies engaged in contractual activities on the Employer's behalf, for the above purposes in and outside Hong Kong.

The Employer shall have the right to retain the personal data after the contract completion. Such data is required for any residual employment related activities in relation to a former employee including, but not limited to, the provision of job references, processing applications for re-employment, matters relating to retirement benefits and allowing the Employer to fulfill contractual or statutory obligations.

§**Return of Company Property** – The Employee shall return the Company's property on the last working day. The Employer and the Company reserve the right to claim back any loss on any property not returned properly.

§**Entire Agreement** – This Agreement (together with the documents referred to in it) constitutes the entire agreement and understanding between the parties and supersedes all previous agreements and arrangements (whether written, oral or implied) concerning the employment of the Employee by the Employer, and those previous agreements and arrangements shall be deemed to have been terminated by mutual consent with effect from the commencement of this Agreement.

§**Governing Law and Jurisdiction** – This Agreement shall be governed by and construed in accordance with the laws of the Hong Kong Special Administrative Region, and the parties irrevocably agree that the courts of Hong Kong shall have exclusive jurisdiction to settle any dispute which arises in connection with this Agreement.

I would like to take this opportunity to wish you every success with your career in your new position!`;

/**
 * The intern-specific contract letter template — derived from a signed
 * reference copy for "Coey Lam" (HR Intern), same way the standard template
 * above was derived from the Felix Fung copy. Interns get a genuinely
 * different letter, not just a tweaked clause or two:
 *  - No Contract Duration/Assignment/Overtime/Annual Leave clauses at all —
 *    interns have no annual leave entitlement, and there's no probation
 *    period to speak of, so Notice of Termination is a flat 7 days each way
 *    rather than tied to {{probationPeriod}}.
 *  - An Incentive clause (always left blank/TBC — filled in by hand if a
 *    particular internship actually has one) and a Health & Safety clause,
 *    neither of which appear in the standard letter.
 *  - Confidentiality gets an extra paragraph about not removing company
 *    papers/records from the office.
 *  - Three closing clauses (Severability, Effect of Termination, Waiver)
 *    the standard letter doesn't include.
 * Still uses the same {{placeholder}}/"§**Label**" substitution mechanism
 * and is rendered by the exact same TermsBody component in
 * EmployeeContractPdf.tsx — just a different fixed string.
 */
export const INTERN_CONTRACT_TERMS_TEMPLATE = `Dear {{greetingName}},

{{companyName}} is delighted to offer you the position of **{{title}}**, with the terms and conditions given below:

The term of employment is made on {{startDate}} between {{companyName}}, registered address {{companyAddress}}, and {{employeeName}}, registered address {{employeeAddress}}. HKID NO.: {{hkid}} ('the Employee').

§**Position** – The Employee shall be employed as **{{title}}**, carrying out those duties assigned directly from the client.

§**Salary** – {{remuneration}}

§**Incentive** – ________________________________ (TBC)

§**Working Hours** – {{workSchedule}}

§**Working Location** – {{workLocation}}

§**Notice of Termination** – During the employment, either the Employer or the Employee may terminate this agreement by giving the other party 7 days' written notice or payment in lieu of notice.

To terminate this agreement, the Employee must speak directly to the designated Director between the office hours of 9:00am to 5:00pm, Monday to Friday (excluding all Public and Statutory holidays). The Employee is also required to confirm the resignation with a written notification. In order for such notice to be effective, the written notice of termination must be received and acknowledged by the Employer.

§**Health & Safety** – As per the Employer and Company policy.

§**Confidentiality** – The Employee shall not disclose, either during or after termination of the employment, to any person or party, any information relating to:

(i) the management or finances of the Company;

(ii) the identity, or any aspect of any of the affairs of clients or employees of the Company; and

(iii) any other matters relating to the affairs of the Company, which come to the Employee's attention during the course of the employment with the Company.

The Employee shall not remove from the offices of the Company, including, in particular, but without limitation, the Hong Kong office (except in the ordinary course of the Company's business), any papers or records, whether copies or originals, of the Company or relating to the affairs of the client of the Company.

The Employer undertakes professional ethical obligations, including strict confidentiality of client affairs.

§**Data Protection** – The Employer shall have the right to collect personal data from the Employee for various human resources management purposes including but not limited to provision of benefits, compensation and payroll, performance appraisals, promotion and career development activities, completion of tax returns and review of employment decisions.

The Employee agrees that the personal data that the Employer has collected may be transferred to and used by the Company, insurers, payroll bankers, medical practices, administrators or managers of the Employer's MPF or other pension scheme and companies engaged in contractual activities on the Employer's behalf, for the above purposes in and outside Hong Kong.

The Employer shall have the right to retain the personal data after the contract completion. Such data is required for any residual employment related activities in relation to a former employee including, but not limited to, the provision of job references, processing applications for re-employment, matters relating to retirement benefits and allowing the Employer to fulfill contractual or statutory obligations.

§**Return of Company Property** – The Employee shall return the Company's property on the last working day. The Employer and the Company reserve the right to claim back any loss on any property not returned properly.

§**Entire Agreement** – This Agreement (together with the documents referred to in it) constitutes the entire agreement and understanding between the parties and supersedes all previous agreements and arrangements (whether written, oral or implied) concerning the employment of the Employee by the Employer, and those previous agreements and arrangements shall be deemed to have been terminated by mutual consent with effect from the commencement of this Agreement.

§**Severability** – If any provision of this Agreement is held to be illegal, invalid or unenforceable in whole or in part in any jurisdiction, this Agreement shall, with respect to such jurisdiction, continue to be valid as to its other provisions and the remainder of the affected provision; and the legality, validity and enforceability of such affected provision in any other jurisdiction shall be unaffected.

§**Effect of Termination** – The termination of this Agreement, however arising, shall not operate to affect any provisions which are expressed to operate or have effect after its termination and shall not prejudice the exercise of any right or remedy of either party accrued beforehand.

§**Waiver** – The failure of either party at any time to insist on the performance of any provision of this Agreement is not a waiver of its right at any later time to insist on the performance of that or any other provision of this Agreement.

§**Governing Law and Jurisdiction** – This Agreement shall be governed by and construed in accordance with the laws of the Hong Kong Special Administrative Region, and the parties irrevocably agree that the courts of Hong Kong shall have exclusive jurisdiction to settle any dispute which arises in connection with this Agreement.

Please find enclosed Timesheets, Personal Details and Staffing Information forms.

I would like to take this opportunity to wish you every success with your career in your new position!`;

/**
 * The part-time contract — follows the exact same shape as
 * INTERN_CONTRACT_TERMS_TEMPLATE above rather than the standard letter,
 * because the two employment types share the same underlying facts: no
 * annual leave entitlement, no probation period, and pay is a day/hour rate
 * rather than a flat monthly salary (see remunerationClause below — Part
 * time never falls through to the salary sentence, unlike a salaried
 * Intern). Concretely that means:
 *  - No Contract Duration/Assignment/Overtime/Annual Leave clauses — Notice
 *    of Termination is a flat 7 days each way instead of tied to a
 *    probation period.
 *  - An Incentive clause (blank/TBC) and a Health & Safety clause.
 *  - The extra Confidentiality paragraph about not removing company
 *    papers/records from the office.
 *  - The same three extra closing clauses (Severability, Effect of
 *    Termination, Waiver).
 * The body text itself never actually said "intern" anywhere (it's written
 * in terms of "the Employee" throughout), so this is a genuine duplicate
 * rather than a find/replace — kept as its own constant, not a shared
 * reference to INTERN_CONTRACT_TERMS_TEMPLATE, so the two can still diverge
 * later without one silently dragging the other along.
 */
export const PART_TIME_CONTRACT_TERMS_TEMPLATE = `Dear {{greetingName}},

{{companyName}} is delighted to offer you the position of **{{title}}**, with the terms and conditions given below:

The term of employment is made on {{startDate}} between {{companyName}}, registered address {{companyAddress}}, and {{employeeName}}, registered address {{employeeAddress}}. HKID NO.: {{hkid}} ('the Employee').

§**Position** – The Employee shall be employed as **{{title}}**, carrying out those duties assigned directly from the client.

§**Salary** – {{remuneration}}

§**Incentive** – ________________________________ (TBC)

§**Working Hours** – {{workSchedule}}

§**Working Location** – {{workLocation}}

§**Notice of Termination** – During the employment, either the Employer or the Employee may terminate this agreement by giving the other party 7 days' written notice or payment in lieu of notice.

To terminate this agreement, the Employee must speak directly to the designated Director between the office hours of 9:00am to 5:00pm, Monday to Friday (excluding all Public and Statutory holidays). The Employee is also required to confirm the resignation with a written notification. In order for such notice to be effective, the written notice of termination must be received and acknowledged by the Employer.

§**Health & Safety** – As per the Employer and Company policy.

§**Confidentiality** – The Employee shall not disclose, either during or after termination of the employment, to any person or party, any information relating to:

(i) the management or finances of the Company;

(ii) the identity, or any aspect of any of the affairs of clients or employees of the Company; and

(iii) any other matters relating to the affairs of the Company, which come to the Employee's attention during the course of the employment with the Company.

The Employee shall not remove from the offices of the Company, including, in particular, but without limitation, the Hong Kong office (except in the ordinary course of the Company's business), any papers or records, whether copies or originals, of the Company or relating to the affairs of the client of the Company.

The Employer undertakes professional ethical obligations, including strict confidentiality of client affairs.

§**Data Protection** – The Employer shall have the right to collect personal data from the Employee for various human resources management purposes including but not limited to provision of benefits, compensation and payroll, performance appraisals, promotion and career development activities, completion of tax returns and review of employment decisions.

The Employee agrees that the personal data that the Employer has collected may be transferred to and used by the Company, insurers, payroll bankers, medical practices, administrators or managers of the Employer's MPF or other pension scheme and companies engaged in contractual activities on the Employer's behalf, for the above purposes in and outside Hong Kong.

The Employer shall have the right to retain the personal data after the contract completion. Such data is required for any residual employment related activities in relation to a former employee including, but not limited to, the provision of job references, processing applications for re-employment, matters relating to retirement benefits and allowing the Employer to fulfill contractual or statutory obligations.

§**Return of Company Property** – The Employee shall return the Company's property on the last working day. The Employer and the Company reserve the right to claim back any loss on any property not returned properly.

§**Entire Agreement** – This Agreement (together with the documents referred to in it) constitutes the entire agreement and understanding between the parties and supersedes all previous agreements and arrangements (whether written, oral or implied) concerning the employment of the Employee by the Employer, and those previous agreements and arrangements shall be deemed to have been terminated by mutual consent with effect from the commencement of this Agreement.

§**Severability** – If any provision of this Agreement is held to be illegal, invalid or unenforceable in whole or in part in any jurisdiction, this Agreement shall, with respect to such jurisdiction, continue to be valid as to its other provisions and the remainder of the affected provision; and the legality, validity and enforceability of such affected provision in any other jurisdiction shall be unaffected.

§**Effect of Termination** – The termination of this Agreement, however arising, shall not operate to affect any provisions which are expressed to operate or have effect after its termination and shall not prejudice the exercise of any right or remedy of either party accrued beforehand.

§**Waiver** – The failure of either party at any time to insist on the performance of any provision of this Agreement is not a waiver of its right at any later time to insist on the performance of that or any other provision of this Agreement.

§**Governing Law and Jurisdiction** – This Agreement shall be governed by and construed in accordance with the laws of the Hong Kong Special Administrative Region, and the parties irrevocably agree that the courts of Hong Kong shall have exclusive jurisdiction to settle any dispute which arises in connection with this Agreement.

Please find enclosed Timesheets, Personal Details and Staffing Information forms.

I would like to take this opportunity to wish you every success with your career in your new position!`;

/**
 * The freelance-specific contract — derived from the signed "Freelance
 * Partnership Contract Template" reference copy. Unlike the standard letter
 * or the intern letter, this isn't really an employment letter at all: it's
 * an Independent Contractor Agreement (WHEREAS recitals, numbered clauses
 * establishing the Contractor relationship, IP assignment, indemnification,
 * non-compete/non-solicit) — reusing the same {{placeholder}}/"§**Label**"
 * mechanism and TermsBody renderer purely as a formatting convenience, not
 * because the content is a variation on the other two letters.
 *
 * Only greetingName/companyName/employeeName/title/startDate are used —
 * there's no HKID/address recital, no annual leave (contractors explicitly
 * get "no other benefits afforded to employees" — see the Independent
 * Contractor Status clause), no probation, and no fixed work location/
 * hours clause (a contractor sets their own). The Compensation clause is
 * deliberately left as fixed boilerplate pointing at a separately agreed
 * Appendix A commission rate, rather than the day/hour/project-fee sentence
 * remunerationClause() would otherwise generate — this is a commission
 * arrangement, not a rate for hours/days/deliverables.
 *
 * The PDF's document heading/title also switches to "Independent Contractor
 * Agreement" for this template — see contractDocumentTitleFor below.
 */
export const FREELANCE_CONTRACT_TERMS_TEMPLATE = `Dear {{greetingName}},

{{companyName}} is delighted to offer you the position of **{{title}}** with the terms and conditions given below:

This agreement (the "Agreement") is made and entered into as of {{startDate}} (the "Effective Date") between {{companyName}} (the "Company"), and {{employeeName}} (the "Contractor").

WHEREAS, the Company requests the Contractor to perform services for it and may request the Contractor to perform other services in the future; and

WHEREAS, the Company and the Contractor desire to enter into an agreement, which will define respective rights and duties as to all services to be performed,

WHEREAS, the Contractor affirms that he or she understands all of the provisions contained in the Agreement, and in the case that he or she requires clarification as to one or more of the provisions contained herein, he or she has requested clarification or otherwise sought legal guidance,

NOW, THEREFORE, in consideration of the covenants and agreements contained herein, the parties hereto agree as follows:

§**Services** – Beginning on the Effective Date, the Contractor shall provide the Company with services in connection with the Contractor's role as **{{title}}**, without limitation.

§**Contractor Representations and Warranties** – Beginning on the Effective Date, and remaining in effect for the duration of this Agreement, the Contractor makes the following representations and warranties.

That he or she is fully authorized and empowered to enter into this Agreement, and that his or her performance of the obligations under this Agreement will not violate any agreement between the Contractor and any other person, firm or organization or any law or governmental regulation.

That he or she is more than eighteen (18) years of age and not otherwise incapacitated at the time of the Agreement.

That he or she will notify the Company of any change(s) to the Contractor's schedule that could adversely affect the availability of the Contractor, whether known or unknown at the time of this Agreement, no later than two (2) weeks prior to such change(s). If the Contractor becomes aware of such change(s) within the two (2) week period, the Contractor shall promptly notify the Company of such change(s) within a reasonable amount of time.

§**Company Representations and Warranties** – Beginning on the Effective Date, and remaining in effect for the duration of this Agreement, the Company makes the following representations and warranties.

That it is fully authorized and empowered to enter into this Agreement, and that its performance of the obligations under this Agreement will not violate any agreement between the Company and any other person, firm or organization or any law or governmental regulation.

That it is in full compliance with any and all laws and/or statutes applicable to the services described hereunder.

§**Compensation** – There is no allowance entitled by the Contractor. The Contractor will be compensated through a commission at the rate outlined in Appendix A.

§**Independent Contractor Status** – The Contractor is an independent contractor of the Company. Nothing contained in this Agreement shall be construed to create the relationship of employer and employee, principal and agent, partnership or joint venture, or any other fiduciary relationship.

The Contractor shall not be entitled to worker's compensation, retirement, insurance, or other benefits afforded to employees of the Company.

§**Confidential Information** – The Contractor and his or her employees shall not, during the time of rendering services to the Company or thereafter, disclose to anyone other than authorized employees of the Company (or persons designated by such duly authorized employees of the Company) or use for the benefit of the Contractor and his or her employees or for any entity other than the Company, any information of a confidential nature, including but not limited to, information relating to: any such materials or intellectual property; any of the Company's projects or programs; the technical, commercial or any other affairs of the Company; or, any confidential information which the Company has received from a third party.

§**Intellectual Property** – The Contractor represents that all content provided by the Contractor to the Company, in furtherance of the services described hereunder, including, without limitation, images, video and text including any intellectual property, such as copyrights or trademarks (the "Content"), is owned solely and legally by the Contractor.

The Contractor grants the Company a non-exclusive, transferable, sub-licensable, royalty-free worldwide license to use any Content in connection with the services described hereunder.

Any materials developed by the Company, making use of Content, remains the sole property of the Company subject to all applicable laws and/or statutes.

During the course of performing under this Agreement, the Contractor and its directors, officers, employees, or other representatives may, independently or in conjunction with the Company, develop information, produce work product, or achieve other results for the Company in connection with the services it performs for the Company under this Agreement. The Contractor agrees that any such information, work product, and other results, systems and information developed by the Contractor and/or the Company in connection with such services (the "Work Product") shall, to the extent permitted by law, remain the sole and exclusive property of the Company. This provision shall have no effect on the status of the relationship between the Company and the Contractor, as set out in the Independent Contractor Status clause above.

§**Liability** – The Company makes no guarantees regarding the physical and/or mental fitness of any client. The Contractor shall perform the services set out in this Agreement at his or her own risk.

§**Indemnification** – The Contractor agrees to defend against all personal claims, demands, causes of action, lawsuits, and/or judgments arising out of, or relating to, the Contractor's service under this Agreement unless expressly stated otherwise by the Company, in writing.

§**Duration, Scope and Severability** – This Agreement shall take effect immediately, and shall remain in full force until terminated pursuant to this clause.

Either party may terminate this Agreement for any reason upon seven (7) days' notice to the Contractor. Either party may terminate this Agreement for cause immediately upon notice to the breaching party.

This Agreement, and any accompanying appendices, duplicates, or copies, constitutes the entire agreement between the parties with respect to the subject matter of this Agreement, and supersedes all prior negotiations, agreements, representations, and understandings of any kind, whether written or oral, between the parties, preceding the date of this Agreement.

This Agreement may be amended only by written agreement duly executed by an authorized representative of each party.

If any provision or provisions of this Agreement shall be held unenforceable for any reason, then such provision shall be modified to reflect the parties' intention. All remaining provisions of this Agreement shall remain in full force and effect for the duration of this Agreement.

No modifications to this Agreement shall be binding upon the Company without the express, written consent of the Company.

This Agreement shall not be assigned by either party without the express consent of the other party.

§**Governing Law and Jurisdiction** – This Agreement shall be governed by and construed in accordance with the laws of Hong Kong. Any action instituted by either party arising out of this Agreement shall only be brought, tried and resolved in the applicable courts having jurisdiction in Hong Kong. Each party hereby consents to the exclusive jurisdiction and venue of the courts having jurisdiction in Hong Kong.

§**Non-compete and Non-solicitation on Termination of the Agreement** – The Contractor undertakes that for a period of three months following termination of the Agreement with the Company, the Contractor will not, on the Contractor's own behalf or that of any other party, solicit or accept in competition with the Company the custom or business of any candidate, customer or client with whom the Contractor had contact or dealings with on behalf of the Company during the twelve months prior to termination.

The Contractor undertakes that for a period of twelve months following termination of the Agreement with the Company, the Contractor will not, on the Contractor's own behalf or that of any other party, induce, solicit, procure, accept into employment or otherwise engage any person who is an employee, director or consultant to the Company.

IN WITNESS WHEREOF, the parties, intending to be legally bound, have each executed this Agreement as of the Effective Date.`;

/** Full time uses the standard letter. Intern and Part time share the same
 *  shorter, no-probation/no-annual-leave letter shape (see
 *  INTERN_CONTRACT_TERMS_TEMPLATE and PART_TIME_CONTRACT_TERMS_TEMPLATE
 *  above — two separate constants with identical bodies today, kept
 *  distinct so they can diverge later). Freelance gets its own Independent
 *  Contractor Agreement (see FREELANCE_CONTRACT_TERMS_TEMPLATE above). */
export function contractTermsTemplateFor(employmentType: string | null | undefined): string {
  if (employmentType === "INTERN") return INTERN_CONTRACT_TERMS_TEMPLATE;
  if (employmentType === "PART_TIME") return PART_TIME_CONTRACT_TERMS_TEMPLATE;
  if (employmentType === "FREELANCE") return FREELANCE_CONTRACT_TERMS_TEMPLATE;
  return EMPLOYEE_CONTRACT_TERMS_TEMPLATE;
}

/** The PDF's document heading/title — "Employment Contract" for every
 *  employment type except Freelance, which gets "Independent Contractor
 *  Agreement" instead (see FREELANCE_CONTRACT_TERMS_TEMPLATE above; a
 *  freelancer is explicitly not an employee under that agreement, so the
 *  heading shouldn't call it one). */
export function contractDocumentTitleFor(employmentType: string | null | undefined): string {
  return employmentType === "FREELANCE" ? "Independent Contractor Agreement" : "Employment Contract";
}

const PLACEHOLDER_KEYS: (keyof EmployeeContractPlaceholders)[] = [
  "employeeName",
  "greetingName",
  "companyName",
  "companyAddress",
  "employeeAddress",
  "hkid",
  "title",
  "startDate",
  "remuneration",
  "annualLeaveDays",
  "probationPeriod",
  "contractEndDate",
  "workLocation",
  "workSchedule",
];

// contractEndDate is legitimately empty for a permanent position (nothing
// gets appended to the Contract Duration clause) — every other placeholder
// falls back to an underscore blank when missing, as a visual prompt for
// staff to fill it in.
const OPTIONAL_PLACEHOLDER_KEYS = new Set<keyof EmployeeContractPlaceholders>(["contractEndDate"]);

/** Substitute every placeholder into the employment contract template. */
export function renderEmployeeContractTerms(
  template: string,
  values: EmployeeContractPlaceholders
): string {
  let result = template;
  for (const key of PLACEHOLDER_KEYS) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    const raw = values[key]?.trim() || "";
    const value = raw || (OPTIONAL_PLACEHOLDER_KEYS.has(key) ? "" : "________________________");
    result = result.replace(pattern, () => value);
  }
  return result;
}

/** "Mr." for Male, "Ms." for Female — anything else (Other, "Prefer not to
 *  say", or not on file) omits the salutation rather than guessing. */
function salutationFor(gender: string | null | undefined): string {
  if (gender === "Male") return "Mr.";
  if (gender === "Female") return "Ms.";
  return "";
}

/** Builds the "Mr./Ms. {name}" form used in the letter's "Dear ..." greeting
 *  and the recipient line under the letterhead — falls back to the bare name
 *  if gender isn't on file. */
export function greetingName(name: string, gender: string | null | undefined): string {
  const salutation = salutationFor(gender);
  return salutation ? `${salutation} ${name}` : name;
}

export type RemunerationInput = {
  employmentType: string | null;
  salary: number;
  payRateType: string | null;
  payRate: number;
};

/**
 * Builds the single sentence that fills the {{remuneration}} placeholder in
 * the Salary clause above, matching whichever pay structure actually applies
 * to this employee (see PAY_RATE_TYPES_BY_EMPLOYMENT_TYPE in
 * src/lib/employees.ts): Part time/Freelance are always paid an hour/day/
 * project rate; Full time (or an unset employment type) always keeps the
 * flat monthly salary wording this template always used; Intern can be
 * either — payRateType is null for a salaried intern (same as Full time),
 * so it falls through the `if (usesPayRate)` block below without matching
 * any of the three rate branches and lands on the salary sentence too.
 */
export function remunerationClause({
  employmentType,
  salary,
  payRateType,
  payRate,
}: RemunerationInput): string {
  if (employmentType === "INTERN" && !(salary > 0) && !(payRate > 0)) {
    return "This is an unpaid internship. The Employee will not receive a salary or other remuneration.";
  }
  const usesPayRate =
    employmentType === "INTERN" || employmentType === "PART_TIME" || employmentType === "FREELANCE";
  if (usesPayRate) {
    if (payRateType === "HOURLY") {
      return payRate
        ? `The Employee's hourly rate is ${formatCurrency(payRate)}, calculated based on actual hours worked and payable monthly in arrears, subject to all statutory deductions (including Mandatory Provident Fund contributions where applicable).`
        : "The Employee's hourly rate is ________________________, payable monthly in arrears.";
    }
    if (payRateType === "DAILY") {
      return payRate
        ? `The Employee's daily rate is ${formatCurrency(payRate)}, calculated based on actual days worked and payable monthly in arrears, subject to all statutory deductions (including Mandatory Provident Fund contributions where applicable).`
        : "The Employee's daily rate is ________________________, payable monthly in arrears.";
    }
    if (payRateType === "PROJECT_FEE") {
      return payRate
        ? `The Employee will be paid a fixed fee of ${formatCurrency(payRate)} for the agreed project/deliverables, payable upon completion (or per the schedule separately agreed), subject to all statutory deductions where applicable.`
        : "The Employee's fixed project fee is ________________________, payable upon completion.";
    }
  }
  return salary
    ? `The basic salary is ${formatCurrency(salary)} per month, payable at the end of each calendar month, subject to all statutory deductions (including Mandatory Provident Fund contributions).`
    : "The basic salary is ________________________ per month, payable at the end of each calendar month, subject to all statutory deductions (including Mandatory Provident Fund contributions).";
}
