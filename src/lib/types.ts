export type InputField = {
  key: string;
  label: string;
  placeholder?: string;
  /** Jika ada, field dirender sebagai select. */
  options?: { value: string; label: string }[];
};

export type PaymentData =
  | { type: "qris"; qrString: string }
  | { type: "va"; bank: string; vaNumber: string }
  | { type: "ewallet"; provider: string; checkoutUrl: string }
  | { type: "retail"; retailer: string; payCode: string }
  /** Halaman bayar milik gateway (mis. e-wallet di iPaymu). */
  | { type: "redirect"; provider: string; url: string };
