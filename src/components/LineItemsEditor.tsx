"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, PackagePlus, X, Search, ChevronUp, ChevronDown } from "lucide-react";
import clsx from "clsx";
import ItemImageUpload from "@/components/ItemImageUpload";
import Portal from "@/components/Portal";
import { computeTotals, lineAmount, lineTotalWithFee, formatCurrency } from "@/lib/calculations";
import { matchesAnyField } from "@/lib/chineseSearch";
import { lineItemTemplateKey } from "@/lib/lineItemTemplates";
import type { LineItem, Multiplier, Fee, PresetItem } from "@/types";
import { useT } from "@/lib/i18n/client";

type HistoryTemplate = {
  name: string;
  description: string;
  unit: string;
  unitPrice: number;
  multipliers: Multiplier[];
  duration: string;
  fees: Fee[];
  useCount: number;
};

type ItemSuggestion = HistoryTemplate & {
  key: string;
  imageData?: string | null;
  inLibrary: boolean;
};

type Props = {
  items: LineItem[];
  onItemsChange: (items: LineItem[]) => void;
  taxRate: number;
  onTaxRateChange: (v: number) => void;
  discount: number;
  onDiscountChange: (v: number) => void;
  // Quotation-only: how many times the whole item list is conducted (e.g. a
  // training run 3 times) — multiplies the item subtotal before Discount/Tax.
  // Omitted entirely by InvoiceForm, which has no repeat concept; the
  // "Repeat count" input and its breakdown row only render when a change
  // handler is passed in.
  repeatCount?: number;
  onRepeatCountChange?: (v: number) => void;
};

export function emptyLineItem(): LineItem {
  return {
    name: "",
    description: "",
    imageData: null,
    unit: "",
    quantity: 1,
    multipliers: [],
    unitPrice: 0,
    amount: 0,
    duration: "",
    fees: [],
  };
}

/** True for a freshly-added row the user hasn't touched yet. */
function isBlankItem(item: LineItem): boolean {
  return (
    !item.name.trim() &&
    !item.description.trim() &&
    !item.imageData &&
    !item.unit.trim() &&
    !item.unitPrice
  );
}

function lineItemFromPreset(preset: PresetItem): LineItem {
  const quantity = 1;
  const multipliers = (preset.multipliers || []).map((m) => ({ ...m }));
  return {
    name: preset.name,
    description: preset.description,
    imageData: preset.imageData || null,
    unit: preset.unit,
    quantity,
    multipliers,
    unitPrice: preset.unitPrice,
    amount: lineAmount({ quantity, multipliers, unitPrice: preset.unitPrice }),
    // The item library doesn't carry a duration or fees — start blank; can
    // be filled in per-document after adding from the library.
    duration: "",
    fees: [],
  };
}

/** Short label for a list of multiplier factors, e.g. "×3 persons, ×2 sessions". */
function multipliersSummary(multipliers: Multiplier[] | undefined): string {
  if (!multipliers || multipliers.length === 0) return "";
  return multipliers.map((m) => `×${m.value}${m.label ? ` ${m.label}` : ""}`).join(", ");
}

