/**
 * Kontrak biller. Implementasi nyata = API merchant Payterra (belum ada,
 * akan dibuat di sisi Payterra). Bentuk ini sekaligus jadi spesifikasi
 * yang diusulkan untuk API tersebut — lihat docs/payterra-merchant-api.md.
 */
export type BillerProduct = {
  code: string;
  brandCode: string;
  brandName: string;
  name: string;
  /** Harga modal untuk merchant. */
  price: number;
  available: boolean;
};

export type BillerTxStatus = "PENDING" | "SUCCESS" | "FAILED";

export type BillerTxResult = {
  status: BillerTxStatus;
  /** ID transaksi di sisi biller. */
  billerRef?: string;
  /** Serial number / kode voucher / bukti dari operator. */
  sn?: string;
  message: string;
  /** Harga yang benar-benar dipotong biller. */
  price?: number;
};

export type AccountCheckResult =
  | { ok: true; nickname: string }
  | { ok: false; message: string };

export interface BillerAdapter {
  readonly name: string;
  listProducts(): Promise<BillerProduct[]>;
  getBalance(): Promise<number>;
  checkAccount(input: { brandCode: string; account: Record<string, string> }): Promise<AccountCheckResult>;
  /** Harus idempoten terhadap refId: kirim ulang refId yang sama tidak boleh menggandakan transaksi. */
  purchase(input: { refId: string; productCode: string; account: Record<string, string> }): Promise<BillerTxResult>;
  checkStatus(input: { refId: string }): Promise<BillerTxResult>;
}
