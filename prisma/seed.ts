import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { DEMO_TECHNICIANS, INVENTORY_ITEM_SEED, OFFICE_SEED, TRUCK_SEED } from "../lib/constants";
import { getCurrentMonthYear } from "../lib/time";

const prisma = new PrismaClient();

const INVENTORY_ITEM_RENAMES = [
  { from: "Bifen i/t", to: "Bifen I/T (Bags)" },
  { from: "Contrac Blox", to: "Contrac Blox (Buckets)" },
  { from: "Demand CS", to: "Demand CS (Bottles)" },
  { from: "Niban", to: "Niban (Boxes)" },
  { from: "Pro Flex", to: "Pro Flex (Bottles)" },
  { from: "Tandem", to: "Tandem (Bottles)" },
  { from: "Typhoons", to: "Typhoons (Backpack)" }
] as const;

async function main() {
  for (const officeName of OFFICE_SEED) {
    await prisma.office.upsert({
      where: { name: officeName },
      update: {},
      create: { name: officeName }
    });
  }

  const officeMap = new Map(
    (await prisma.office.findMany()).map((office) => [office.name, office.id])
  );

  for (const rename of INVENTORY_ITEM_RENAMES) {
    const oldItem = await prisma.inventoryItem.findUnique({ where: { name: rename.from } });
    if (!oldItem) {
      continue;
    }

    const newItem = await prisma.inventoryItem.findUnique({ where: { name: rename.to } });
    if (newItem) {
      await prisma.inventoryItem.update({
        where: { id: oldItem.id },
        data: { isActive: false }
      });
      continue;
    }

    await prisma.inventoryItem.update({
      where: { id: oldItem.id },
      data: { name: rename.to }
    });
  }

  for (const [index, item] of INVENTORY_ITEM_SEED.entries()) {
    await prisma.inventoryItem.upsert({
      where: { name: item.name },
      update: {
        scope: item.scope,
        isActive: true,
        sortOrder: index
      },
      create: {
        name: item.name,
        scope: item.scope,
        sortOrder: index
      }
    });
  }

  for (const truck of TRUCK_SEED) {
    await prisma.truck.upsert({
      where: { licensePlate: truck.licensePlate },
      update: {
        name: truck.name,
        officeId: officeMap.get(truck.office) ?? null,
        isActive: true
      },
      create: {
        name: truck.name,
        licensePlate: truck.licensePlate,
        officeId: officeMap.get(truck.office) ?? null
      }
    });
  }

  const adminPasswordHash = await bcrypt.hash("801Lawncare1!", 12);
  await prisma.user.upsert({
    where: { email: "admin@purepest.local" },
    update: {
      name: "Pure Pest Admin",
      role: Role.ADMIN,
      isActive: true,
      passwordHash: adminPasswordHash
    },
    create: {
      name: "Pure Pest Admin",
      email: "admin@purepest.local",
      role: Role.ADMIN,
      passwordHash: adminPasswordHash
    }
  });

  for (const tech of DEMO_TECHNICIANS) {
    const pinHash = await bcrypt.hash(tech.pin, 12);
    await prisma.user.upsert({
      where: { userCode: tech.userCode },
      update: {
        name: tech.name,
        role: Role.TECHNICIAN,
        pinHash,
        officeId: officeMap.get(tech.office),
        isActive: tech.isActive
      },
      create: {
        name: tech.name,
        userCode: tech.userCode,
        role: Role.TECHNICIAN,
        pinHash,
        officeId: officeMap.get(tech.office),
        isActive: tech.isActive
      }
    });
  }

  const { month, year } = getCurrentMonthYear();
  await prisma.monthlyCycle.upsert({
    where: { month_year: { month, year } },
    update: {},
    create: { month, year }
  });

  await prisma.brandingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Pure Pest Solutions",
      appTitle: "Pure Pest Inventory",
      logoPath: "/branding/logo.png",
      faviconPath: "/branding/favicon.ico",
      primaryColor: "#97C972",
      accentColor: "#D3FDD7",
      textColor: "#434343"
    }
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
