import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handlePayterraWebhook } from "@/lib/biller/webhook";
import { decryptJson } from "@/lib/secrets";

/** Webhook per akun biller (URL ditampilkan di menu admin Biller). */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const acc = await db.billerAccount.findUnique({ where: { code } });
  if (!acc || acc.provider !== "PAYTERRA") return NextResponse.json({ message: "Biller tidak dikenal" }, { status: 404 });
  let secret: string | undefined;
  try {
    secret = decryptJson(acc.secrets).webhookSecret || undefined;
  } catch {
    secret = undefined;
  }
  return handlePayterraWebhook(req, secret);
}
