"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { biller } from "@/lib/biller";
import { syncProducts } from "@/lib/catalog";
import { markOrderPaid, markRefunded, retryFulfillment, syncGatewayPayment, OrderError } from "@/lib/orders";
import { gatewayAdapter, PROVIDERS } from "@/lib/payment";
import { decryptJson, encryptJson } from "@/lib/secrets";
import type { GatewayProvider, PaymentGroup } from "@prisma/client";
import { applyMargin, categoryMargin, getSettings, memberPriceFor, saveSettings } from "@/lib/settings";
import type { InputField } from "@/lib/types";
import { imageFromForm, UploadError } from "@/lib/storage";

/** Upload gambar dari form; error validasi dikembalikan sebagai flash. */
async function image(fd: FormData, name: string, folder: Parameters<typeof imageFromForm>[2], path: string) {
  try {
    return await imageFromForm(fd, name, folder);
  } catch (e) {
    back(path, e instanceof UploadError ? e.message : "Upload gagal: " + String(e), "err");
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" ? null : Math.round(Number(v));
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on";

function back(path: string, msg: string, kind: "ok" | "err" = "ok"): never {
  revalidatePath(path);
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
}

// ---------- Orders ----------
export async function orderAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const op = str(fd, "op");
  const path = `/admin/orders/${id}`;
  try {
    if (op === "retry") await retryFulfillment(id);
    else if (op === "refund") await markRefunded(id, str(fd, "note"));
    else if (op === "markPaid") {
      const o = await db.order.findUniqueOrThrow({ where: { id } });
      await markOrderPaid(o.invoice, { source: "admin-manual" });
    } else if (op === "checkPayment") {
      const o = await db.order.findUniqueOrThrow({ where: { id } });
      const st = await syncGatewayPayment(o.invoice);
      back(path, st ? `Status di gateway: ${st}` : "Belum ada ID transaksi gateway (pembeli belum memilih/membayar)");
    }
  } catch (e) {
    back(path, e instanceof OrderError ? e.message : "Gagal: " + String(e), "err");
  }
  back(path, "Berhasil");
}

// ---------- Catalog sync ----------
export async function syncAction() {
  await requireAdmin();
  const s = await getSettings();
  let msg: string;
  try {
    const r = await syncProducts(db, biller(), { marginBps: s.defaultMarginBps, memberDiscountBps: s.memberDiscountBps });
    msg = `Sync selesai: ${r.created} baru, ${r.updated} diperbarui, ${r.repriced.length} harga dinaikkan, ${r.unavailable} tidak tersedia`;
    if (r.unknownBrands.length) msg += `. Brand belum punya game: ${r.unknownBrands.join(", ")}`;
  } catch (e) {
    back("/admin/settings", "Sync gagal: " + String(e), "err");
  }
  back("/admin/settings", msg);
}

// ---------- Settings ----------
export async function settingsAction(fd: FormData) {
  await requireAdmin();
  const logoUrl = await image(fd, "logoUrl", "store", "/admin/settings");
  await saveSettings({
    logoUrl: logoUrl ?? "",
    storeName: str(fd, "storeName") || "Top Up",
    tagline: str(fd, "tagline"),
    whatsappCs: str(fd, "whatsappCs"),
    contactEmail: str(fd, "contactEmail"),
    contactPhone: str(fd, "contactPhone"),
    businessName: str(fd, "businessName"),
    businessAddress: str(fd, "businessAddress"),
    defaultMarginBps: Math.max(0, int(fd, "defaultMarginBps") ?? 0),
    memberDiscountBps: Math.max(0, int(fd, "memberDiscountBps") ?? 0),
  });
  revalidatePath("/", "layout");
  back("/admin/settings", "Pengaturan disimpan");
}

// ---------- Games ----------
const FieldsSchema = z.array(
  z.object({
    key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    label: z.string().min(1),
    placeholder: z.string().optional(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  }),
);

export async function saveGameAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  let fields: InputField[];
  try {
    fields = FieldsSchema.parse(JSON.parse(str(fd, "inputFields") || "[]"));
  } catch {
    back(id ? `/admin/games/${id}` : "/admin/games", "Input fields harus JSON valid: [{\"key\":\"userId\",\"label\":\"User ID\"}]", "err");
  }
  const slug = str(fd, "slug").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const formPath = id ? `/admin/games/${id}` : "/admin/games";
  const imageUrl = await image(fd, "imageUrl", "games", formPath);
  const bannerUrl = await image(fd, "bannerUrl", "games", formPath);
  const data = {
    slug,
    name: str(fd, "name"),
    publisher: str(fd, "publisher") || null,
    description: str(fd, "description") || null,
    imageUrl,
    bannerUrl,
    categoryId: str(fd, "categoryId"),
    billerBrandCode: str(fd, "billerBrandCode").toUpperCase(),
    inputFields: fields,
    inputHint: str(fd, "inputHint") || null,
    seoTitle: str(fd, "seoTitle") || null,
    seoDescription: str(fd, "seoDescription") || null,
    nicknameCheck: bool(fd, "nicknameCheck"),
    isActive: bool(fd, "isActive"),
    isPopular: bool(fd, "isPopular"),
    sortOrder: int(fd, "sortOrder") ?? 0,
  };
  if (!data.slug || !data.name || !data.billerBrandCode || !data.categoryId)
    back(id ? `/admin/games/${id}` : "/admin/games", "Slug, nama, kategori, dan kode brand wajib diisi", "err");
  try {
    if (id) {
      await db.game.update({ where: { id }, data });
    } else {
      const g = await db.game.create({ data });
      revalidatePath("/");
      redirect(`/admin/games/${g.id}?ok=${encodeURIComponent("Game dibuat. Jalankan Sync Produk untuk menarik produknya.")}`);
    }
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect
    back(id ? `/admin/games/${id}` : "/admin/games", "Gagal simpan (slug / kode brand mungkin sudah dipakai)", "err");
  }
  revalidatePath("/");
  back(`/admin/games/${id}`, "Game disimpan");
}

export async function saveProductsAction(fd: FormData) {
  await requireAdmin();
  const gameId = str(fd, "gameId");
  const ids = fd.getAll("pid").map(String);
  const errors: string[] = [];
  const updates = ids.map((pid) => {
    const price = int(fd, `price_${pid}`) ?? 0;
    const mp = int(fd, `member_${pid}`);
    return { pid, price, memberPrice: mp && mp > 0 ? mp : null, name: str(fd, `name_${pid}`), isActive: bool(fd, `active_${pid}`), sortOrder: int(fd, `sort_${pid}`) ?? 0 };
  });
  const products = await db.product.findMany({ where: { id: { in: ids }, gameId } });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const u of updates) {
    const p = byId.get(u.pid);
    if (!p) continue;
    if (u.price <= 0) errors.push(`${p.name}: harga harus > 0`);
    else if (u.price < p.basePrice) errors.push(`${p.name}: harga jual di bawah modal`);
    if (u.memberPrice != null && u.memberPrice < p.basePrice) errors.push(`${p.name}: harga member di bawah modal`);
  }
  if (errors.length) back(`/admin/games/${gameId}`, errors.slice(0, 3).join("; "), "err");
  await db.$transaction(
    updates
      .filter((u) => byId.has(u.pid))
      .map((u) =>
        db.product.update({
          where: { id: u.pid },
          data: { price: u.price, memberPrice: u.memberPrice, name: u.name || undefined, isActive: u.isActive, sortOrder: u.sortOrder },
        }),
      ),
  );
  revalidatePath(`/games`);
  back(`/admin/games/${gameId}`, "Produk disimpan");
}

