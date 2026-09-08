"use client";

import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<{ busy: boolean; message?: string }>({ busy: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setState({ busy: true });

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setPassword("");
        setState({
          busy: false,
          message: "The email or password is incorrect.",
        });
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("role")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .eq("role", "admin")
        .maybeSingle();
      if (adminError || adminUser?.role !== "admin") {
        await supabase.auth.signOut();
        setPassword("");
        setState({ busy: false, message: "This account is not authorized for studio administration." });
        return;
      }

      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch {
      setState({ busy: false, message: "Admin login is temporarily unavailable." });
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <div>
        <label htmlFor="admin-email" className="text-[9px] font-semibold uppercase tracking-[0.2em] text-paper/50">
          Email address
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          maxLength={320}
          className="mt-3 h-14 w-full border border-paper/15 bg-paper/[0.04] px-4 text-sm text-paper outline-none transition placeholder:text-paper/25 focus:border-clay"
          placeholder="admin@example.com"
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="text-[9px] font-semibold uppercase tracking-[0.2em] text-paper/50">
          Password
        </label>
        <div className="relative mt-3">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-paper/35" />
          <input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            maxLength={512}
            className="h-14 w-full border border-paper/15 bg-paper/[0.04] px-11 text-sm text-paper outline-none transition placeholder:text-paper/25 focus:border-clay"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-paper/40 transition hover:text-paper"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
