"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkPassword, endSession, hashPassword, startSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { rateLimit } from "@/lib/ratelimit";

export type AuthState = { error?: string } | undefined;

/** Hanya izinkan redirect ke path internal. */
function safeNext(v: FormDataEntryValue | null, fallback: string) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await rateLimit("login", 10, 5 * 60_000))) return { error: "Terlalu banyak percobaan. Coba lagi nanti." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await checkPassword(password, user.passwordHash))) return { error: "Email atau password salah" };
  await startSession(user);
  redirect(safeNext(fd.get("next"), user.role === "ADMIN" ? "/admin" : "/akun"));
}

const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60),
  email: z.string().trim().toLowerCase().email("Email tidak valid"),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password minimal 8 karakter").max(100),
});

export async function register(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await rateLimit("register", 5, 10 * 60_000))) return { error: "Terlalu banyak percobaan. Coba lagi nanti." };
  const parsed = RegisterSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const { name, email, password } = parsed.data;
  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normalizePhone(parsed.data.phone);
    if (!phone) return { error: "Nomor WhatsApp tidak valid" };
  }
  if (await db.user.findUnique({ where: { email } })) return { error: "Email sudah terdaftar" };
  const user = await db.user.create({ data: { name, email, phone, passwordHash: await hashPassword(password) } });
  await startSession(user);
  redirect(safeNext(fd.get("next"), "/akun"));
}

export async function logout() {
  await endSession();
  redirect("/");
}
