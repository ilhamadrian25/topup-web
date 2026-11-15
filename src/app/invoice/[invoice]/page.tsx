import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getPublicOrder, refreshOrder } from "@/lib/orders";
import { mockAllowed } from "@/lib/payment";
import type { PaymentData } from "@/lib/types";
import { InvoiceView } from "./InvoiceView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice", robots: { index: false } };

export default async function InvoicePage({ params }: { params: Promise<{ invoice: string }> }) {
  const { invoice } = await params;
  await refreshOrder(invoice);
  const order = await getPublicOrder(invoice);
  if (!order) notFound();

  const pd = order.paymentData as PaymentData | null;
  const qrSvg =
    pd?.type === "qris"
      ? await QRCode.toString(pd.qrString, { type: "svg", margin: 1, width: 240, color: { dark: "#000", light: "#fff" } })
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <InvoiceView initial={JSON.parse(JSON.stringify(order))} qrSvg={qrSvg} mockPayment={mockAllowed() && order.paymentGateway?.provider === "MOCK"} />
    </div>
  );
}
