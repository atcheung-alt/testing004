import { Converter } from "opencc-js";

export const DEFAULT_RECRUITMENT_PAYMENT_DUE_DAYS = 14;

export const VALID_RECRUITMENT_STATUSES = ["DRAFT", "SENT", "SIGNED", "CANCELLED"];

// -----------------------------------------------------------------------------
// Terms language (Clause text only — company data, fee scale rows, etc. are
// unaffected). English is the original/default; Traditional and Simplified
// Chinese are both full translations of the same 17-clause structure, so
// every language covers exactly the same commercial terms.
// -----------------------------------------------------------------------------
export type RecruitmentLanguage = "EN" | "ZH_HANT" | "ZH_HANS";
export const VALID_RECRUITMENT_LANGUAGES: RecruitmentLanguage[] = ["EN", "ZH_HANT", "ZH_HANS"];
export const RECRUITMENT_LANGUAGE_LABELS: Record<RecruitmentLanguage, string> = {
  EN: "English",
  ZH_HANT: "繁體中文 (Traditional Chinese)",
  ZH_HANS: "简体中文 (Simplified Chinese)",
};

// -----------------------------------------------------------------------------
// Fee scale tables (Clause 13.b). Two layers, same idea as paymentDueDays:
//
// 1. A shared library (RecruitmentFeeScaleRow, managed at
//    /recruitment/fee-scale) holding the company's current *standard* rates
//    — the same add/edit/delete pattern as the PresetItem "Item Library".
// 2. Each RecruitmentAgreement stores its OWN copy of these rows
//    (feeScalePermanent/feeScaleContract, JSON-encoded FeeScaleRowFields[]).
//    New agreements pre-fill from the library's current defaults, but from
//    then on the rows belong to that agreement — editing them on the
//    New/Edit Agreement page (see FeeScaleRowsEditor in
//    RecruitmentAgreementForm.tsx) never touches the shared library or any
//    other agreement, exactly like Payment Due Days.
//
// This module stays server/client-agnostic (no Prisma import) so it can be
// shared by the API routes, the PDF/terms renderer, and the client-side form.
// -----------------------------------------------------------------------------

export type FeeScaleRowFields = {
  packageLabel: string;
  fee: string;
  guaranteePeriod: string;
};

/** A library row — same fields, plus the persisted id. */
export type FeeScaleRow = FeeScaleRowFields & { id: string };

export type FeeScaleTables = { permanent: string; contract: string };

/** Seeded the first time /api/recruitment/fee-scale is called and the
 *  category has no rows yet — the same 2024 default figures that used to be
 *  hardcoded directly into RECRUITMENT_TERMS_TEMPLATE. Also used as the
 *  final fallback for brand-new agreements before the library has loaded. */
export const DEFAULT_FEE_SCALE_PERMANENT: FeeScaleRowFields[] = [
  { packageLabel: "HK$1 mil or below", fee: "20% of annual salary package", guaranteePeriod: "12 weeks" },
  { packageLabel: "HK$1 mil and above", fee: "22% of annual salary package", guaranteePeriod: "12 weeks" },
];

export const DEFAULT_FEE_SCALE_CONTRACT: FeeScaleRowFields[] = [
  { packageLabel: "All levels (Employment Period ≥ 3 months)", fee: "25%", guaranteePeriod: "12 weeks" },
  { packageLabel: "All levels (Employment Period < 3 months)", fee: "30%", guaranteePeriod: "N/A" },
];

// The fee scale ROW VALUES themselves (package label / fee / guarantee
// period) are free text staff type into the Fee Scale library — they stay
// exactly as entered regardless of language, same figures in every version,
// since a single shared library backs all three languages (see the
// RecruitmentAgreementForm.tsx comment on the fee scale card). Only the
// table's header row and caption are localized here.
export const FEE_SCALE_HEADER: Record<RecruitmentLanguage, string[]> = {
  EN: ["Annual Remuneration Package", "Fee", "Guarantee Period"],
  ZH_HANS: ["年度薪酬总额", "费用", "保证期"],
  ZH_HANT: ["年度薪酬總額", "費用", "保證期"],
};
export const FEE_SCALE_CAPTIONS: Record<RecruitmentLanguage, { permanent: string; contract: string }> = {
  EN: { permanent: "Fee Scale for Permanent Placements", contract: "Fee Scale for Contract Placements" },
  ZH_HANS: { permanent: "永久聘用费用表", contract: "合约聘用费用表" },
  ZH_HANT: { permanent: "永久聘用費用表", contract: "合約聘用費用表" },
};

