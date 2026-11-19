import { handlePayterraWebhook } from "@/lib/biller/webhook";

/**
 * Webhook Payterra lama (kredensial dari env PAYTERRA_CALLBACK_SECRET). Akun
 * yang diatur di menu Biller memakai /api/biller/callback/{code}.
 */
export async function POST(req: Request) {
  return handlePayterraWebhook(req, process.env.PAYTERRA_CALLBACK_SECRET);
}
