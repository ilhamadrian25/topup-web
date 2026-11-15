import "server-only";
import { MockBiller } from "./mock";
import { PayterraBiller } from "./payterra";
import type { BillerAdapter } from "./types";

const g = globalThis as unknown as { biller?: BillerAdapter };

export function biller(): BillerAdapter {
  if (!g.biller) g.biller = process.env.BILLER_PROVIDER === "payterra" ? new PayterraBiller() : new MockBiller();
  return g.biller;
}

export type * from "./types";