/** Hitung ulang harga jual & member dari modal untuk sekumpulan produk. */
async function reprice(where: { gameId: string } | { game: { categoryId: string } }, bps: number, flat: number) {
  const s = await getSettings();
  const products = await db.product.findMany({ where });
  await db.$transaction(
    products.map((p) => {
      const price = applyMargin(p.basePrice, bps, flat);
      return db.product.update({ where: { id: p.id }, data: { price, memberPrice: memberPriceFor(price, p.basePrice, s.memberDiscountBps) } });
    }),
  );
  revalidatePath("/games", "layout");
  return products.length;
}

const marginLabel = (bps: number, flat: number) =>
  [bps ? `${bps / 100}%` : null, flat ? `Rp ${flat.toLocaleString("id-ID")}` : null].filter(Boolean).join(" + ") || "0";

export async function bulkMarginAction(fd: FormData) {
  await requireAdmin();
  const gameId = str(fd, "gameId");
  const bps = int(fd, "marginBps");
  const flat = int(fd, "marginFlat") ?? 0;
  if (bps == null || bps < 0 || flat < 0) back(`/admin/games/${gameId}`, "Margin tidak valid", "err");
  const n = await reprice({ gameId }, bps, flat);
  back(`/admin/games/${gameId}`, `Harga ${n} produk dihitung ulang dengan margin ${marginLabel(bps, flat)}`);
}

