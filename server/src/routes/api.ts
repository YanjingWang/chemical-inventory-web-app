import { Router } from "express";
import { z } from "zod";
import {
  InventoryReceivingStatus,
  LineItemStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { makeBarCodeString } from "../services/barcode.js";
import {
  determineLocationForChemical,
  explainStorageChoice,
} from "../services/storage.js";
import { parseIntakeNotes } from "../services/assistant.js";

const router = Router();

async function logEvent(
  inventoryItemId: string,
  eventType: string,
  payload?: Record<string, unknown>,
) {
  await prisma.inventoryEvent.create({
    data: {
      inventoryItemId,
      eventType,
      payloadJson: payload ? JSON.stringify(payload) : null,
    },
  });
}

router.get("/purchase-orders/search", async (req, res) => {
  const schema = z.object({
    vendor: z.string().min(1),
    orderNumber: z.string().min(1),
  });
  const parsed = schema.safeParse({
    vendor: req.query.vendor,
    orderNumber: req.query.orderNumber,
  });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
  }
  const { vendor, orderNumber } = parsed.data;
  const vendorKey = vendor.trim().toLowerCase();
  const orderKey = orderNumber.trim().toLowerCase();

  const vendors = await prisma.vendor.findMany();
  const v = vendors.find((x) => x.name.toLowerCase() === vendorKey);
  if (!v) {
    return res.status(404).json({ error: "Vendor not found" });
  }

  const candidates = await prisma.purchaseOrder.findMany({
    where: { vendorId: v.id },
    include: { lineItems: { orderBy: { id: "asc" } } },
  });
  const po = candidates.find(
    (p) => p.orderNumber.toLowerCase() === orderKey,
  );

  if (!po) {
    return res.status(404).json({ error: "Purchase order not found" });
  }

  return res.json({
    purchaseOrderId: po.id,
    vendor: v.name,
    orderNumber: po.orderNumber,
    lineItems: po.lineItems.map((li) => ({
      id: li.id,
      chemical: li.chemicalName,
      status: li.status,
    })),
  });
});

const receiveBody = z.object({
  purchaseOrderId: z.string().min(1),
  lineItemId: z.string().min(1),
  batchNumber: z.string().min(1),
});

router.post("/inventory/receive", async (req, res) => {
  const parsed = receiveBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }
  const { purchaseOrderId, lineItemId, batchNumber } = parsed.data;

  const line = await prisma.purchaseOrderLineItem.findFirst({
    where: { id: lineItemId, purchaseOrderId },
  });
  if (!line) {
    return res.status(400).json({ error: "Line item does not belong to this purchase order" });
  }

  const item = await prisma.inventoryItem.create({
    data: {
      purchaseOrderId,
      lineItemId,
      chemicalName: line.chemicalName,
      batchNumber: batchNumber.trim(),
      receivingStatus: InventoryReceivingStatus.RECEIVED_PENDING_BARCODE,
    },
  });

  await logEvent(item.id, "RECEIVED", { batchNumber: item.batchNumber });

  return res.json({ inventoryItemId: item.id });
});

router.get("/inventory/:inventoryItemId", async (req, res) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: req.params.inventoryItemId },
    include: {
      lineItem: true,
      purchaseOrder: { include: { vendor: true } },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!item) {
    return res.status(404).json({ error: "Inventory item not found" });
  }
  return res.json({
    id: item.id,
    purchaseOrderId: item.purchaseOrderId,
    lineItemId: item.lineItemId,
    chemicalName: item.chemicalName,
    batchNumber: item.batchNumber,
    barcode: item.barcode,
    storageLocation: item.storageLocation,
    receivingStatus: item.receivingStatus,
    vendor: item.purchaseOrder.vendor.name,
    orderNumber: item.purchaseOrder.orderNumber,
    receivedAt: item.receivedAt,
    placedAt: item.placedAt,
    events: item.events,
  });
});

