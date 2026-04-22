/**
 * Offline "smart intake" parser — extracts structured fields from free text.
 * If OPENAI_API_KEY is set, you could swap this for an LLM call; heuristics
 * keep the demo runnable without credentials.
 */
export type ParsedIntake = {
  vendor?: string;
  orderNumber?: string;
  chemical?: string;
  batchNumber?: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

const VENDOR_HINTS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bsigma[- ]?aldrich\b/i, name: "Sigma-Aldrich" },
  { pattern: /\bsigma\b/i, name: "Sigma-Aldrich" },
  { pattern: /\bfisher\b/i, name: "Fisher Scientific" },
];

export function parseIntakeNotes(text: string): ParsedIntake {
  const trimmed = text.trim();
  if (!trimmed) {
    return { confidence: "low", notes: "No text provided." };
  }

  let vendor: string | undefined;
  for (const { pattern, name } of VENDOR_HINTS) {
    if (pattern.test(trimmed)) {
      vendor = name;
      break;
    }
  }

  const orderPatterns = [
    /\b(PO-\d{4}-\d+)\b/i,
    /\b(FS-\d+)\b/i,
    /\b(PO-[A-Z0-9-]+)\b/i,
  ];
  let orderNumber: string | undefined;
  for (const p of orderPatterns) {
    const m = trimmed.match(p);
    if (m) {
      orderNumber = m[1];
      break;
    }
  }

  const batchMatch = trimmed.match(
    /\b(?:batch|lot|bn)[\s:#]*([A-Z0-9][-A-Z0-9]{3,})\b/i,
  );
  const batchNumber = batchMatch?.[1];

  const chemicalMatch = trimmed.match(
    /\b(acetone|methanol|ethanol|sulfuric|hydrochloric|hexane|toluene)\b[^,\n]*/i,
  );
  const chemical = chemicalMatch?.[0]?.trim();

  const filled = [vendor, orderNumber, batchNumber, chemical].filter(Boolean)
    .length;
  const confidence: ParsedIntake["confidence"] =
    filled >= 3 ? "high" : filled >= 2 ? "medium" : "low";

  return {
    vendor,
    orderNumber: orderNumber?.replace(/\s+/g, ""),
    chemical,
    batchNumber,
    confidence,
    notes:
      confidence === "low"
        ? "Try including vendor name, PO number, and batch/lot."
        : undefined,
  };
}