// Row values (package label / fee / guarantee period) are free text staff
// type into the shared fee scale library or editor, and the library/editor
// UI itself always stays in English — that's the single source of truth
// staff edit against, regardless of which terms language an agreement uses.
// However, when those values are embedded into a Chinese-language terms
// document, the *known* built-in phrasings (the library's seeded defaults,
// and anything matching them verbatim) do get translated here, since a
// Chinese agreement reading "HK$1 mil or below" in the middle of otherwise
// Chinese clause text would look broken. Custom text staff type that isn't
// in this dictionary can't be machine-translated, so it's left as-is.
const FEE_SCALE_VALUE_TRANSLATIONS: Record<string, { ZH_HANS: string; ZH_HANT: string }> = {
  "HK$1 mil or below": { ZH_HANS: "港币100万或以下", ZH_HANT: "港幣100萬或以下" },
  "HK$1 mil and above": { ZH_HANS: "港币100万及以上", ZH_HANT: "港幣100萬及以上" },
  "20% of annual salary package": { ZH_HANS: "年度薪酬总额的20%", ZH_HANT: "年度薪酬總額的20%" },
  "22% of annual salary package": { ZH_HANS: "年度薪酬总额的22%", ZH_HANT: "年度薪酬總額的22%" },
  "12 weeks": { ZH_HANS: "12周", ZH_HANT: "12週" },
  "All levels (Employment Period ≥ 3 months)": {
    ZH_HANS: "所有职级（聘用期 ≥ 3个月）",
    ZH_HANT: "所有職級（聘用期 ≥ 3個月）",
  },
  "All levels (Employment Period < 3 months)": {
    ZH_HANS: "所有职级（聘用期 < 3个月）",
    ZH_HANT: "所有職級（聘用期 < 3個月）",
  },
  "N/A": { ZH_HANS: "不适用", ZH_HANT: "不適用" },
};

/** Translates one fee scale row value (package label / fee / guarantee
 *  period) for display in the given language, using the dictionary above —
 *  also used directly by the fee scale editor UI so the inputs preview the
 *  translated text staff will see in the generated terms. Falls back to the
 *  original text verbatim if there's no known match. */
export function translateFeeScaleValue(value: string, language: RecruitmentLanguage): string {
  if (language === "EN") return value;
  const entry = FEE_SCALE_VALUE_TRANSLATIONS[value.trim()];
  if (!entry) return value;
  return language === "ZH_HANS" ? entry.ZH_HANS : entry.ZH_HANT;
}

/** Renders a caption + `| a | b | c |` table block — the exact syntax
 *  RecruitmentAgreementPdf.tsx's TermsBody parses into a bordered table.
 *  Row values are translated per `language` where a known match exists (see
 *  FEE_SCALE_VALUE_TRANSLATIONS above). */
export function buildFeeScaleTableText(
  caption: string,
  rows: FeeScaleRowFields[],
  header: string[],
  language: RecruitmentLanguage = "EN"
): string {
  const lines = [
    caption,
    `| ${header.join(" | ")} |`,
    ...rows.map(
      (r) =>
        `| ${translateFeeScaleValue(r.packageLabel, language)} | ${translateFeeScaleValue(
          r.fee,
          language
        )} | ${translateFeeScaleValue(r.guaranteePeriod, language)} |`
    ),
  ];
  return lines.join("\n");
}

/** Convenience: builds both tables from a { permanent, contract } row-list
 *  pair (the library API's shape, or an agreement's own stored rows), ready
 *  to pass into renderRecruitmentTerms. `language` affects the header row,
 *  caption text, and (where a known translation exists) the row values
 *  themselves — see FEE_SCALE_VALUE_TRANSLATIONS. */
export function buildFeeScaleTables(
  data: { permanent: FeeScaleRowFields[]; contract: FeeScaleRowFields[] },
  language: RecruitmentLanguage = "EN"
): FeeScaleTables {
  const header = FEE_SCALE_HEADER[language];
  const captions = FEE_SCALE_CAPTIONS[language];
  return {
    permanent: buildFeeScaleTableText(captions.permanent, data.permanent, header, language),
    contract: buildFeeScaleTableText(captions.contract, data.contract, header, language),
  };
}

