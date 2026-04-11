-- Create enums
CREATE TYPE "Role" AS ENUM ('TECHNICIAN', 'ADMIN');
CREATE TYPE "InventoryScope" AS ENUM ('OFFICE', 'TRUCK', 'BOTH');
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'EDITED', 'UNLOCKED', 'RESUBMITTED');
CREATE TYPE "RequirementTargetType" AS ENUM ('OFFICE', 'TRUCK');
CREATE TYPE "EmailLogType" AS ENUM ('AUTO_FINAL', 'MANUAL_RESEND');
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "AuditAction" AS ENUM (
  'SUBMISSION_EDITED',
  'SUBMISSION_UNLOCKED',
  'TRUCK_ASSIGNMENT_CHANGED',
  'OFFICE_CREATED',
  'OFFICE_UPDATED',
  'OFFICE_ARCHIVED',
  'TRUCK_CREATED',
  'TRUCK_UPDATED',
  'TRUCK_ARCHIVED',
  'INVENTORY_ITEM_CREATED',
  'INVENTORY_ITEM_UPDATED',
  'INVENTORY_ITEM_ARCHIVED',
  'MONTHLY_EMAIL_RESEND',
  'TECHNICIAN_CREATED',
  'TECHNICIAN_DEACTIVATED',
  'MONTH_LOCKED',
  'MONTH_UNLOCKED',
  'REQUIRED_STATUS_CHANGED',
  'BRANDING_UPDATED',
  'USER_UPDATED'
);

