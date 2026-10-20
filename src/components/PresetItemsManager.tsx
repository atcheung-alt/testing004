"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, PackageOpen, Search } from "lucide-react";
import ItemImageUpload from "@/components/ItemImageUpload";
import { formatCurrency } from "@/lib/calculations";
import { matchesAnyField } from "@/lib/chineseSearch";
import type { Multiplier, PresetItem } from "@/types";
import { useT } from "@/lib/i18n/client";

type Draft = {
  name: string;
  description: string;
  imageData: string | null;
  unit: string;
  multipliers: Multiplier[];
  unitPrice: number;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  imageData: null,
  unit: "",
  multipliers: [],
  unitPrice: 0,
};

/** Short label for a list of multiplier factors, e.g. "×3 persons, ×2 sessions". */
function multipliersSummary(multipliers: Multiplier[] | undefined): string {
  if (!multipliers || multipliers.length === 0) return "";
  return multipliers.map((m) => `×${m.value}${m.label ? ` ${m.label}` : ""}`).join(", ");
}

function PresetForm({
  initial,
  saving,
  onSave,
  onCancel,
  saveLabel,
}: {
  initial: Draft;
  saving: boolean;
  onSave: (draft: Draft) => void;
  onCancel?: () => void;
  saveLabel: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!draft.name.trim()) {
      setError("The item needs a name.");
      return;
    }
    setError(null);
    onSave(draft);
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
          {t(error)}
        </div>
      )}
      <div className="flex gap-3">
        <ItemImageUpload
          imageData={draft.imageData}
          onChange={(imageData) => setDraft((d) => ({ ...d, imageData }))}
        />
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div>
            <label className="label">{t("Item name *")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("e.g. Website design")}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">{t("Item description")}</label>
            <textarea
              className="input min-h-[54px]"
              placeholder={t("Optional details shown under the item name")}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div>
          <label className="label">{t("Unit")}</label>
          <input
            type="text"
            className="input"
            placeholder={t("e.g. pcs, hrs")}
            value={draft.unit}
            onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">{t("Unit price")}</label>
          <input
            type="number"
            step="any"
            min={0}
            className="input text-right"
            value={draft.unitPrice}
            onChange={(e) => setDraft((d) => ({ ...d, unitPrice: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="max-w-md">
        <label className="label">{t("Multipliers (optional)")}</label>
        {draft.multipliers.length > 0 && (
          <div className="flex flex-col gap-2 mb-2">
            {draft.multipliers.map((m, mi) => (
              <div key={mi} className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="input text-right w-24"
                  placeholder={t("e.g. 3")}
                  value={m.value}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      multipliers: d.multipliers.map((mm, i) =>
                        i === mi ? { ...mm, value: parseFloat(e.target.value) || 0 } : mm
                      ),
                    }))
                  }
                />
                <input
                  type="text"
                  className="input flex-1"
                  placeholder={t("e.g. persons, sessions")}
                  value={m.label}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      multipliers: d.multipliers.map((mm, i) =>
                        i === mi ? { ...mm, label: e.target.value } : mm
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      multipliers: d.multipliers.filter((_, i) => i !== mi),
                    }))
                  }
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
          onClick={() =>
            setDraft((d) => ({ ...d, multipliers: [...d.multipliers, { value: 1, label: "" }] }))
          }
          className="btn-ghost !px-2 text-xs"
        >
          <Plus size={14} /> {t("Add multiplier")}
        </button>
      </div>

      <p className="text-xs text-ink-muted max-w-md">
        {t(
          "For rates like \"per hour × per person\", set Unit to the rate's time unit (e.g. \"hrs\") and add a multiplier for each extra factor (e.g. 2 persons). Amount = qty × unit price × every multiplier's value."
        )}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary">
          {saving ? t("Saving…") : t(saveLabel)}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            {t("Cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PresetItemsManager() {
  const t = useT();
  const [items, setItems] = useState<PresetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Matches regardless of whether an item was saved in Traditional or
  // Simplified Chinese and regardless of which script is typed into the
  // search box — see src/lib/chineseSearch.ts.
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter((item) => matchesAnyField(search, item.name, item.description));
  }, [items, search]);

  async function refresh() {
    const res = await fetch("/api/preset-items");
    setItems(await res.json());
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function create(draft: Draft) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/preset-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the item.");
      await refresh();
      setAdding(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function update(id: string, draft: Draft) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/preset-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the item.");
      await refresh();
      setEditingId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: PresetItem) {
    if (!window.confirm(t("Delete \"{name}\" from the item library?", { name: item.name }))) return;
    setError(null);
    try {
      const res = await fetch(`/api/preset-items/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete the item.");
      await refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
          {t(error)}
        </div>
      )}

      {adding ? (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold mb-4">{t("New Preset Item")}</h2>
          <PresetForm
            initial={emptyDraft}
            saving={saving}
            saveLabel="Add to library"
            onSave={create}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className="btn-primary">
            <Plus size={15} /> {t("New Preset Item")}
          </button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            className="input pl-9"
            placeholder={t("Search by name or description…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">{t("Loading…")}</p>
      ) : items.length === 0 && !adding ? (
        <div className="card p-8 flex flex-col items-center text-center gap-2">
          <PackageOpen size={28} className="text-ink-faint" />
          <p className="font-medium">{t("No preset items yet")}</p>
          <p className="text-sm text-ink-muted max-w-sm">
            {t(
              "Build a library of standardized items — each one can be picked from a dropdown when creating quotations and invoices."
            )}
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-ink-faint py-6 text-center">{t("No items match \"{query}\".", { query: search })}</p>
      ) : (
        <div className="card divide-y divide-line">
          {filteredItems.map((item) =>
            editingId === item.id ? (
              <div key={item.id} className="p-5">
                <PresetForm
                  initial={{
                    name: item.name,
                    description: item.description,
                    imageData: item.imageData || null,
                    unit: item.unit,
                    multipliers: (item.multipliers || []).map((m) => ({ ...m })),
                    unitPrice: item.unitPrice,
                  }}
                  saving={saving}
                  saveLabel="Save changes"
                  onSave={(draft) => update(item.id, draft)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div key={item.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                {item.imageData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageData}
                    alt={item.name}
                    className="w-12 h-12 object-cover rounded-md border border-line shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-md border border-dashed border-line shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-ink-muted truncate">{item.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm">{formatCurrency(item.unitPrice)}</p>
                  {item.unit && <p className="text-xs text-ink-muted">{t("per {unit}", { unit: item.unit })}</p>}
                  {item.multipliers && item.multipliers.length > 0 && (
                    <p className="text-xs text-ink-muted">{multipliersSummary(item.multipliers)}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setEditingId(item.id);
                    }}
                    aria-label={t("Edit {name}", { name: item.name })}
                    className="p-2 text-ink-faint hover:text-brand-600 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={t("Delete {name}", { name: item.name })}
                    className="p-2 text-ink-faint hover:text-danger-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
