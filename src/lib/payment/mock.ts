import "server-only";
import type { ChargeResult, CreateChargeInput, GatewayAdapter, GatewayStatus } from "./types";

/** Mock tidak bisa dipakai di produksi kecuali ALLOW_MOCK_PAYMENT=true. */
export const mockAllowed = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_MOCK_PAYMENT === "true";

/**
 * Gateway palsu untuk development. Pembayaran dikonfirmasi lewat tombol
 * "Simulasi bayar" di invoice (POST /api/payments/mock).
 */
export class MockGateway implements GatewayAdapter {
  async createCharge({ invoice, amount, method }: CreateChargeInput): Promise<ChargeResult> {
    const paymentRef = `MOCKPAY-${invoice}`;
    switch (method.group) {
      case "QRIS":
        return {
          paymentRef,
          paymentData: { type: "qris", qrString: `00020101021226590013ID.MOCK.QRIS0118${invoice}5204599953033605405${amount}5802ID6304MOCK` },
        };
      case "VIRTUAL_ACCOUNT": {
        const digits = invoice.replace(/\D/g, "").slice(-10).padStart(10, "0");
        return { paymentRef, paymentData: { type: "va", bank: method.name, vaNumber: `8808${digits}` } };
      }
      case "EWALLET":
        return { paymentRef, paymentData: { type: "ewallet", provider: method.name, checkoutUrl: `/invoice/${invoice}` } };
      case "RETAIL":
        return { paymentRef, paymentData: { type: "retail", retailer: method.name, payCode: invoice.replace(/\D/g, "").slice(-12) } };
    }
  }
  async checkStatus(transactionId: string): Promise<GatewayStatus> {
    return { status: "PENDING", transactionId, referenceId: null, amount: null, raw: null };
  }
  parseCallback() {
    return null;
  }
  async testConnection() {
    return "Mock gateway selalu siap";
  }
}