// ---------- Category margins ----------
export async function saveCategoryMarginsAction(fd: FormData) {
  await requireAdmin();
  const path = "/admin/settings";
  const ids = fd.getAll("cid").map(String);
  const rows = ids.map((id) => ({ id, bps: int(fd, `bps_${id}`), flat: int(fd, `flat_${id}`) ?? 0 }));
  if (rows.some((r) => (r.bps != null && r.bps < 0) || r.flat < 0)) back(path, "Margin tidak boleh negatif", "err");
  await db.$transaction(rows.map((r) => db.category.update({ where: { id: r.id }, data: { marginBps: r.bps, marginFlat: r.flat } })));
  back(path, "Margin kategori disimpan. Berlaku untuk produk baru saat sync — klik \"Terapkan ke harga\" untuk produk yang sudah ada.");
}

export async function repriceCategoryAction(fd: FormData) {
  await requireAdmin();
  const path = "/admin/settings";
  const cat = await db.category.findUnique({ where: { id: str(fd, "cid") } });
  if (!cat) back(path, "Kategori tidak ditemukan", "err");
  const m = categoryMargin(cat, (await getSettings()).defaultMarginBps);
  const n = await reprice({ game: { categoryId: cat.id } }, m.bps, m.flat);
  back(path, `${cat.name}: harga ${n} produk dihitung ulang dengan margin ${marginLabel(m.bps, m.flat)}`);
}

// ---------- Payment methods ----------
export async function savePaymentMethodAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const path = "/admin/payment-methods";
  const imageUrl = await image(fd, "imageUrl", "payments", path);
  const gatewayId = str(fd, "gatewayId") || null;
  if (gatewayId && !(await db.paymentGateway.findUnique({ where: { id: gatewayId } }))) back(path, "Gateway tidak ditemukan", "err");
  const common = {
    gatewayId,
    gatewayMethod: str(fd, "gatewayMethod").toLowerCase() || null,
    gatewayChannel: str(fd, "gatewayChannel").toLowerCase() || null,
  };
  if (!id) {
    const code = str(fd, "code").toUpperCase();
    const group = str(fd, "group") as PaymentGroup;
    if (!/^[A-Z0-9_]{2,24}$/.test(code)) back(path, "Kode hanya huruf besar/angka/underscore (2–24)", "err");
    if (!["QRIS", "VIRTUAL_ACCOUNT", "EWALLET", "RETAIL"].includes(group)) back(path, "Grup tidak valid", "err");
    if (await db.paymentMethod.findUnique({ where: { code } })) back(path, `Kode ${code} sudah dipakai`, "err");
    await db.paymentMethod.create({
      data: { code, group, name: str(fd, "name") || code, imageUrl, isActive: false, sortOrder: 99, ...common },
    });
    back(path, `Metode ${code} ditambahkan (nonaktif — atur biaya lalu aktifkan)`);
  }
  await db.paymentMethod.update({
    where: { id },
    data: {
      ...common,
      name: str(fd, "name"),
      feeFlat: Math.max(0, int(fd, "feeFlat") ?? 0),
      feeBps: Math.max(0, int(fd, "feeBps") ?? 0),
      minAmount: Math.max(0, int(fd, "minAmount") ?? 0),
      maxAmount: int(fd, "maxAmount"),
      imageUrl,
      isActive: bool(fd, "isActive"),
      sortOrder: int(fd, "sortOrder") ?? 0,
    },
  });
  revalidatePath("/", "layout");
  back("/admin/payment-methods", "Metode pembayaran disimpan");
}

// ---------- Payment gateways ----------
const GW_PATH = "/admin/payment-gateways";