/**
 * Normalize arbitrary input (a live array from client state, a JSON string
 * from the DB, or anything else) into a clean array of fee scale rows —
 * same defensive pattern as normalizeMultipliers in src/lib/multipliers.ts.
 * Falls back to the built-in defaults for that category if nothing usable
 * is found, so a brand-new or malformed value never renders an empty table.
 */
export function normalizeFeeScaleRows(
  raw: unknown,
  fallback: FeeScaleRowFields[]
): FeeScaleRowFields[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = [];
    }
  }
  const rows = arr
    .map((r) => ({
      packageLabel: typeof r?.packageLabel === "string" ? r.packageLabel : "",
      fee: typeof r?.fee === "string" ? r.fee : "",
      guaranteePeriod: typeof r?.guaranteePeriod === "string" ? r.guaranteePeriod : "",
    }))
    .filter((r) => r.packageLabel.trim() || r.fee.trim() || r.guaranteePeriod.trim());
  return rows.length > 0 ? rows : fallback;
}

/** Serialize a list of fee scale rows for storage in the DB's String column. */
export function serializeFeeScaleRows(raw: unknown): string {
  // No meaningful fallback when *saving* — an intentionally emptied table
  // should save as empty, not silently snap back to the defaults.
  return JSON.stringify(normalizeFeeScaleRows(raw, []));
}

/** Fallback used wherever fee scale rows haven't loaded yet (or a call site
 *  never passes them) — keeps every existing renderRecruitmentTerms call
 *  working even before this module's data has loaded. */
const DEFAULT_FEE_SCALE_TABLES: FeeScaleTables = buildFeeScaleTables({
  permanent: DEFAULT_FEE_SCALE_PERMANENT,
  contract: DEFAULT_FEE_SCALE_CONTRACT,
});

/**
 * The recruitment services terms template, sourced from HR Plus (Talent)
 * Limited's Master Terms of Business. Placeholders substituted per agreement:
 * {{clientCompanyName}} (Clause 1's client name blank), {{paymentDueDays}}
 * (Clause 3's payment window, "within 14 days" by default), and
 * {{feeScalePermanentTable}} / {{feeScaleContractTable}} (Clause 13.b's two
 * fee tables, built from the user-managed RecruitmentFeeScaleRow library —
 * see buildFeeScaleTables above). Reuses the exact same {{paymentDueDays}}
 * placeholder syntax as the Q-I-R system's own terms template (see
 * src/lib/settings.ts's renderTerms) — same substitution mechanism,
 * different document.
 */
