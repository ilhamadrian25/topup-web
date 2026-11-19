-- AlterTable
ALTER TABLE "public"."Category" ADD COLUMN     "marginBps" INTEGER,
ADD COLUMN     "marginFlat" INTEGER NOT NULL DEFAULT 0;
