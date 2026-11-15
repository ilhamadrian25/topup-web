import type { FulfillmentStatus, PaymentStatus } from "@prisma/client";

const PAY: Record<PaymentStatus, [string, string]> = {
  UNPAID: ["Belum dibayar", "bg-warning/15 text-warning"],
  PAID: ["Lunas", "bg-success/15 text-success"],
  EXPIRED: ["Kedaluwarsa", "bg-muted/15 text-muted"],
  FAILED: ["Gagal", "bg-danger/15 text-danger"],
};

const FUL: Record<FulfillmentStatus, [string, string]> = {
  WAITING: ["Menunggu", "bg-muted/15 text-muted"],
  PROCESSING: ["Diproses", "bg-accent-2/20 text-accent-2"],
  SUCCESS: ["Sukses", "bg-success/15 text-success"],
  FAILED: ["Gagal", "bg-danger/15 text-danger"],
  REFUNDED: ["Refund", "bg-warning/15 text-warning"],
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export const PaymentBadge = ({ s }: { s: PaymentStatus }) => <Badge label={PAY[s][0]} cls={PAY[s][1]} />;
export const FulfillmentBadge = ({ s }: { s: FulfillmentStatus }) => <Badge label={FUL[s][0]} cls={FUL[s][1]} />;
