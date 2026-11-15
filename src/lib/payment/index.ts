import "server-only";
import type { GatewayProvider, PaymentGateway } from "@prisma/client";
import { decryptJson } from "@/lib/secrets";
import { IpaymuGateway, type IpaymuConfig } from "./ipaymu";
import { MockGateway, mockAllowed } from "./mock";
import { GatewayError, type GatewayAdapter } from "./types";

export { GatewayError, mockAllowed };
export type * from "./types";

/**
 * Provider yang didukung kode. Instance-nya (kredensial, sandbox/produksi, aktif)
 * diatur di tabel PaymentGateway lewat admin — tidak ada konfigurasi di env.
 * Menambah gateway baru = tambah enum GatewayProvider + adapter + entri di sini.
 */
export const PROVIDERS: Record<GatewayProvider, { label: string; secretFields: { key: string; label: string }[]; configFields: { key: string; label: string; placeholder?: string }[] }> = {
  IPAYMU: {
    label: "iPaymu",
    configFields: [
      { key: "va", label: "Virtual Account (VA)", placeholder: "0000001234567890" },
      { key: "defaultEmail", label: "Email default pembeli", placeholder: "cs@tokokamu.com" },
    ],
    secretFields: [{ key: "apiKey", label: "API Key" }],
  },
  MOCK: { label: "Mock (development)", configFields: [], secretFields: [] },
};

export function gatewayAdapter(gw: Pick<PaymentGateway, "provider" | "config" | "secrets" | "isSandbox">): GatewayAdapter {
  switch (gw.provider) {
    case "IPAYMU":
      return new IpaymuGateway((gw.config ?? {}) as IpaymuConfig, decryptJson(gw.secrets) as { apiKey: string }, gw.isSandbox);
    case "MOCK":
      if (!mockAllowed()) throw new GatewayError("Mock gateway dinonaktifkan di produksi");
      return new MockGateway();
  }
}
