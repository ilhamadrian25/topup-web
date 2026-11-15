-- CreateEnum
CREATE TYPE "public"."GatewayProvider" AS ENUM ('MOCK', 'IPAYMU');

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "paymentGatewayId" TEXT;

-- AlterTable
ALTER TABLE "public"."PaymentMethod" ADD COLUMN     "gatewayChannel" TEXT,
ADD COLUMN     "gatewayId" TEXT,
ADD COLUMN     "gatewayMethod" TEXT;

-- CreateTable
CREATE TABLE "public"."PaymentGateway" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "public"."GatewayProvider" NOT NULL,
    "isSandbox" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secrets" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGateway_code_key" ON "public"."PaymentGateway"("code");

-- CreateIndex
CREATE INDEX "Order_paymentGatewayId_paymentRef_idx" ON "public"."Order"("paymentGatewayId", "paymentRef");

-- AddForeignKey
ALTER TABLE "public"."PaymentMethod" ADD CONSTRAINT "PaymentMethod_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "public"."PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_paymentGatewayId_fkey" FOREIGN KEY ("paymentGatewayId") REFERENCES "public"."PaymentGateway"("id") ON DELETE SET NULL ON UPDATE CASCADE;
