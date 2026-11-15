import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session";

export async function getSession() {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value);
}

/** Session + user dari DB (memastikan user masih ada & role terbaru). */
export async function getCurrentUser() {
  const s = await getSession();
  if (!s) return null;
  return db.user.findUnique({
    where: { id: s.sub },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u || u.role !== "ADMIN") redirect("/login?next=/admin");
  return u;
}

export async function startSession(user: { id: string; role: "MEMBER" | "ADMIN"; name: string }) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
