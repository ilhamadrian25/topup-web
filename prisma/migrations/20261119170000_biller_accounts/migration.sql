-- CreateEnum
CREATE TYPE "public"."BillerProvider" AS ENUM ('MOCK', 'PAYTERRA');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "billerAccountId" TEXT;

-- CreateTable
CREATE TABLE "public"."BillerAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "public"."BillerProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secrets" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillerAccount_code_key" ON "public"."BillerAccount"("code");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_billerAccountId_fkey" FOREIGN KEY ("billerAccountId") REFERENCES "public"."BillerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
