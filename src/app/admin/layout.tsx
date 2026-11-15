import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const attention = await db.order.count({ where: { paymentStatus: "PAID", fulfillmentStatus: { in: ["FAILED", "WAITING"] } } });
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-32 md:self-start">
        <AdminNav attention={attention} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