export default function LineItemsEditor({
  items,
  onItemsChange,
  taxRate,
  onTaxRateChange,
  discount,
  onDiscountChange,
  repeatCount,
  onRepeatCountChange,
}: Props) {
  const t = useT();
  const showRepeatCount = Boolean(onRepeatCountChange);
  const effectiveRepeatCount = repeatCount || 1;
  const totals = computeTotals(items, taxRate, discount, effectiveRepeatCount);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [history, setHistory] = useState<HistoryTemplate[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState<number | null>(null);
  const [highlight, setHighlight] = useState(0);

  useEffect(() => {
    fetch("/api/preset-items")
      .then((res) => res.json())
      .then((data) => setPresets(Array.isArray(data) ? data : []))
      .catch(() => setPresets([]))
      .finally(() => setPresetsLoaded(true));
    fetch("/api/line-item-history")
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoaded(true));
  }, []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [presetSearch, setPresetSearch] = useState("");

  function updateItem(index: number, patch: Partial<LineItem>) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onItemsChange(next);
  }

  function addMultiplier(itemIndex: number) {
    const item = items[itemIndex];
    const multipliers = [...item.multipliers, { value: 1, label: "" }];
    updateItem(itemIndex, { multipliers, amount: lineAmount({ ...item, multipliers }) });
  }

  function updateMultiplier(itemIndex: number, multIndex: number, patch: Partial<Multiplier>) {
    const item = items[itemIndex];
    const multipliers = item.multipliers.map((m, i) => (i === multIndex ? { ...m, ...patch } : m));
    updateItem(itemIndex, { multipliers, amount: lineAmount({ ...item, multipliers }) });
  }

  function removeMultiplier(itemIndex: number, multIndex: number) {
    const item = items[itemIndex];
    const multipliers = item.multipliers.filter((_, i) => i !== multIndex);
    updateItem(itemIndex, { multipliers, amount: lineAmount({ ...item, multipliers }) });
  }

  function addFee(itemIndex: number) {
    const item = items[itemIndex];
    updateItem(itemIndex, { fees: [...item.fees, { label: "", amount: 0 }] });
  }

  function updateFee(itemIndex: number, feeIndex: number, patch: Partial<Fee>) {
    const item = items[itemIndex];
    const fees = item.fees.map((f, i) => (i === feeIndex ? { ...f, ...patch } : f));
    updateItem(itemIndex, { fees });
  }

  function removeFee(itemIndex: number, feeIndex: number) {
    const item = items[itemIndex];
    const fees = item.fees.filter((_, i) => i !== feeIndex);
    updateItem(itemIndex, { fees });
  }

  function openPicker() {
    setSelectedIds(new Set());
    setPresetSearch("");
    setPickerOpen(true);
  }

  function togglePreset(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /** Add every checked preset as a new line item in one go. A single
   *  untouched blank row (the default starting state) is replaced rather
   *  than left dangling above the newly-added items. */
  function addSelectedPresets() {
    const chosen = presets.filter((p) => selectedIds.has(p.id));
    if (chosen.length > 0) {
      const newLines = chosen.map(lineItemFromPreset);
      const onlyBlankRow = items.length === 1 && isBlankItem(items[0]);
      onItemsChange(onlyBlankRow ? newLines : [...items, ...newLines]);
    }
    setPickerOpen(false);
  }

  function suggestionsFor(query: string): ItemSuggestion[] {
    const byKey = new Map<string, ItemSuggestion>();

    for (const item of history) {
      const key = lineItemTemplateKey(item);
      byKey.set(key, {
        ...item,
        key,
        imageData: null,
        inLibrary: false,
        fees: item.fees || [],
        multipliers: item.multipliers || [],
        duration: item.duration || "",
      });
    }

    for (const preset of presets) {
      const key = lineItemTemplateKey(preset);
      const existing = byKey.get(key);
      if (existing) {
        existing.inLibrary = true;
        existing.imageData = preset.imageData || existing.imageData;
        continue;
      }
      byKey.set(key, {
        key,
        name: preset.name,
        description: preset.description || "",
        imageData: preset.imageData,
        unit: preset.unit || "",
        unitPrice: preset.unitPrice || 0,
        multipliers: preset.multipliers || [],
        duration: "",
        fees: [],
        useCount: 0,
        inLibrary: true,
      });
    }

    let list = [...byKey.values()];
    if (query.trim()) {
      list = list.filter((item) => matchesAnyField(query, item.name, item.description, item.unit));
    }
    list.sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name));
    return list.slice(0, query.trim() ? 8 : 6);
  }

  function applyTemplate(index: number, template: ItemSuggestion) {
    const item = items[index];
    const quantity = item.quantity > 0 ? item.quantity : 1;
    const multipliers = template.multipliers.map((m) => ({ ...m }));
    const fees = template.fees.map((f) => ({ ...f }));
    const presetImage = presets.find(
      (preset) => preset.name.trim().toLowerCase() === template.name.trim().toLowerCase()
    )?.imageData;
    updateItem(index, {
      name: template.name,
      description: template.description,
      imageData: template.imageData || presetImage || null,
      unit: template.unit,
      quantity,
      multipliers,
      unitPrice: template.unitPrice,
      amount: lineAmount({ quantity, multipliers, unitPrice: template.unitPrice }),
      duration: template.duration,
      fees,
    });
    setActiveSuggest(null);
  }

  // Matches regardless of whether the item was saved in Traditional or
  // Simplified Chinese and regardless of which script this search box is
  // typed in — see src/lib/chineseSearch.ts.
  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return presets;
    return presets.filter((p) => matchesAnyField(presetSearch, p.name, p.description));
  }, [presets, presetSearch]);

  function addItem() {
    onItemsChange([...items, emptyLineItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      onItemsChange([emptyLineItem()]);
      return;
    }
    onItemsChange(items.filter((_, i) => i !== index));
  }

  /** Swap a line item with its neighbor above/below — the only reordering
   *  the PDF/on-screen table needs, since items always render top to
   *  bottom in array order. */
  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onItemsChange(next);
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div
            key={index}
            className={clsx(
              "bg-surface border border-line rounded-md p-3 sm:p-4",
              activeSuggest === index && "relative z-20"
            )}
          >
            <div className="flex gap-3">
              <ItemImageUpload
                imageData={item.imageData}
                onChange={(imageData) => updateItem(index, { imageData })}
              />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="relative">
                  <label className="label">{t("Item name")}</label>
                  <input
                    type="text"
                    className="input"
                    placeholder={t("Search past items, or type a new name")}
                    value={item.name}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={activeSuggest === index}
                    aria-autocomplete="list"
                    onFocus={() => {
                      setActiveSuggest(index);
                      setHighlight(0);
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setActiveSuggest((current) => (current === index ? null : current));
                      }, 120);
                    }}
                    onChange={(e) => {
                      updateItem(index, { name: e.target.value });
                      setActiveSuggest(index);
                      setHighlight(0);
                    }}
                    onKeyDown={(e) => {
                      if (activeSuggest !== index) return;
                      const suggestions = suggestionsFor(item.name);
                      if (e.key === "Escape") {
                        setActiveSuggest(null);
                        return;
                      }
                      if (suggestions.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlight((current) => (current + 1) % suggestions.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlight((current) => (current - 1 + suggestions.length) % suggestions.length);
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        applyTemplate(index, suggestions[Math.min(highlight, suggestions.length - 1)]);
                      }
                    }}
                  />
                  {activeSuggest === index && (
                    <ItemSuggestionList
                      query={item.name}
                      suggestions={suggestionsFor(item.name)}
                      highlight={highlight}
                      loading={!historyLoaded || !presetsLoaded}
                      onHighlight={setHighlight}
                      onPick={(template) => applyTemplate(index, template)}
                    />
                  )}
                </div>
                <div>
                  <label className="label">{t("Item description")}</label>
                  <textarea
                    className="input min-h-[54px]"
                    placeholder={t("Optional details, e.g. 8 responsive pages incl. CMS setup")}
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                  />
                </div>
              </div>
              <div className="self-start shrink-0 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label={t("Move line item up")}
                  title={t("Move up")}
                  className="text-ink-faint hover:text-ink transition-colors disabled:opacity-25 disabled:hover:text-ink-faint"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={t("Remove line item")}
                  className="text-ink-faint hover:text-danger-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={t("Move line item down")}
                  title={t("Move down")}
                  className="text-ink-faint hover:text-ink transition-colors disabled:opacity-25 disabled:hover:text-ink-faint"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="label text-brand-600 font-semibold">{t("Qty")}</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="input text-right border-brand-500/50 focus:border-brand-500 font-semibold"
                  value={item.quantity}
                  onChange={(e) => {
                    const quantity = parseFloat(e.target.value) || 0;
                    updateItem(index, {
                      quantity,
                      amount: lineAmount({ ...item, quantity }),
                    });
                  }}
                />
              </div>
              <div>
                <label className="label text-brand-600 font-semibold">{t("Unit price")}</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="input text-right border-brand-500/50 focus:border-brand-500 font-semibold"
                  value={item.unitPrice}
                  onChange={(e) => {
                    const unitPrice = parseFloat(e.target.value) || 0;
                    updateItem(index, {
                      unitPrice,
                      amount: lineAmount({ ...item, unitPrice }),
                    });
                  }}
                />
              </div>
              <div>
                <label className="label">{t("Unit (optional)")}</label>
                <input
                  type="text"
                  className="input"
                  placeholder={t("e.g. pcs, hrs")}
                  value={item.unit}
                  onChange={(e) => updateItem(index, { unit: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("Amount")}</label>
                <div className="flex items-center justify-end h-[38px] font-mono text-sm font-semibold text-brand-600">
                  {formatCurrency(lineTotalWithFee(item))}
                </div>
              </div>
            </div>

            <div className="mt-3 max-w-[200px]">
              <label className="label text-ink-faint">{t("Duration (optional)")}</label>
              <input
                type="text"
                className="input text-sm"
                placeholder={t("e.g. 3 hours")}
                value={item.duration || ""}
                onChange={(e) => updateItem(index, { duration: e.target.value })}
              />
              <p className="text-xs text-ink-faint mt-1">{t("Display only — doesn't affect the total.")}</p>
            </div>

            <div className="mt-3">
              <label className="label">{t("Multipliers (optional)")}</label>
              {item.multipliers.length > 0 && (
                <div className="flex flex-col gap-2 mb-2">
                  {item.multipliers.map((m, mi) => (
                    <div key={mi} className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="input text-right w-24"
                        placeholder={t("e.g. 3")}
                        value={m.value}
                        onChange={(e) =>
                          updateMultiplier(index, mi, {
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                      <input
                        type="text"
                        className="input flex-1"
                        placeholder={t("e.g. persons, sessions")}
                        value={m.label}
                        onChange={(e) => updateMultiplier(index, mi, { label: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeMultiplier(index, mi)}
                        aria-label={t("Remove multiplier")}
                        className="text-ink-faint hover:text-danger-500 transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => addMultiplier(index)}
                className="btn-ghost !px-2 text-xs"
              >
                <Plus size={14} /> {t("Add multiplier")}
              </button>
              {item.multipliers.length > 0 && (
                <p className="text-xs text-ink-muted mt-1">
                  {t("Amount = qty × unit price × {summary}", { summary: multipliersSummary(item.multipliers) })}
                  {item.fees.length > 0 ? t(" + additional fees") : ""}
                </p>
              )}
              {!item.multipliers.length && item.fees.length > 0 && (
                <p className="text-xs text-ink-muted mt-1">
                  {t("Amount shown includes the additional fees below.")}
                </p>
              )}
            </div>

            <div className="mt-3">
              <label className="label">{t("Additional fees (optional)")}</label>
              {item.fees.length > 0 && (
                <div className="flex flex-col gap-2 mb-2">
                  {item.fees.map((fee, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <input
                        type="text"
                        className="input flex-1"
                        placeholder={t("e.g. Transportation fee")}
                        value={fee.label}
                        onChange={(e) => updateFee(index, fi, { label: e.target.value })}
                      />
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="input text-right w-28"
                        placeholder={t("Amount")}
                        value={fee.amount}
                        onChange={(e) => updateFee(index, fi, { amount: parseFloat(e.target.value) || 0 })}
                      />
                      <button
                        type="button"
                        onClick={() => removeFee(index, fi)}
                        aria-label={t("Remove fee")}
                        className="text-ink-faint hover:text-danger-500 transition-colors shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => addFee(index)}
                className="btn-ghost !px-2 text-xs"
              >
                <Plus size={14} /> {t("Add fee")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {presetsLoaded && (
          <button type="button" onClick={openPicker} className="btn-secondary">
            <PackagePlus size={15} /> {t("Add from Item Library")}
          </button>
        )}
        <button type="button" onClick={addItem} className="btn-ghost !px-2">
          <Plus size={15} /> {t("Add line item")}
        </button>
      </div>

      {pickerOpen && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setPickerOpen(false)}
          />
          <div className="relative w-full max-w-lg card p-6 max-h-[85vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">{t("Add from Item Library")}</h2>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-ink-faint hover:text-ink"
                aria-label={t("Close")}
              >
                <X size={18} />
              </button>
            </div>

            {presets.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("No saved items yet. Type the line on the activity, or pick one you have used before.")}</p>
            ) : (
              <>
                <div className="relative mb-3 shrink-0">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
                  />
                  <input
                    type="text"
                    className="input pl-9"
                    placeholder={t("Search item library…")}
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto -mx-2 px-2 flex flex-col gap-1">
                  {filteredPresets.length === 0 ? (
                    <p className="text-sm text-ink-faint py-6 text-center">
{t("No items match “{query}”.", { query: presetSearch })}
                    </p>
                  ) : (
                    filteredPresets.map((p) => {
                      const checked = selectedIds.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className={clsx(
                            "flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer transition-colors",
                            checked ? "bg-brand-50" : "hover:bg-paper"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-brand-600 shrink-0"
                            checked={checked}
                            onChange={() => togglePreset(p.id)}
                          />
                          {p.imageData ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageData}
                              alt={p.name}
                              className="w-9 h-9 object-cover rounded-md border border-line shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-md border border-dashed border-line shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-ink-muted truncate">{p.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm">{formatCurrency(p.unitPrice)}</p>
                            {p.unit && <p className="text-xs text-ink-muted">{t("per {unit}", { unit: p.unit })}</p>}
                            {p.multipliers && p.multipliers.length > 0 && (
                              <p className="text-xs text-ink-muted">
                                {multipliersSummary(p.multipliers)}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-line shrink-0">
                  <p className="text-xs text-ink-muted">
                    {selectedIds.size > 0 ? t("{count} selected", { count: selectedIds.size }) : t("Select items to add")}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPickerOpen(false)} className="btn-secondary">
                      {t("Cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={addSelectedPresets}
                      disabled={selectedIds.size === 0}
                      className="btn-primary"
                    >
                      <Plus size={15} />{" "}
                      {selectedIds.size === 1
                        ? t("Add {count} item", { count: selectedIds.size })
                        : t("Add {count} items", { count: selectedIds.size || "" })}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </Portal>
      )}

      <div className="mt-6 flex flex-col sm:flex-row sm:justify-end">
        <div className="w-full sm:w-80 card p-4">
          {showRepeatCount && (
            <div className="mb-3">
              <label className="label">{t("Repeat count")}</label>
              <input
                type="number"
                step="1"
                min={1}
                className="input"
                value={repeatCount ?? 1}
                onChange={(e) => onRepeatCountChange!(Math.max(1, Math.round(parseFloat(e.target.value)) || 1))}
              />
              <p className="text-xs text-ink-faint mt-1">
{t("For work conducted several times (e.g. a training run 3 times) — multiplies the item subtotal before discount and tax.")}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">{t("Discount ($)")}</label>
              <input
                type="number"
                step="any"
                min={0}
                className="input"
                value={discount}
                onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label">{t("Tax rate (%)")}</label>
              <input
                type="number"
                step="any"
                min={0}
                className="input"
                value={taxRate}
                onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-sm border-t border-line pt-3">
            {showRepeatCount && effectiveRepeatCount > 1 && (
              <>
                <div className="flex justify-between text-ink-muted">
                  <span>{t("Subtotal (per session)")}</span>
                  <span className="font-mono text-ink">{formatCurrency(totals.rawSubtotal)}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>{t("× {count} sessions", { count: effectiveRepeatCount })}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-ink-muted">
              <span>{t("Subtotal")}</span>
              <span className="font-mono text-ink">{formatCurrency(totals.subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-ink-muted">
                <span>{t("Discount")}</span>
                <span className="font-mono text-ink">-{formatCurrency(discount)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between text-ink-muted">
                <span>{t("Tax ({rate}%)", { rate: taxRate })}</span>
                <span className="font-mono text-ink">{formatCurrency(totals.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 mt-1 border-t border-brand-500/40">
              <span className="font-semibold text-brand-600">{t("Total")}</span>
              <span className="font-mono font-semibold text-brand-600 text-base">
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemSuggestionList({
  query,
  suggestions,
  highlight,
  loading,
  onHighlight,
  onPick,
}: {
  query: string;
  suggestions: ItemSuggestion[];
  highlight: number;
  loading: boolean;
  onHighlight: (index: number) => void;
  onPick: (template: ItemSuggestion) => void;
}) {
  const t = useT();
  const active = Math.min(highlight, Math.max(suggestions.length - 1, 0));

  return (
    <div
      role="listbox"
      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-soft"
    >
      {suggestions.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-ink-faint">
          {loading
            ? t("Loading saved items…")
            : query.trim()
              ? t("No saved item matches. Keep typing to enter a new one.")
              : t("No past items yet. Type a new name, or save presets in the item library.")}
        </p>
      ) : (
        suggestions.map((template, index) => (
          <button
            key={template.key}
            type="button"
            role="option"
            aria-selected={index === active}
            className={clsx(
              "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
              index === active ? "bg-brand-50" : "hover:bg-paper"
            )}
            onMouseEnter={() => onHighlight(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(template);
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{template.name}</p>
              {template.description ? (
                <p className="truncate text-xs text-ink-muted">{template.description}</p>
              ) : null}
              <p className="text-[11px] text-ink-faint">
                {template.useCount > 0
                  ? template.useCount === 1
                    ? t("Used {count} time", { count: template.useCount })
                    : t("Used {count} times", { count: template.useCount })
                  : t("Item Library")}
                {template.unit ? t(" · per {unit}", { unit: template.unit }) : ""}
                {template.fees.length > 0
                  ? template.fees.length === 1
                    ? t(" · {count} fee", { count: template.fees.length })
                    : t(" · {count} fees", { count: template.fees.length })
                  : ""}
              </p>
            </div>
            <p className="shrink-0 font-mono text-sm text-ink">{formatCurrency(template.unitPrice)}</p>
          </button>
        ))
      )}
    </div>
  );
}