export const RECRUITMENT_TERMS_TEMPLATE = `1. General Definitions and Effective Date
These Terms and Conditions replace all existing terms and conditions between HR Plus (Talent) Limited ("The Agent") and {{clientCompanyName}} ("The Client") in the Hong Kong Special Administrative Region of The People's Republic of China and overseas. The service agreement will commence on the date it is signed by an authorized representative of the Client and the Agent and will be valid for three (3) years. Upon expiration of the term, the agreement shall automatically renew, unless either party provides written notice of termination at least thirty (30) days prior to the end of the current term.

2. Variation
Any alteration of these terms is not valid or shall not be binding on HR Plus (Talent) Limited unless confirmed in writing by the Director of the Agent.

3. Payment
Please pay all fees and charges in HKD to the Agent, "HR Plus (Talent) Limited," upon invoice presentation. The invoice should be settled within {{paymentDueDays}} days. Where any candidate introduced by the Agent to the Client is already known to the Client as a result of direct contact or contact through another company, the Client shall notify the Agent of that fact in writing within 7 working days from the introduction, failing which the Client will be liable to pay the fee.

4. Candidate
Candidate means any person who is introduced to the Client by providing the Curriculum Vitae.

5. Acceptance
By interviewing a Candidate for employment or by agreeing to engage or make use of such a Candidate in any position of employment or work the Client is deemed to have acceptance of these terms of business.

6. Confidentiality
Introductions are strictly confidential and any information relating to a Candidate must not be passed on to another employer or any other person without express agreement of the Agent in writing. A breach of this clause will give rise to the Client being charged the Fee in accordance with Clauses 13 below. The Agent will take all reasonable steps to protect the security of information provided by both Clients and Candidates in accordance with relevant law of the jurisdiction.

7. Notification
The Client shall notify the Agent immediately a Candidate is engaged or an offer of employment is made.

8. Suitability
The Agent endeavors to make every reasonable effort to ensure the suitability of Candidates selected on behalf of the Client. The Client is responsible for the taking up of references and in establishing the Candidate's professional qualifications, capabilities, integrity, medical history and suitability to meet the Client's requirements. The Client is responsible for obtaining a work permit for the Candidate where necessary, verifying all references and qualifications, and arranging for any required medical examinations and investigations as may be required.

9. Date of Engagement
The date of engagement is the date a Candidate commences employment with the Client in any capacity relating to the activity of the Client.

10. Referral
If the Client or a member of the Client's staff refers a Candidate to some other employer or person and that other employer or person engages the Candidate in any capacity whether temporary, permanent or self employed the Client shall pay the full fee as defined in Clauses 13, at the date of notification or discovery by the Agent.

11. Indirect Introduction
The Client shall be liable to pay the Agent's full fee in accordance with Clauses 13, if it refers the Candidate to its subsidiary or associated companies or any third party which engages the Candidate or in any event where an engagement results directly or indirectly from the introduction of the Agent.

12. Effective Period of Introduction
If within one year of an introduction the Client engages the candidate introduced by the Agent, a full fee will be charged.

13. FEES for employment under client's contract

a. Fee on engagement.
No fee is charged until a Candidate is boarded. The minimum service charge is at HK$45,000.

b. The Fee Payable
The fee payable to the Agent by the Client for the introduction of a Candidate is calculated as set out below on the gross remuneration which the Candidate is entitled to earn during the first 12 months of his/her engagement by the Client. The total first year's remuneration includes Base Salary, Fixed Allowance, and Guaranteed Bonuses only.

{{feeScalePermanentTable}}

{{feeScaleContractTable}}

c. Interim Executive (Temporary assignments) or Temporary-to-Permanent Engagement
If the Client engages a Candidate on a temporary or fixed term contract, the fees to be paid will be calculated proportionally based on the annual remuneration package specified in paragraph 13.b. If the Client later decides to offer permanent employment to the interim executive (Candidate), additional fees will be charged as specified in paragraph 13.b. for permanent placements and deducted the amount from any temporary fees previously paid.

14. Contracts
If there is any dispute relating to the calculation of the Agent's fee the Client shall supply the Agent with all relevant documentation and correspondence which evidences the conditions of employment or engagement between the Client and the Candidate.

15. Replacement Policy
If the engagement of any candidate terminates within the guaranteed period (including the notice period) from the date of commencement of engagement, HR Plus (Talent) will provide only one free replacement candidate to the client. Where the Remuneration of the second Candidate is greater than the first Candidate, the final invoice will be adjusted where appropriate. If the second candidate's salary is lower than that of the first candidate, no additional charges will be incurred, and no credit note refund will be made.

The Agent will conduct a replacement search for 90 days from the date of termination or resignation. If a replacement is not found within 90 days and the Client will be issued a pro-rata credit note calculated to the nearest day. The credit note will be valid for 12 months after issuance and can be used against future business for permanent recruitment staffing.

Calculation Formula:
Credit Note = Introduction Fee x (Days of Guaranteed period - number of employment day) / Days of Guaranteed period

16. Liability
No warranty or representation express or implied is given in respect of any Candidate introduced and no liability can be accepted by the Agent for any failure of a Candidate to perform or comply with his/her terms of employment or engagement, or for any loss, expense, damage or delay however occasioned arising from the introduction of the Candidate or his/her employment by the Client.

17. Law and Jurisdiction
These terms and conditions shall be governed by and construed in accordance with the law of the Hong Kong Special Administrative Region of The People's Republic of China and any disputes shall be handled under the exclusive jurisdiction of the Hong Kong Special Administrative Region of The People's Republic of China courts.`;

/**
 * Simplified Chinese translation of the same 17-clause structure above —
 * same {{placeholders}}, same clause numbering/lettering convention (Arabic
 * numerals + "." so RecruitmentAgreementPdf.tsx's heading-detection regex
 * still matches unmodified), same commercial figures (HK$45,000 minimum fee,
 * 90-day replacement search window) as the English master, just translated.
 * This is the single authored Chinese source — RECRUITMENT_TERMS_TEMPLATE_ZH_HANT
 * below is derived from THIS text via script conversion rather than
 * hand-duplicated, so the two Chinese versions can never drift apart.
 */
