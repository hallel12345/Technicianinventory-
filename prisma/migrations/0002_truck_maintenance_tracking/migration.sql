ALTER TABLE "TruckInventorySubmission"
  ADD COLUMN "odometerMiles" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "oilChangeCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maintenanceCheckCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maintenanceNotes" TEXT;
