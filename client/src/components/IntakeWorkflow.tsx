import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { BarcodeLabel } from "./BarcodeLabel";
import { useApi } from "@/hooks/useApi";
import type { LineItemDto, PurchaseOrderDto } from "@/lib/api";

const lookupSchema = z.object({
  vendor: z.string().min(1, "Vendor is required"),
  orderNumber: z.string().min(1, "Order number is required"),
});

const batchSchema = z.object({
  batchNumber: z.string().min(1, "Batch number is required"),
});

const scanSchema = z.object({
  scannedBarcode: z.string().min(1, "Scan or type the barcode"),
});

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Find order" },
  { n: 2, label: "Line item" },
  { n: 3, label: "Batch & receive" },
  { n: 4, label: "Print label" },
  { n: 5, label: "Confirm scan" },
  { n: 6, label: "Storage" },
  { n: 7, label: "Placed" },
];

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-[var(--color-accent-ring)]";

const cardClass =
  "rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_4px_32px_-8px_rgba(15,23,42,0.08)]";

const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm shadow-teal-600/20 transition hover:bg-[var(--color-accent-hover)] hover:shadow-md disabled:opacity-50";

const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50";

export function IntakeWorkflow() {
  const api = useApi();
  const [step, setStep] = useState<Step>(1);
  const [po, setPo] = useState<PurchaseOrderDto | null>(null);
  const [lineItem, setLineItem] = useState<LineItemDto | null>(null);
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [locationExplanation, setLocationExplanation] = useState<string | null>(
    null,
  );
  const [savedBatchNumber, setSavedBatchNumber] = useState<string | null>(null);
  const [assistantText, setAssistantText] = useState("");
  const [assistantMsg, setAssistantMsg] = useState<string | null>(null);

  const lookupForm = useForm({
    resolver: zodResolver(lookupSchema),
    defaultValues: { vendor: "", orderNumber: "" },
  });

  const batchForm = useForm({
    resolver: zodResolver(batchSchema),
    defaultValues: { batchNumber: "" },
  });

  const scanForm = useForm({
    resolver: zodResolver(scanSchema),
    defaultValues: { scannedBarcode: "" },
  });

  const lookupMutation = useMutation({
    mutationFn: async (v: z.infer<typeof lookupSchema>) => {
      return api.getPurchaseOrder(v.vendor.trim(), v.orderNumber.trim());
    },
    onSuccess: (data) => {
      setPo(data);
      setStep(2);
    },
  });

  const assistantMutation = useMutation({
    mutationFn: (text: string) => api.parseIntakeNotes(text),
    onSuccess: (parsed) => {
      if (parsed.vendor) lookupForm.setValue("vendor", parsed.vendor);
      if (parsed.orderNumber) lookupForm.setValue("orderNumber", parsed.orderNumber);
      if (parsed.batchNumber) batchForm.setValue("batchNumber", parsed.batchNumber);
      setAssistantMsg(
        parsed.confidence === "high"
          ? "Parsed with high confidence — review fields and continue."
          : parsed.notes ??
              "Some fields could not be inferred — fill the rest manually.",
      );
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (batchNumber: string) => {
      if (!po || !lineItem) throw new Error("Missing selection");
      return api.markReceived(po.purchaseOrderId, lineItem.id, batchNumber);
    },
    onSuccess: (data, batchNumber) => {
      setSavedBatchNumber(batchNumber);
      setInventoryItemId(data.inventoryItemId);
      setStep(4);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!inventoryItemId) throw new Error("No inventory item");
      return api.generateBarcode(inventoryItemId);
    },
    onSuccess: (data) => {
      setBarcode(data.barcode);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (scanned: string) => {
      if (!inventoryItemId) throw new Error("No inventory item");
      await api.scanBarCodeForInventoryItem(scanned.trim(), inventoryItemId);
    },
    onSuccess: () => setStep(6),
  });

  const determineMutation = useMutation({
    mutationFn: async () => {
      if (!inventoryItemId) throw new Error("No inventory item");
      return api.determineStorageWithExplanation(inventoryItemId);
    },
    onSuccess: (data) => {
      setLocation(data.location);
      setLocationExplanation(data.explanation);
    },
  });

  const confirmPlacementMutation = useMutation({
    mutationFn: async () => {
      if (!inventoryItemId || !location) throw new Error("Missing data");
      await api.confirmStorageLocation(inventoryItemId, location);
    },
    onSuccess: () => setStep(7),
  });

  const resetFlow = useCallback(() => {
    setStep(1);
    setPo(null);
    setLineItem(null);
    setInventoryItemId(null);
    setBarcode(null);
    setLocation(null);
    setLocationExplanation(null);
    setSavedBatchNumber(null);
    lookupForm.reset();
    batchForm.reset();
    scanForm.reset();
  }, [lookupForm, batchForm, scanForm]);

  const printLabel = () => window.print();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row md:gap-12">
      <div className="min-w-0 flex-1">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-teal-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-800 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
            Manufacturing · Receiving
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Chemical inventory intake
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
            Find the purchase order, log the batch from the bottle, print and
            confirm the barcode, then place material in the assigned location.
          </p>
        </header>

        <nav className="no-print mb-10 flex flex-wrap gap-2">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium shadow-sm transition ${
                step === s.n
                  ? "bg-teal-600 text-white shadow-teal-600/25"
                  : step > s.n
                    ? "border border-teal-100 bg-teal-50 text-teal-900"
                    : "border border-slate-200/80 bg-slate-50 text-slate-400"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step === s.n
                    ? "bg-white/20 text-white"
                    : step > s.n
                      ? "bg-teal-200/80 text-teal-900"
                      : "bg-slate-200/80 text-slate-500"
                }`}
              >
                {s.n}
              </span>
              {s.label}
            </div>
          ))}
        </nav>

        {step === 1 && (
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">Find purchase order</h2>
            <form
              className="mt-5 space-y-5"
              onSubmit={lookupForm.handleSubmit((v) => lookupMutation.mutate(v))}
            >
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  Vendor
                </label>
                <input className={inputClass} {...lookupForm.register("vendor")} placeholder="e.g. Sigma-Aldrich" />
                {lookupForm.formState.errors.vendor && (
                  <p className="mt-1.5 text-sm text-red-600">
                    {lookupForm.formState.errors.vendor.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  Order number
                </label>
                <input
                  className={inputClass}
                  {...lookupForm.register("orderNumber")}
                  placeholder="e.g. PO-2024-7782"
                />
                {lookupForm.formState.errors.orderNumber && (
                  <p className="mt-1.5 text-sm text-red-600">
                    {lookupForm.formState.errors.orderNumber.message}
                  </p>
                )}
              </div>
              {lookupMutation.isError && (
                <p className="text-sm text-red-600">{(lookupMutation.error as Error).message}</p>
              )}
              <button type="submit" disabled={lookupMutation.isPending} className={btnPrimary}>
                {lookupMutation.isPending ? "Searching…" : "Find order"}
              </button>
            </form>
          </section>
        )}

        {step === 2 && po && (
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">Select line item</h2>
            <p className="mt-1 text-sm text-slate-500">
              Order <span className="font-mono font-medium text-slate-700">{po.orderNumber}</span>
              {" · "}
              {po.vendor}
            </p>
            <ul className="mt-5 space-y-2.5">
              {po.lineItems.map((li) => (
                <li key={li.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setLineItem(li);
                      setStep(3);
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-left transition hover:border-teal-300 hover:bg-teal-50/50"
                  >
                    <span className="font-semibold text-slate-900">{li.chemical}</span>
                    <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-slate-500 shadow-sm">
                      {li.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-5 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              ← Back to search
            </button>
          </section>
        )}

        {step === 3 && po && lineItem && (
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">Receive material</h2>
            <p className="mt-1 text-sm text-slate-500">{lineItem.chemical}</p>
            <form
              className="mt-5 space-y-5"
              onSubmit={batchForm.handleSubmit((v) =>
                receiveMutation.mutate(v.batchNumber.trim()),
              )}
            >
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  Batch number (from bottle)
                </label>
                <input
                  className={`${inputClass} font-mono`}
                  {...batchForm.register("batchNumber")}
                  placeholder="e.g. AX-9921"
                />
                {batchForm.formState.errors.batchNumber && (
                  <p className="mt-1.5 text-sm text-red-600">
                    {batchForm.formState.errors.batchNumber.message}
                  </p>
                )}
              </div>
              {receiveMutation.isError && (
                <p className="text-sm text-red-600">{(receiveMutation.error as Error).message}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={receiveMutation.isPending} className={btnPrimary}>
                  {receiveMutation.isPending ? "Saving…" : "Mark received"}
                </button>
                <button type="button" onClick={() => setStep(2)} className={btnSecondary}>
                  Back
                </button>
              </div>
            </form>
          </section>
        )}

        {step === 4 && inventoryItemId && (
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">Print barcode label</h2>
            <p className="mt-1 text-sm text-slate-500">
              Generate a label and attach it to the container before scanning.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className={btnPrimary}
              >
                {generateMutation.isPending ? "Generating…" : "Generate barcode"}
              </button>
              {barcode && (
                <button type="button" onClick={printLabel} className={btnSecondary}>
                  Print label
                </button>
              )}
            </div>
            {generateMutation.isError && (
              <p className="mt-3 text-sm text-red-600">{(generateMutation.error as Error).message}</p>
            )}
            {barcode && (
              <div className="print-only mt-6 hidden print:block">
                <BarcodeLabel value={barcode} />
              </div>
            )}
            {barcode && (
              <div className="no-print mt-6 max-w-sm">
                <BarcodeLabel value={barcode} />
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  Label attached — continue to scan
                </button>
              </div>
            )}
          </section>
        )}

        {step === 5 && inventoryItemId && (
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">Confirm barcode</h2>
            <p className="mt-1 text-sm text-slate-500">
              Most scanners act as a keyboard — click the field and scan, or paste the value.
            </p>
            <form
              className="mt-5 space-y-5"
              onSubmit={scanForm.handleSubmit((v) => scanMutation.mutate(v.scannedBarcode))}
            >
              <div>
                <label className="block text-sm font-medium text-slate-600">Scanned barcode</label>
                <input
                  autoFocus
                  className={`${inputClass} font-mono`}
                  {...scanForm.register("scannedBarcode")}
                  placeholder="Scan here"
                />
                {scanForm.formState.errors.scannedBarcode && (
                  <p className="mt-1.5 text-sm text-red-600">
                    {scanForm.formState.errors.scannedBarcode.message}
                  </p>
                )}
              </div>
              {scanMutation.isError && (
                <p className="text-sm text-red-600">{(scanMutation.error as Error).message}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={scanMutation.isPending} className={btnPrimary}>
                  {scanMutation.isPending ? "Verifying…" : "Confirm scan"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                  Back
                </button>
              </div>
            </form>
          </section>
        )}

        {step === 6 && inventoryItemId && (
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900">Storage location</h2>
            {!location && (
              <button
                type="button"
                onClick={() => determineMutation.mutate()}
                disabled={determineMutation.isPending}
                className={`${btnPrimary} mt-5`}
              >
                {determineMutation.isPending ? "Calculating…" : "Determine location"}
              </button>
            )}
            {determineMutation.isError && (
              <p className="mt-3 text-sm text-red-600">{(determineMutation.error as Error).message}</p>
            )}
            {location && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/80 p-5 shadow-inner">
                <p className="text-sm font-medium text-emerald-800/90">Put material in</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-emerald-900">
                  {location}
                </p>
                {locationExplanation && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{locationExplanation}</p>
                )}
                <button
                  type="button"
                  onClick={() => confirmPlacementMutation.mutate()}
                  disabled={confirmPlacementMutation.isPending}
                  className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-medium text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {confirmPlacementMutation.isPending
                    ? "Saving…"
                    : "I placed the item in this location"}
                </button>
              </div>
            )}
          </section>
        )}

        {step === 7 && po && lineItem && inventoryItemId && location && (
          <section className={cardClass}>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700 shadow-sm">
                ✓
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Receiving complete</h2>
                <dl className="mt-4 space-y-0 text-sm">
                  <div className="flex justify-between gap-4 border-b border-slate-100 py-3">
                    <dt className="text-slate-500">Chemical</dt>
                    <dd className="font-semibold text-slate-900">{lineItem.chemical}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 py-3">
                    <dt className="text-slate-500">Order</dt>
                    <dd className="font-mono text-slate-800">{po.orderNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 py-3">
                    <dt className="text-slate-500">Batch</dt>
                    <dd className="font-mono text-slate-800">{savedBatchNumber ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 py-3">
                    <dt className="text-slate-500">Barcode</dt>
                    <dd className="font-mono text-slate-800">{barcode}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-slate-500">Location</dt>
                    <dd className="font-mono font-semibold text-emerald-700">{location}</dd>
                  </div>
                </dl>
                <button type="button" onClick={resetFlow} className={`${btnPrimary} mt-6`}>
                  Receive another package
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      <aside className="no-print w-full shrink-0 md:max-w-sm">
        <div className="sticky top-8 rounded-2xl border border-slate-200/90 bg-white/80 p-6 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.1)] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800">
              AI
            </span>
            <h3 className="text-sm font-semibold text-slate-800">Smart intake assistant</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Paste packing slip text or notes. Offline parsing suggests vendor, PO, batch, and
            chemical — no API key required.
          </p>
          <textarea
            value={assistantText}
            onChange={(e) => setAssistantText(e.target.value)}
            rows={5}
            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-2 focus:ring-[var(--color-accent-ring)]"
            placeholder='e.g. "Sigma PO-2024-7782 Acetone HPLC batch AX-9921"'
          />
          <button
            type="button"
            onClick={() => assistantMutation.mutate(assistantText)}
            disabled={assistantMutation.isPending || !assistantText.trim()}
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {assistantMutation.isPending ? "Parsing…" : "Apply to forms"}
          </button>
          {assistantMsg && (
            <p className="mt-3 text-sm leading-relaxed text-emerald-800">{assistantMsg}</p>
          )}
          {assistantMutation.isError && (
            <p className="mt-2 text-sm text-red-600">{(assistantMutation.error as Error).message}</p>
          )}

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Summary</h4>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
              <li className="flex justify-between gap-2">
                <span className="text-slate-500">Vendor</span>
                <span className="font-medium text-right">{po?.vendor ?? "—"}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-500">Order</span>
                <span className="font-mono text-right text-slate-800">{po?.orderNumber ?? "—"}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-500">Line item</span>
                <span className="max-w-[60%] text-right font-medium">{lineItem?.chemical ?? "—"}</span>
              </li>
              <li className="break-all font-mono text-xs text-slate-500">
                Inventory: {inventoryItemId ?? "—"}
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