export const RECRUITMENT_TERMS_TEMPLATE_ZH_HANS = `1. 一般定义及生效日期
本条款及条件自客户及中介的获授权代表签署当日起生效，并取代HR Plus（Talent）Limited（"中介"）与{{clientCompanyName}}（"客户"）之间，就中华人民共和国香港特别行政区及海外的雇佣介绍事宜所订立的所有先前条款及条件。本服务协议有效期为三（3）年，届满后将自动续期，除非任何一方在届满前至少三十（30）天以书面方式提出终止通知。

2. 变更
除非经中介董事以书面确认，否则对本条款作出的任何更改概属无效，且对HR Plus（Talent）Limited不具约束力。

3. 付款
所有费用及收费须以港币支付予中介"HR Plus（Talent）Limited"，并于发票开出后结付，须于{{paymentDueDays}}天内清付。如中介向客户介绍的候选人，客户已因直接接触或经由其他公司接触而知悉，客户须于获得介绍后7个工作日内以书面方式通知中介，否则客户仍须支付有关费用。

4. 候选人
候选人指中介透过提供履历向客户介绍的任何人士。

5. 接受
凡客户为聘用目的而面试候选人，或同意聘用或使用该候选人担任任何职位或从事任何工作，均视为客户已接受本业务条款。

6. 保密
所有介绍均属严格保密，任何有关候选人的资料，未经中介书面明确同意，不得转交予其他雇主或任何其他人士。违反本条款将导致客户须按下文第13条支付有关费用。中介将采取一切合理措施，按相关司法管辖区之法律，保障客户及候选人所提供资料的安全。

7. 通知
候选人一经获聘或获提供任何雇佣要约，客户须立即通知中介。

8. 合适性
中介将尽一切合理努力，确保为客户挑选的候选人合乎要求。客户须自行负责查核候选人的推荐人资料，并确立候选人的专业资格、工作能力、诚信、病历及是否符合客户的要求。客户亦须负责在有需要时为候选人申办工作许可、核实一切推荐人资料及专业资格，并安排候选人接受任何所需的体格检查及调查。

9. 受聘日期
受聘日期指候选人以任何与客户业务活动有关的身份，开始受聘于客户之日。

10. 转介
如客户或客户任何职员将候选人转介予其他雇主或人士，而该其他雇主或人士以任何形式（临时、长期或自雇）聘用该候选人，客户须于中介获悉或发现该情况当日，按第13条所定全数支付费用。

11. 间接介绍
如客户将候选人转介予其附属公司、关联公司，或任何直接或间接与中介之介绍有关的第三方，而该转介导致该候选人获聘用，或聘用关系直接或间接因中介之介绍而产生，客户须按第13条向中介支付全数费用。

12. 介绍的有效期
如客户于获中介介绍候选人后一年内聘用或重新聘用该候选人，且尚未于该年内就该候选人支付全数费用，中介将收取全数费用。

13. 客户聘用之费用

a. 聘用时收费
候选人正式上班前，中介不会收取任何费用。任何单一聘用的最低服务费为港币45,000元。

b. 应付费用
客户因中介介绍候选人而须支付予中介的费用，按候选人于获客户聘用首12个月内有权获得的薪酬总额，以下列方式计算。首年薪酬总额仅包括基本薪金、固定津贴及保证奖金。

{{feeScalePermanentTable}}

{{feeScaleContractTable}}

c. 临时行政人员（短期委派）或临时转为长期聘用
如客户以临时或固定期限合约聘用候选人，应付费用将按第13.b段所定年薪总额比例计算。如客户其后决定向该临时行政人员（候选人）提供长期聘用，则须按第13.b段所定永久聘用费用另行收取，并从先前已支付的临时费用中扣除相应金额。

14. 合约
如就中介费用之计算产生任何争议，客户须向中介提供一切能证明客户与候选人之间雇佣或聘用条件的相关文件及往来函件。

15. 替换服务
如任何候选人的聘用于保证期内（包括通知期）自受聘日期起终止，HR Plus（Talent）将向客户提供一名免费替换候选人。如第二名候选人的薪酬高于第一名候选人，最终发票将作相应调整；如第二名候选人的薪酬低于第一名候选人，则不会产生额外费用，亦不会退还信用票据。

中介将自终止或辞职日起进行为期90天的替换搜寻。如于90天内未能找到替换人选，而该职位已被冻结、客户预算被取消，或已透过其他渠道填补，中介将按最接近的天数向客户发出按比例计算的信用票据。该信用票据自发出日起12个月内有效，可用于抵扣日后长期聘用招聘服务的费用，或经中介同意转让予客户。

计算公式：
信用票据 = 介绍费 ×（保证期天数 - 已聘用天数）/ 保证期天数

16. 责任声明
中介对所介绍的任何候选人，概不作任何明示或暗示的保证或陈述；对于候选人未能履行或遵守其雇佣或聘用条款，或因介绍候选人或客户聘用该候选人而引致的任何损失、开支、损害或延误，中介概不承担任何责任。

17. 适用法律及司法管辖权
本条款及条件受中华人民共和国香港特别行政区法律管辖，并按该法律解释。任何争议均须受香港特别行政区法院之专属司法管辖权管辖。`;

