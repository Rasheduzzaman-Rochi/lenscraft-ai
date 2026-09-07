"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

export function AdminLoginForm() {
  const router = useRouter();
  const [credential, setCredential] = useState("");
  const [showCredential, setShowCredential] = useState(false);
  const [state, setState] = useState<{ busy: boolean; message?: string }>({ busy: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credential.trim()) return;
    setState({ busy: true });

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const payload = await response.json().catch(() => null) as { message?: unknown } | null;
      if (!response.ok) {
        setCredential("");
        setState({
          busy: false,
          message: typeof payload?.message === "string" ? payload.message : "Login was unsuccessful.",
        });
        return;
      }

      setCredential("");
      router.replace("/admin");
      router.refresh();
    } catch {
      setState({ busy: false, message: "Admin login is temporarily unavailable." });
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <div>
        <label htmlFor="admin-credential" className="text-[9px] font-semibold uppercase tracking-[0.2em] text-paper/50">
          Admin password
        </label>
        <div className="relative mt-3">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-paper/35" />
          <input
            id="admin-credential"
            name="credential"
            type={showCredential ? "text" : "password"}
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            autoComplete="current-password"
            required
            maxLength={1_024}
            className="h-14 w-full border border-paper/15 bg-paper/[0.04] px-11 text-sm text-paper outline-none transition placeholder:text-paper/25 focus:border-clay"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowCredential((value) => !value)}
            aria-label={showCredential ? "Hide credential" : "Show credential"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-paper/40 transition hover:text-paper"
          >
            {showCredential ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" variant="light" className="w-full" disabled={state.busy}>
        {state.busy ? <>Verifying <LoaderCircle className="h-4 w-4 animate-spin" /></> : <>Enter studio admin <ArrowRight className="h-4 w-4" /></>}
      </Button>
      {state.message ? <p role="alert" className="border-l-2 border-[#d39a90] pl-4 text-xs leading-5 text-[#e7b7af]">{state.message}</p> : null}
    </form>
  );
}
