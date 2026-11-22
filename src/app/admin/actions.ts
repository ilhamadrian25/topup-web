"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { billerAdapter, BILLER_PROVIDERS } from "@/lib/biller";
import { repriceFromBase } from "@/lib/catalog";
import { runProductSync, syncSummary } from "@/lib/product-sync";
import { markOrderPaid, markRefunded, retryFulfillment, syncGatewayPayment, OrderError } from "@/lib/orders";
import { gatewayAdapter, PROVIDERS } from "@/lib/payment";
import { decryptJson, encryptJson } from "@/lib/secrets";
import type { BillerProvider, GatewayProvider, PaymentGroup } from "@prisma/client";
import { getSettings, saveSettings } from "@/lib/settings";
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
  let msg: string;
  try {
    msg = "Sync selesai: " + syncSummary(await runProductSync("manual"));
  } catch (e) {
    back("/admin/settings", "Sync gagal: " + String(e), "err");
  }
  back("/admin/settings", msg);
}

// ---------- Settings ----------
export async function settingsAction(fd: FormData) {
  await requireAdmin();
  const logoUrl = await image(fd, "logoUrl", "store", "/admin/settings");
  const before = await getSettings();
  const markups = {
    defaultMarginBps: Math.max(0, int(fd, "defaultMarginBps") ?? 0),
    defaultMemberMarginBps: Math.max(0, int(fd, "defaultMemberMarginBps") ?? 0),
  };
  await saveSettings({
    logoUrl: logoUrl ?? "",
    storeName: str(fd, "storeName") || "Top Up",
    tagline: str(fd, "tagline"),
    whatsappCs: str(fd, "whatsappCs"),
    contactEmail: str(fd, "contactEmail"),
    contactPhone: str(fd, "contactPhone"),
    businessName: str(fd, "businessName"),
    businessAddress: str(fd, "businessAddress"),
    ...markups,
    autoSyncMinutes: Math.max(0, int(fd, "autoSyncMinutes") ?? 0),
  });
  let msg = "Pengaturan disimpan";
  if (markups.defaultMarginBps !== before.defaultMarginBps || markups.defaultMemberMarginBps !== before.defaultMemberMarginBps)
    msg += `. Harga ${await repriceFromBase(db, markups)} produk dihitung ulang`;
  revalidatePath("/", "layout");
  back("/admin/settings", msg);
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
  // Harga jual & member tidak diedit di sini: selalu modal + markup kategori (lihat Pengaturan).
  await db.$transaction(
    ids.map((pid) =>
      db.product.updateMany({
        where: { id: pid, gameId },
        data: { name: str(fd, `name_${pid}`) || undefined, isActive: bool(fd, `active_${pid}`), sortOrder: int(fd, `sort_${pid}`) ?? 0 },
      }),
    ),
  );
  revalidatePath(`/games`);
  back(`/admin/games/${gameId}`, "Produk disimpan");
}