// Traditional Chinese, derived automatically from the Simplified master
// above via OpenCC's phrase-level (not naive per-character) conversion —
// the same library/approach already used by src/lib/chineseSearch.ts — so
// there's only ever one Chinese source to maintain. "hk" targets Hong Kong
// Traditional Chinese conventions specifically, matching the company's own
// jurisdiction (as opposed to "tw"/Taiwan conventions, which differ in a
// handful of character/phrase choices).
//
// One known gap manually patched below: OpenCC's cn->hk table does not
// convert 户 to 戶 in any context (verified directly — 賬户/門户/客户 all
// come back with 户 left as-is), even though 戶 is the correct standard
// Traditional form used throughout Hong Kong (e.g. 客戶, 戶口). Every other
// character/phrase in this template converts correctly; 户 only ever
// appears here as part of 客户 ("Client"), so a single global replace after
// conversion is a safe, verified fix rather than a blind assumption.
const toTraditionalHK = Converter({ from: "cn", to: "hk" });
export const RECRUITMENT_TERMS_TEMPLATE_ZH_HANT = toTraditionalHK(RECRUITMENT_TERMS_TEMPLATE_ZH_HANS).replace(
  /户/g,
  "戶"
);

export const RECRUITMENT_TERMS_TEMPLATES: Record<RecruitmentLanguage, string> = {
  EN: RECRUITMENT_TERMS_TEMPLATE,
  ZH_HANS: RECRUITMENT_TERMS_TEMPLATE_ZH_HANS,
  ZH_HANT: RECRUITMENT_TERMS_TEMPLATE_ZH_HANT,
};

const CLIENT_NAME_PLACEHOLDER = /\{\{\s*clientCompanyName\s*\}\}/g;
const PAYMENT_DAYS_PLACEHOLDER = /\{\{\s*paymentDueDays\s*\}\}/g;
const FEE_SCALE_PERMANENT_PLACEHOLDER = /\{\{\s*feeScalePermanentTable\s*\}\}/g;
const FEE_SCALE_CONTRACT_PLACEHOLDER = /\{\{\s*feeScaleContractTable\s*\}\}/g;

/** Substitute every placeholder into the recruitment terms template.
 *  `feeScaleTables` defaults to the built-in fallback figures so this still
 *  renders sensibly even before the fee scale library has been fetched. */
export function renderRecruitmentTerms(
  template: string,
  companyName: string,
  paymentDueDays: number,
  feeScaleTables: FeeScaleTables = DEFAULT_FEE_SCALE_TABLES
): string {
  const days = Number.isFinite(paymentDueDays) ? paymentDueDays : DEFAULT_RECRUITMENT_PAYMENT_DUE_DAYS;
  const name = companyName.trim() || "________________________";
  // Function replacers (not plain strings) so a "$" in a company name or fee
  // figure (e.g. "HK$1 mil") is never misread as a $&/$1-style replacement
  // pattern by String.replace.
  return template
    .replace(CLIENT_NAME_PLACEHOLDER, () => name)
    .replace(PAYMENT_DAYS_PLACEHOLDER, () => String(days))
    .replace(FEE_SCALE_PERMANENT_PLACEHOLDER, () => feeScaleTables.permanent)
    .replace(FEE_SCALE_CONTRACT_PLACEHOLDER, () => feeScaleTables.contract);
}
