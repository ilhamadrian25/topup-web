import type { PaymentGroup } from "@prisma/client";
import type { PaymentData } from "@/lib/types";

export type CreateChargeInput = {
  invoice: string;
  amount: number;
  method: { code: string; name: string; group: PaymentGroup; gatewayMethod: string | null; gatewayChannel: string | null };
  expiresAt: Date;
  customer: { name: string; phone: string; email?: string | null };
  notifyUrl: string;
  returnUrl: string;
};

export type ChargeResult = {
  /** ID transaksi di gateway; null kalau baru diketahui saat callback (mis. redirect). */
  paymentRef: string | null;
  paymentData: PaymentData;
  /** Batas bayar dari gateway (kalau lebih cepat dari milik kita). */
  expiresAt?: Date;
};

export type GatewayStatus = {
  status: "PAID" | "PENDING" | "EXPIRED" | "FAILED";
  transactionId: string;
  /** Harus sama dengan invoice kita — dicek sebelum order ditandai lunas. */
  referenceId: string | null;
  amount: number | null;
  raw: unknown;
};

export interface GatewayAdapter {
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
  /** Tanya status ke gateway. Sumber kebenaran — body callback tidak dipercaya. */
  checkStatus(transactionId: string): Promise<GatewayStatus>;
  /** Ambil ID transaksi & invoice dari body callback (belum terverifikasi). */
  parseCallback(body: Record<string, unknown>): { transactionId: string; invoice: string } | null;
  /** Untuk tombol "Tes koneksi" di admin. */
  testConnection(): Promise<string>;
}

export class GatewayError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message);
  }
}