// ---------- Category markups ----------
export async function saveCategoryMarginsAction(fd: FormData) {
  await requireAdmin();
  const path = "/admin/settings";
  const ids = fd.getAll("cid").map(String);
  const rows = ids.map((id) => ({
    id,
    marginBps: int(fd, `bps_${id}`),
    marginFlat: int(fd, `flat_${id}`) ?? 0,
    memberMarginBps: int(fd, `mbps_${id}`),
    memberMarginFlat: int(fd, `mflat_${id}`) ?? 0,
  }));
  if (rows.some((r) => Object.values(r).some((v) => typeof v === "number" && v < 0))) back(path, "Markup tidak boleh negatif", "err");
  await db.$transaction(rows.map(({ id, ...data }) => db.category.update({ where: { id }, data })));
  const n = await repriceFromBase(db, await getSettings());
  revalidatePath("/", "layout");
  back(path, `Markup kategori disimpan, harga ${n} produk dihitung ulang`);
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

// ---------- Billers ----------
const BILLER_PATH = "/admin/billers";

export async function saveBillerAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const existing = id ? await db.billerAccount.findUnique({ where: { id } }) : null;
  if (id && !existing) back(BILLER_PATH, "Biller tidak ditemukan", "err");
  const provider = (existing?.provider ?? str(fd, "provider")) as BillerProvider;
  const spec = BILLER_PROVIDERS[provider];
  if (!spec) back(BILLER_PATH, "Provider tidak didukung", "err");

  const config: Record<string, string> = {};
  for (const f of spec.configFields) config[f.key] = str(fd, `cfg_${f.key}`);
  if (config.baseUrl && !/^https?:\/\/[^\s]+$/.test(config.baseUrl)) back(BILLER_PATH, "Base URL tidak valid", "err");
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
    config,
    secrets: spec.secretFields.length ? encryptJson(secrets) : null,
  };
  if (existing?.isActive) {
    const missing = spec.secretFields.filter((f) => spec.required.includes(f.key) && !secrets[f.key]);
    if (missing.length) back(BILLER_PATH, `Biller aktif wajib lengkap: ${missing.map((f) => f.label).join(", ")}`, "err");
  }
  if (existing) {
    await db.billerAccount.update({ where: { id }, data });
  } else {
    const code = str(fd, "code").toLowerCase();
    if (!/^[a-z0-9-]{2,32}$/.test(code)) back(BILLER_PATH, "Kode hanya huruf kecil/angka/strip (2–32)", "err");
    if (await db.billerAccount.findUnique({ where: { code } })) back(BILLER_PATH, `Kode ${code} sudah dipakai`, "err");
    await db.billerAccount.create({ data: { ...data, code, provider, isActive: false } });
  }
  back(BILLER_PATH, "Biller disimpan");
}

export async function billerOpAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const op = str(fd, "op");
  const acc = await db.billerAccount.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
  if (!acc) back(BILLER_PATH, "Biller tidak ditemukan", "err");
  if (op === "test") {
    let msg: string;
    try {
      const balance = await billerAdapter(acc).getBalance();
      msg = `Terhubung. Saldo deposit Rp ${balance.toLocaleString("id-ID")}`;
    } catch (e) {
      back(BILLER_PATH, `${acc.name}: ${e instanceof Error ? e.message : String(e)}`, "err");
    }
    back(BILLER_PATH, `${acc.name}: ${msg}`);
  }
  if (op === "activate") {
    const spec = BILLER_PROVIDERS[acc.provider];
    let sec: Record<string, string> = {};
    try {
      sec = decryptJson(acc.secrets);
    } catch {
      sec = {};
    }
    const missing = spec.secretFields.filter((f) => spec.required.includes(f.key) && !sec[f.key]);
    if (missing.length) back(BILLER_PATH, `Tidak bisa diaktifkan: ${missing.map((f) => f.label).join(", ")} belum diisi`, "err");
    // Satu biller aktif untuk order baru; order yang sedang diproses tetap dicek ke biller lamanya.
    await db.$transaction([
      db.billerAccount.updateMany({ where: { id: { not: acc.id } }, data: { isActive: false } }),
      db.billerAccount.update({ where: { id: acc.id }, data: { isActive: true } }),
    ]);
    revalidatePath("/admin", "layout");
    back(BILLER_PATH, `${acc.name} sekarang biller aktif. Jalankan Sync Produk di Pengaturan & Sync.`);
  }
  if (op === "deactivate") {
    await db.billerAccount.update({ where: { id: acc.id }, data: { isActive: false } });
    revalidatePath("/admin", "layout");
    back(BILLER_PATH, `${acc.name} dinonaktifkan`);
  }
  if (op === "delete") {
    if (acc.isActive) back(BILLER_PATH, "Nonaktifkan biller dulu", "err");
    if (acc._count.orders) back(BILLER_PATH, "Biller sudah dipakai transaksi — nonaktifkan saja", "err");
    await db.billerAccount.delete({ where: { id } });
    back(BILLER_PATH, "Biller dihapus");
  }
  back(BILLER_PATH, "Aksi tidak dikenal", "err");
}

// ---------- Banners ----------
// Catatan: jangan bedakan aksi lewat <button name="op" value="…">. Form yang punya
// <input name="id"> membuat `form.id` mengembalikan elemen itu, sehingga React
// tidak menyertakan nilai tombol submitter ke FormData. Pakai input hidden "op"
// per form, atau formAction ke server action terpisah seperti di bawah.
export async function deleteBannerAction(fd: FormData) {
  await requireAdmin();
  await db.banner.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/");
  back("/admin/banners", "Banner dihapus");
}

export async function saveBannerAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
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
