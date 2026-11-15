export function Flash({ sp }: { sp: { ok?: string; err?: string } }) {
  if (sp.ok) return <p className="mb-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{sp.ok}</p>;
  if (sp.err) return <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{sp.err}</p>;
  return null;
}

export type FlashSP = Promise<{ ok?: string; err?: string }>;
