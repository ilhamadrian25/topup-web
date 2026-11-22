-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "memberMarginBps" INTEGER,
ADD COLUMN     "memberMarginFlat" INTEGER NOT NULL DEFAULT 0;

