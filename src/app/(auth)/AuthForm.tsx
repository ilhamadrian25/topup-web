"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : register, undefined);
  const isReg = mode === "register";
  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-extrabold">{isReg ? "Daftar Member" : "Masuk"}</h1>
      <p className="mt-1 text-sm text-muted">
        {isReg ? "Gratis, dan dapat harga member di setiap transaksi." : "Masuk untuk harga member & riwayat transaksi."}
      </p>
      <form action={action} className="card mt-6 space-y-3 p-5">
        {next && <input type="hidden" name="next" value={next} />}
        {isReg && (
          <div>
            <label className="label" htmlFor="name">Nama</label>
            <input id="name" name="name" className="input" required autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" required autoComplete="email" />
        </div>
        {isReg && (
          <div>
            <label className="label" htmlFor="phone">No. WhatsApp (opsional)</label>
            <input id="phone" name="phone" className="input" inputMode="tel" autoComplete="tel" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            required
            minLength={isReg ? 8 : undefined}
            autoComplete={isReg ? "new-password" : "current-password"}
          />
        </div>
        {state?.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Memproses…" : isReg ? "Daftar" : "Masuk"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {isReg ? "Sudah punya akun? " : "Belum punya akun? "}
        <Link href={isReg ? "/login" : "/register"} className="text-accent hover:underline">
          {isReg ? "Masuk" : "Daftar gratis"}
        </Link>
      </p>
    </div>
  );
}
