"use client";

/* eslint-disable @next/next/no-img-element */
import { ImagePlus, Link2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Input gambar admin: upload file (dengan preview) atau tempel URL.
 * Mengirim field `${name}File`, `${name}` (URL lama/teks), `${name}Remove`.
 * Diproses di server oleh imageFromForm().
 */
export function ImageField({
  name,
  label,
  defaultValue,
  aspect = "aspect-square",
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  aspect?: string;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [remove, setRemove] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Setelah server action + redirect, komponen tidak di-remount: sinkronkan ke nilai tersimpan.
  useEffect(() => {
    setUrl(defaultValue ?? "");
    setPreview(defaultValue || null);
    setRemove(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [defaultValue]);

  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  function onFile(f?: File) {
    setErr(null);
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setErr("Maksimal 2 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setRemove(false);
    setPreview(URL.createObjectURL(f));
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`relative flex w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-surface-2 text-muted transition hover:border-accent hover:text-accent ${aspect}`}
        >
          {preview && !remove ? (
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[11px] font-semibold">
              <ImagePlus className="h-5 w-5" />
              Upload
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2 text-xs">
          <input
            ref={fileRef}
            type="file"
            name={`${name}File`}
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" /> Pilih file
            </button>
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setShowUrl((v) => !v)}>
              <Link2 className="h-3.5 w-3.5" /> URL
            </button>
            {(preview || url) && (
              <label className="btn-ghost cursor-pointer !px-3 !py-1.5 text-xs text-danger">
                <input
                  type="checkbox"
                  name={`${name}Remove`}
                  className="hidden"
                  checked={remove}
                  onChange={(e) => {
                    setRemove(e.target.checked);
                    if (e.target.checked && fileRef.current) fileRef.current.value = "";
                  }}
                />
                <Trash2 className="h-3.5 w-3.5" /> {remove ? "Batal hapus" : "Hapus"}
              </label>
            )}
          </div>
          <input
            name={name}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(e.target.value || null);
            }}
            placeholder="https://… atau /uploads/…"
            className={`input !py-1.5 text-xs ${showUrl ? "" : "hidden"}`}
          />
          <p className="text-muted">{err ? <span className="text-danger">{err}</span> : hint ?? "PNG/JPG/WEBP, maks 2 MB"}</p>
        </div>
      </div>
    </div>
  );
}