export async function saveGatewayAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const existing = id ? await db.paymentGateway.findUnique({ where: { id } }) : null;
  if (id && !existing) back(GW_PATH, "Gateway tidak ditemukan", "err");
  const provider = (existing?.provider ?? str(fd, "provider")) as GatewayProvider;
  const spec = PROVIDERS[provider];
  if (!spec) back(GW_PATH, "Provider tidak didukung", "err");

  const config: Record<string, string> = {};
  for (const f of spec.configFields) config[f.key] = str(fd, `cfg_${f.key}`);
  // Secret kosong = pertahankan yang lama.
  let old: Record<string, string> = {};
  try {
    old = decryptJson(existing?.secrets);
  } catch {
    old = {};
  }
  const secrets: Record<string, string> = {};
  for (const f of spec.secretFields) secrets[f.key] = str(fd, `sec_${f.key}`) || old[f.key] || "";

  const data = {
    name: str(fd, "name") || spec.label,
    isSandbox: bool(fd, "isSandbox"),
    isActive: bool(fd, "isActive"),
    config,
    secrets: spec.secretFields.length ? encryptJson(secrets) : null,
  };
  if (data.isActive && provider !== "MOCK") {
    const missing = [...spec.configFields.filter((f) => f.key === "va" && !config[f.key]), ...spec.secretFields.filter((f) => !secrets[f.key])];
    if (missing.length) back(GW_PATH, `Tidak bisa diaktifkan: ${missing.map((f) => f.label).join(", ")} belum diisi`, "err");
  }
  if (existing) {
    await db.paymentGateway.update({ where: { id }, data });
  } else {
    const code = str(fd, "code").toLowerCase();
    if (!/^[a-z0-9-]{2,32}$/.test(code)) back(GW_PATH, "Kode hanya huruf kecil/angka/strip (2–32)", "err");
    if (await db.paymentGateway.findUnique({ where: { code } })) back(GW_PATH, `Kode ${code} sudah dipakai`, "err");
    await db.paymentGateway.create({ data: { ...data, code, provider } });
  }
  revalidatePath("/", "layout");
  back(GW_PATH, "Gateway disimpan");
}

export async function gatewayOpAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const op = str(fd, "op");
  const gw = await db.paymentGateway.findUnique({ where: { id }, include: { _count: { select: { orders: true, methods: true } } } });
  if (!gw) back(GW_PATH, "Gateway tidak ditemukan", "err");
  if (op === "test") {
    let msg: string;
    try {
      msg = await gatewayAdapter(gw).testConnection();
    } catch (e) {
      back(GW_PATH, `${gw.name}: ${e instanceof Error ? e.message : String(e)}`, "err");
    }
    back(GW_PATH, `${gw.name}: ${msg}`);
  }
  if (op === "useForAll") {
    if (!gw.isActive) back(GW_PATH, "Aktifkan gateway dulu", "err");
    const { count } = await db.paymentMethod.updateMany({ data: { gatewayId: gw.id } });
    revalidatePath("/", "layout");
    back(GW_PATH, `${count} metode pembayaran sekarang memakai ${gw.name}`);
  }
  if (op === "delete") {
    if (gw._count.orders || gw._count.methods)
      back(GW_PATH, "Gateway masih dipakai metode/transaksi — nonaktifkan saja", "err");
    await db.paymentGateway.delete({ where: { id } });
    back(GW_PATH, "Gateway dihapus");
  }
  back(GW_PATH, "Aksi tidak dikenal", "err");
}

// ---------- Banners ----------
export async function saveBannerAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  if (str(fd, "op") === "delete") {
    await db.banner.delete({ where: { id } });
    revalidatePath("/");
    back("/admin/banners", "Banner dihapus");
  }
  const data = {
    title: str(fd, "title"),
    subtitle: str(fd, "subtitle") || null,
    imageUrl: await image(fd, "imageUrl", "banners", "/admin/banners"),
    linkUrl: str(fd, "linkUrl") || null,
    isActive: bool(fd, "isActive"),
    sortOrder: int(fd, "sortOrder") ?? 0,
  };
  if (!data.title) back("/admin/banners", "Judul wajib diisi", "err");
  if (id) await db.banner.update({ where: { id }, data });
  else await db.banner.create({ data });
  revalidatePath("/");
  back("/admin/banners", "Banner disimpan");
}

// ---------- Users ----------
export async function setRoleAction(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, "id");
  if (id === me.id) back("/admin/users", "Tidak bisa mengubah role sendiri", "err");
  await db.user.update({ where: { id }, data: { role: str(fd, "role") === "ADMIN" ? "ADMIN" : "MEMBER" } });
  back("/admin/users", "Role diperbarui");
}
