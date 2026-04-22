import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.inventoryEvent.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.purchaseOrderLineItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.vendor.deleteMany();

  const sigma = await prisma.vendor.create({
    data: { name: "Sigma-Aldrich" },
  });
  const fisher = await prisma.vendor.create({
    data: { name: "Fisher Scientific" },
  });

  const po1 = await prisma.purchaseOrder.create({
    data: {
      vendorId: sigma.id,
      orderNumber: "PO-2024-7782",
      lineItems: {
        create: [
          { chemicalName: "Acetone HPLC", quantityOrdered: 4, unit: "L" },
          { chemicalName: "Methanol", quantityOrdered: 2, unit: "L" },
          {
            chemicalName: "Sulfuric acid 98%",
            quantityOrdered: 1,
            unit: "bottle",
          },
        ],
      },
    },
    include: { lineItems: true },
  });

  await prisma.purchaseOrder.create({
    data: {
      vendorId: fisher.id,
      orderNumber: "FS-99102",
      lineItems: {
        create: [
          { chemicalName: "Ethanol absolute", quantityOrdered: 6, unit: "L" },
          { chemicalName: "Acetone HPLC", quantityOrdered: 1, unit: "L" },
        ],
      },
    },
  });

  // Duplicate chemical name on same PO (edge case demo)
  await prisma.purchaseOrderLineItem.create({
    data: {
      purchaseOrderId: po1.id,
      chemicalName: "Acetone HPLC",
      quantityOrdered: 1,
      unit: "L",
    },
  });
}

main()
  .then(() => {
    console.log("Seed complete.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
