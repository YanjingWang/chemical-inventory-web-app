export type BarCode = string;

export type LineItemDto = {
  id: string;
  chemical: string;
  status: string;
};

export type PurchaseOrderDto = {
  purchaseOrderId: string;
  vendor: string;
  orderNumber: string;
  lineItems: LineItemDto[];
};

export type ParsedIntakeResult = {
  vendor?: string;
  orderNumber?: string;
  chemical?: string;
  batchNumber?: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

const json = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
};

/**
 * API client aligned with the take-home mock; uses lineItemId for receive (stable id).
 */
export function createApi(baseUrl = "") {
  return {
    async getPurchaseOrder(
      vendor: string,
      orderNumber: string,
    ): Promise<PurchaseOrderDto> {
      const q = new URLSearchParams({ vendor, orderNumber });
      const res = await fetch(
        `${baseUrl}/api/purchase-orders/search?${q.toString()}`,
      );
      return json(res);
    },

    async markReceived(
      purchaseOrderId: string,
      lineItemId: string,
      batchNumber: string,
    ): Promise<{ inventoryItemId: string }> {
      const res = await fetch(`${baseUrl}/api/inventory/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseOrderId, lineItemId, batchNumber }),
      });
      return json(res);
    },

    /** Random barcode string (server also generates on print step). */
    makeBarCode(): BarCode {
      const p = () =>
        Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
      return `BC-${p()}-${p()}`;
    },

    async scanBarCodeForInventoryItem(
      barCode: BarCode,
      inventoryItemId: string,
    ): Promise<void> {
      const res = await fetch(
        `${baseUrl}/api/inventory/${inventoryItemId}/barcode/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scannedBarcode: barCode }),
        },
      );
      await json(res);
    },

    async determineStorageLocation(inventoryItemId: string): Promise<string> {
      const res = await fetch(
        `${baseUrl}/api/inventory/${inventoryItemId}/storage/determine`,
        { method: "POST" },
      );
      const data = await json(res);
      return data.location as string;
    },

    async determineStorageWithExplanation(
      inventoryItemId: string,
    ): Promise<{ location: string; explanation: string }> {
      const res = await fetch(
        `${baseUrl}/api/inventory/${inventoryItemId}/storage/determine`,
        { method: "POST" },
      );
      return json(res);
    },

    async confirmStorageLocation(
      inventoryItemId: string,
      location: string,
    ): Promise<void> {
      const res = await fetch(
        `${baseUrl}/api/inventory/${inventoryItemId}/storage/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location }),
        },
      );
      await json(res);
    },

    async generateBarcode(inventoryItemId: string): Promise<{ barcode: string }> {
      const res = await fetch(
        `${baseUrl}/api/inventory/${inventoryItemId}/barcode/generate`,
        { method: "POST" },
      );
      return json(res);
    },

    async getInventoryItem(inventoryItemId: string) {
      const res = await fetch(`${baseUrl}/api/inventory/${inventoryItemId}`);
      return json(res);
    },

    async parseIntakeNotes(text: string): Promise<ParsedIntakeResult> {
      const res = await fetch(`${baseUrl}/api/assistant/parse-intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return json(res);
    },
  };
}

export type ApiClient = ReturnType<typeof createApi>;
