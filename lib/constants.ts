import { InventoryScope } from "@prisma/client";

export const OFFICE_SEED = [
  "Ogden",
  "Logan",
  "Cedar City",
  "Pocatello",
  "Twin Falls"
] as const;

export const TRUCK_SEED = [
  { name: "Colorado 1", licensePlate: "H594GM", office: "Ogden" },
  { name: "Colorado 2", licensePlate: "H595GM", office: "Logan" },
  { name: "Colorado 3", licensePlate: "H596GM", office: "Cedar City" },
  { name: "Colorado 4", licensePlate: "H597GM", office: "Ogden" },
  { name: "Colorado 5", licensePlate: "H79 3HH", office: "Ogden" },
  { name: "Truck 1 (Pocatello)", licensePlate: "T134US", office: "Pocatello" },
  { name: "Truck 2 Ogden (Twin Falls)", licensePlate: "T016FM", office: "Twin Falls" },
  { name: "Ranger 1 (Big Racks) (Twin Falls)", licensePlate: "5CWG2", office: "Twin Falls" },
  { name: "Ranger 2 (99er) (Twin Falls)", licensePlate: "T538VN", office: "Twin Falls" }
] as const;

export const INVENTORY_ITEM_SEED: Array<{ name: string; scope: InventoryScope }> = [
  { name: "B&G", scope: InventoryScope.BOTH },
  { name: "Batteries", scope: InventoryScope.BOTH },
  { name: "Battery Charger", scope: InventoryScope.BOTH },
  { name: "Bifen I/T (Bags)", scope: InventoryScope.BOTH },
  { name: "Contrac Blox (Buckets)", scope: InventoryScope.BOTH },
  { name: "Demand CS (Bottles)", scope: InventoryScope.BOTH },
  { name: "D-Fense Dust", scope: InventoryScope.BOTH },
  { name: "Door Hangers", scope: InventoryScope.BOTH },
  { name: "Gloves (Boxes of 10)", scope: InventoryScope.BOTH },
  { name: "Mosquito Backpack", scope: InventoryScope.BOTH },
  { name: "Mouse Stations (Boxes of 48)", scope: InventoryScope.BOTH },
  { name: "Niban (Boxes)", scope: InventoryScope.BOTH },
  { name: "Pro Flex (Bottles)", scope: InventoryScope.BOTH },
  { name: "Rat Stations (Box of 6)", scope: InventoryScope.BOTH },
  { name: "Scorpion", scope: InventoryScope.BOTH },
  { name: "Stryker", scope: InventoryScope.BOTH },
  { name: "Tandem (Bottles)", scope: InventoryScope.BOTH },
  { name: "Typhoons (Backpack)", scope: InventoryScope.BOTH },
  { name: "Webster Heads", scope: InventoryScope.BOTH },
  { name: "Webster Poles", scope: InventoryScope.BOTH }
];

export const DEMO_TECHNICIANS = [
  { name: "Teagan Dixon", userCode: "7716", office: "Twin Falls", pin: "7716", isActive: true },
  { name: "Cole Houston", userCode: "0383", office: "Pocatello", pin: "0383", isActive: true },
  { name: "Spencer Petersen", userCode: "9758", office: "Ogden", pin: "9758", isActive: true },
  { name: "Skyler Kearl", userCode: "3531", office: "Ogden", pin: "3531", isActive: true },
  { name: "James Meritt", userCode: "6514", office: "Logan", pin: "6514", isActive: true },
  { name: "Andrew Maxwell", userCode: "3362", office: "Cedar City", pin: "3362", isActive: true }
] as const;