router.post("/inventory/:inventoryItemId/barcode/generate", async (req, res) => {
  const id = req.params.inventoryItemId;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return res.status(404).json({ error: "Inventory item not found" });
  }
  if (item.receivingStatus !== InventoryReceivingStatus.RECEIVED_PENDING_BARCODE) {
    return res.status(400).json({
      error: "Barcode already generated or invalid state",
      currentStatus: item.receivingStatus,
    });
  }

  let barcode = makeBarCodeString();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.inventoryItem.findUnique({
      where: { barcode },
    });
    if (!exists) break;
    barcode = makeBarCodeString();
  }

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: {
      barcode,
      receivingStatus: InventoryReceivingStatus.BARCODE_GENERATED,
    },
  });

  await logEvent(id, "BARCODE_GENERATED", { barcode });

  return res.json({ barcode: updated.barcode });
});

const scanBody = z.object({
  scannedBarcode: z.string().min(1),
});

router.post("/inventory/:inventoryItemId/barcode/confirm", async (req, res) => {
  const parsed = scanBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }
  const id = req.params.inventoryItemId;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return res.status(404).json({ error: "Inventory item not found" });
  }
  if (item.receivingStatus !== InventoryReceivingStatus.BARCODE_GENERATED) {
    return res.status(400).json({
      error: "Confirm barcode only after a barcode is generated",
      currentStatus: item.receivingStatus,
    });
  }
  const scanned = parsed.data.scannedBarcode.trim();
  if (!item.barcode || scanned !== item.barcode) {
    return res.status(400).json({ error: "Barcode mismatch" });
  }

  await prisma.inventoryItem.update({
    where: { id },
    data: { receivingStatus: InventoryReceivingStatus.BARCODE_CONFIRMED },
  });
  await logEvent(id, "BARCODE_CONFIRMED", { barcode: item.barcode });

  return res.json({ ok: true });
});

router.post("/inventory/:inventoryItemId/storage/determine", async (req, res) => {
  const id = req.params.inventoryItemId;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return res.status(404).json({ error: "Inventory item not found" });
  }
  if (item.receivingStatus !== InventoryReceivingStatus.BARCODE_CONFIRMED) {
    return res.status(400).json({
      error: "Confirm barcode before determining storage",
      currentStatus: item.receivingStatus,
    });
  }

  const location = determineLocationForChemical(item.chemicalName);
  const explanation = explainStorageChoice(item.chemicalName, location);

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      storageLocation: location,
      receivingStatus: InventoryReceivingStatus.LOCATION_ASSIGNED,
    },
  });
  await logEvent(id, "LOCATION_DETERMINED", { location, explanation });

  return res.json({ location, explanation });
});

const confirmStorageBody = z.object({
  location: z.string().min(1),
});

router.post("/inventory/:inventoryItemId/storage/confirm", async (req, res) => {
  const parsed = confirmStorageBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }
  const id = req.params.inventoryItemId;
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return res.status(404).json({ error: "Inventory item not found" });
  }
  if (item.receivingStatus !== InventoryReceivingStatus.LOCATION_ASSIGNED) {
    return res.status(400).json({
      error: "Determine storage location first",
      currentStatus: item.receivingStatus,
    });
  }
  const loc = parsed.data.location.trim();
  if (item.storageLocation !== loc) {
    return res.status(400).json({
      error: "Location must match the assigned location",
      expected: item.storageLocation,
    });
  }

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      receivingStatus: InventoryReceivingStatus.PLACED_IN_STORAGE,
      placedAt: new Date(),
    },
  });

  await prisma.purchaseOrderLineItem.update({
    where: { id: item.lineItemId },
    data: { status: LineItemStatus.RECEIVED },
  });

  await logEvent(id, "PLACED_IN_STORAGE", { location: loc });

  return res.json({ ok: true });
});

router.post("/assistant/parse-intake", async (req, res) => {
  const body = z.object({ text: z.string() }).safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid body" });
  }
  const result = parseIntakeNotes(body.data.text);
  return res.json(result);
});

export { router as apiRouter };
