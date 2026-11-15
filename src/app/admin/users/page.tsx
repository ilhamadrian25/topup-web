import { db } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { setRoleAction } from "../actions";
import { Flash, type FlashSP } from "../Flash";

export default async function AdminUsers({ searchParams }: { searchParams: FlashSP }) {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, _count: { select: { orders: true } } },
  });
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">User</h1>
      <Flash sp={await searchParams} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Nama</th><th>Email</th><th>HP</th><th>Order</th><th>Daftar</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.phone ?? "-"}</td>
                <td>{u._count.orders}</td>
                <td className="whitespace-nowrap text-muted">{dateTime(u.createdAt)}</td>
                <td>
                  <form action={setRoleAction} className="flex gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role} className="input !w-28 !py-1">
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button className="btn-ghost !px-3 !py-1">Ubah</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