-- Create core tables
CREATE TABLE "Office" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "requiredByDefault" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "userCode" TEXT,
  "role" "Role" NOT NULL,
  "passwordHash" TEXT,
  "pinHash" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "officeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Truck" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "licensePlate" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "requiredByDefault" BOOLEAN NOT NULL DEFAULT true,
  "officeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "InventoryScope" NOT NULL DEFAULT 'BOTH',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyCycle" (
  "id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "requiredOfficeCount" INTEGER NOT NULL DEFAULT 0,
  "requiredTruckCount" INTEGER NOT NULL DEFAULT 0,
  "completedOfficeCount" INTEGER NOT NULL DEFAULT 0,
  "completedTruckCount" INTEGER NOT NULL DEFAULT 0,
  "isComplete" BOOLEAN NOT NULL DEFAULT false,
  "autoEmailSent" BOOLEAN NOT NULL DEFAULT false,
  "autoEmailSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficeInventorySubmission" (
  "id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "officeId" TEXT NOT NULL,
  "monthlyCycleId" TEXT NOT NULL,
  "technicianName" TEXT NOT NULL,
  "notes" TEXT,
  "problemsReported" TEXT,
  "missingDamagedNotes" TEXT,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "isManuallyUnlocked" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeInventorySubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TruckInventorySubmission" (
  "id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "truckId" TEXT NOT NULL,
  "monthlyCycleId" TEXT NOT NULL,
  "technicianName" TEXT NOT NULL,
  "notes" TEXT,
  "problemsReported" TEXT,
  "missingDamagedNotes" TEXT,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "isManuallyUnlocked" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TruckInventorySubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficeInventoryCount" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OfficeInventoryCount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TruckInventoryCount" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TruckInventoryCount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyRequirementOverride" (
  "id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "targetType" "RequirementTargetType" NOT NULL,
  "isRequired" BOOLEAN NOT NULL,
  "reason" TEXT,
  "officeId" TEXT,
  "truckId" TEXT,
  "monthlyCycleId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyRequirementOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailLog" (
  "id" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "monthlyCycleId" TEXT NOT NULL,
  "type" "EmailLogType" NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "autoKey" TEXT,
  "triggeredBySubmissionId" TEXT,
  "triggeredByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandingConfig" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "companyName" TEXT NOT NULL,
  "appTitle" TEXT NOT NULL,
  "logoPath" TEXT NOT NULL,
  "faviconPath" TEXT NOT NULL,
  "primaryColor" TEXT NOT NULL DEFAULT '#97C972',
  "accentColor" TEXT NOT NULL DEFAULT '#D3FDD7',
  "textColor" TEXT NOT NULL DEFAULT '#434343',
  "photosRequired" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileUpload" (
  "id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "publicUrl" TEXT,
  "contentType" TEXT,
  "sizeBytes" INTEGER,
  "uploadedById" TEXT,
  "officeSubmissionId" TEXT,
  "truckSubmissionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX "Office_name_key" ON "Office"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_userCode_key" ON "User"("userCode");
CREATE UNIQUE INDEX "Truck_licensePlate_key" ON "Truck"("licensePlate");
CREATE UNIQUE INDEX "InventoryItem_name_key" ON "InventoryItem"("name");
CREATE UNIQUE INDEX "MonthlyCycle_month_year_key" ON "MonthlyCycle"("month", "year");
CREATE UNIQUE INDEX "OfficeInventorySubmission_officeId_month_year_key" ON "OfficeInventorySubmission"("officeId", "month", "year");
CREATE UNIQUE INDEX "TruckInventorySubmission_truckId_month_year_key" ON "TruckInventorySubmission"("truckId", "month", "year");
CREATE UNIQUE INDEX "OfficeInventoryCount_submissionId_inventoryItemId_key" ON "OfficeInventoryCount"("submissionId", "inventoryItemId");
CREATE UNIQUE INDEX "TruckInventoryCount_submissionId_inventoryItemId_key" ON "TruckInventoryCount"("submissionId", "inventoryItemId");
CREATE UNIQUE INDEX "MonthlyRequirementOverride_month_year_targetType_officeId_key" ON "MonthlyRequirementOverride"("month", "year", "targetType", "officeId");
CREATE UNIQUE INDEX "MonthlyRequirementOverride_month_year_targetType_truckId_key" ON "MonthlyRequirementOverride"("month", "year", "targetType", "truckId");
CREATE UNIQUE INDEX "EmailLog_autoKey_key" ON "EmailLog"("autoKey");

-- Create non-unique indexes
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "Office_isActive_idx" ON "Office"("isActive");
CREATE INDEX "Truck_officeId_isActive_idx" ON "Truck"("officeId", "isActive");
CREATE INDEX "InventoryItem_isActive_scope_idx" ON "InventoryItem"("isActive", "scope");
CREATE INDEX "MonthlyCycle_year_month_idx" ON "MonthlyCycle"("year", "month");
CREATE INDEX "OfficeInventorySubmission_month_year_idx" ON "OfficeInventorySubmission"("month", "year");
CREATE INDEX "OfficeInventorySubmission_createdById_idx" ON "OfficeInventorySubmission"("createdById");
CREATE INDEX "TruckInventorySubmission_month_year_idx" ON "TruckInventorySubmission"("month", "year");
CREATE INDEX "TruckInventorySubmission_createdById_idx" ON "TruckInventorySubmission"("createdById");
CREATE INDEX "MonthlyRequirementOverride_month_year_targetType_idx" ON "MonthlyRequirementOverride"("month", "year", "targetType");
CREATE INDEX "EmailLog_month_year_type_idx" ON "EmailLog"("month", "year", "type");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "FileUpload_officeSubmissionId_idx" ON "FileUpload"("officeSubmissionId");
CREATE INDEX "FileUpload_truckSubmissionId_idx" ON "FileUpload"("truckSubmissionId");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Truck" ADD CONSTRAINT "Truck_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfficeInventorySubmission" ADD CONSTRAINT "OfficeInventorySubmission_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeInventorySubmission" ADD CONSTRAINT "OfficeInventorySubmission_monthlyCycleId_fkey" FOREIGN KEY ("monthlyCycleId") REFERENCES "MonthlyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TruckInventorySubmission" ADD CONSTRAINT "TruckInventorySubmission_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TruckInventorySubmission" ADD CONSTRAINT "TruckInventorySubmission_monthlyCycleId_fkey" FOREIGN KEY ("monthlyCycleId") REFERENCES "MonthlyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeInventoryCount" ADD CONSTRAINT "OfficeInventoryCount_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "OfficeInventorySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficeInventoryCount" ADD CONSTRAINT "OfficeInventoryCount_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TruckInventoryCount" ADD CONSTRAINT "TruckInventoryCount_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TruckInventorySubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TruckInventoryCount" ADD CONSTRAINT "TruckInventoryCount_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyRequirementOverride" ADD CONSTRAINT "MonthlyRequirementOverride_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyRequirementOverride" ADD CONSTRAINT "MonthlyRequirementOverride_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyRequirementOverride" ADD CONSTRAINT "MonthlyRequirementOverride_monthlyCycleId_fkey" FOREIGN KEY ("monthlyCycleId") REFERENCES "MonthlyCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_monthlyCycleId_fkey" FOREIGN KEY ("monthlyCycleId") REFERENCES "MonthlyCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_officeSubmissionId_fkey" FOREIGN KEY ("officeSubmissionId") REFERENCES "OfficeInventorySubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_truckSubmissionId_fkey" FOREIGN KEY ("truckSubmissionId") REFERENCES "TruckInventorySubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
