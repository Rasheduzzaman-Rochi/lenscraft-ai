"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle, Mic, PhoneOff, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RetellWebClient } from "retell-client-js-sdk";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CallStatus = "idle" | "connecting" | "active" | "ended" | "error";

type SessionResponse = {
  accessToken?: unknown;
};

const OPEN_VOICE_ASSISTANT_EVENT = "lenscraft:open-voice-assistant";

function microphoneErrorMessage(error: unknown) {
  if (error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name)) {
    return "Microphone access is blocked. Allow microphone access in your browser, then try again.";
  }

  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No microphone was found. Connect a microphone and try again.";
  }

  if (error instanceof DOMException && error.name === "NotSupportedError") {
    return "Voice calling is unavailable in this browser. Try a current browser over HTTPS.";
  }

  return "We could not start the voice assistant. Please try again in a moment.";
}

async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Microphone access is unavailable.", "NotSupportedError");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

export function VoiceAssistantTrigger({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      type="button"
      className={className}
      {...props}
      onClick={() => window.dispatchEvent(new Event(OPEN_VOICE_ASSISTANT_EVENT))}
    >
      {children ?? (
        <>
          Talk with LensCraft AI <Mic className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export function VoiceAssistant() {
  const reduceMotion = useReducedMotion();
  const clientRef = useRef<RetellWebClient | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const attemptRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isAgentTalking, setIsAgentTalking] = useState(false);
  const [message, setMessage] = useState("Ready when you are.");

  const updateStatus = useCallback((nextStatus: CallStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const getClient = useCallback(async () => {
    if (clientRef.current) return clientRef.current;

    const { RetellWebClient } = await import("retell-client-js-sdk");
    const client = new RetellWebClient();

    client.on("call_started", () => {
      updateStatus("active");
      setMessage("You are connected. Speak naturally when you are ready.");
    });
    client.on("call_ended", () => {
      setIsAgentTalking(false);
      updateStatus("ended");
      setMessage("The conversation has ended. Thank you for speaking with us.");
    });
    client.on("agent_start_talking", () => setIsAgentTalking(true));
    client.on("agent_stop_talking", () => setIsAgentTalking(false));
    client.on("error", () => {
      setIsAgentTalking(false);
      updateStatus("error");
      setMessage("The connection was interrupted. Please try again.");
    });

    clientRef.current = client;
    return client;
  }, [updateStatus]);

  const startCall = useCallback(async () => {
    if (statusRef.current === "connecting" || statusRef.current === "active") return;

    const attempt = ++attemptRef.current;
    setIsOpen(true);
    updateStatus("connecting");
    setMessage("Preparing a private voice session…");

    try {
      await requestMicrophoneAccess();
      if (attempt !== attemptRef.current) return;

      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as SessionResponse | null;

      if (attempt !== attemptRef.current) return;
      if (!response.ok || typeof payload?.accessToken !== "string") {
        throw new Error("Voice session unavailable");
      }

      const client = await getClient();
      if (attempt !== attemptRef.current) return;
      await client.startCall({ accessToken: payload.accessToken });
      if (attempt !== attemptRef.current) client.stopCall();
    } catch (error) {
      if (attempt !== attemptRef.current) return;
      updateStatus("error");
      setMessage(microphoneErrorMessage(error));
    }
  }, [getClient, updateStatus]);

  function stopCall() {
    clientRef.current?.stopCall();
    setIsAgentTalking(false);
    updateStatus("ended");
    setMessage("The conversation has ended. Thank you for speaking with us.");
  }

  function closeAssistant() {
    attemptRef.current += 1;
    if (statusRef.current === "active") clientRef.current?.stopCall();
    if (statusRef.current === "connecting") updateStatus("idle");
    setIsOpen(false);
  }

  useEffect(() => {
    const openAssistant = () => void startCall();
    window.addEventListener(OPEN_VOICE_ASSISTANT_EVENT, openAssistant);

    return () => {
      attemptRef.current += 1;
      window.removeEventListener(OPEN_VOICE_ASSISTANT_EVENT, openAssistant);
      clientRef.current?.stopCall();
    };
  }, [startCall]);

  const statusLabel = status === "active" ? "Live" : status === "connecting" ? "Connecting" : status === "error" ? "Unavailable" : "Ready";

  return (
    <>
      <AnimatePresence>
        {isOpen ? (
          <motion.aside
            role="dialog"
            aria-modal="false"
            aria-label="LensCraft AI voice assistant"
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 left-4 right-4 z-[60] overflow-hidden border border-paper/10 bg-charcoal text-paper shadow-[0_28px_90px_rgba(23,22,18,0.32)] sm:left-auto sm:right-6 sm:w-[390px]"
          >
            <div className="flex items-start justify-between border-b border-paper/10 px-6 py-5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-clay">LensCraft Studio</p>
                <h2 className="mt-2 font-serif text-2xl">AI studio assistant</h2>
              </div>
              <button
                type="button"
                onClick={closeAssistant}
                aria-label="Close voice assistant"
                className="grid h-9 w-9 place-items-center rounded-full border border-paper/15 text-paper/60 transition hover:border-paper/40 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-7">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-paper/55">
                  <span className={cn("h-1.5 w-1.5 rounded-full", status === "active" ? "bg-emerald-300" : status === "error" ? "bg-red-300" : "bg-clay")} />
                  {statusLabel}
                </span>
                <Sparkles className="h-4 w-4 text-clay" strokeWidth={1.4} />
              </div>

              <div className="my-8 flex h-28 items-center justify-center" aria-hidden="true">
                <div className={cn("relative grid h-24 w-24 place-items-center rounded-full border border-clay/35 bg-paper/[0.04]", isAgentTalking && "border-clay/80")}>
                  {isAgentTalking ? (
                    <motion.span
                      className="absolute inset-0 rounded-full border border-clay/50"
                      animate={reduceMotion ? undefined : { scale: [1, 1.32], opacity: [0.7, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                    />
                  ) : null}
                  {status === "connecting" ? <LoaderCircle className="h-8 w-8 animate-spin text-clay" strokeWidth={1.2} /> : <Mic className="h-8 w-8 text-clay" strokeWidth={1.2} />}
                </div>
              </div>

              <p className="min-h-12 text-center text-sm leading-6 text-paper/65" aria-live="polite">{message}</p>

              <div className="mt-6">
                {status === "active" ? (
                  <Button type="button" variant="light" className="w-full" onClick={stopCall}>
                    End conversation <PhoneOff className="h-4 w-4" />
                  </Button>
                ) : status === "error" || status === "ended" ? (
                  <Button type="button" variant="light" className="w-full" onClick={() => void startCall()}>
                    Try again <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" variant="light" className="w-full" disabled>
                    Connecting <LoaderCircle className="h-4 w-4 animate-spin" />
                  </Button>
                )}
              </div>

              <p className="mt-4 text-center text-[9px] uppercase tracking-[0.16em] text-paper/35">
                Microphone active only during your call
              </p>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => void startCall()}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        aria-label="Talk with LensCraft AI"
        className="fixed bottom-5 right-4 z-[60] flex min-h-14 items-center gap-3 rounded-full border border-paper/15 bg-ink px-4 text-paper shadow-[0_16px_45px_rgba(23,22,18,0.28)] transition hover:bg-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2 sm:bottom-6 sm:right-6 sm:px-5"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-bronze">
          {status === "connecting" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-[0.16em] sm:text-[9px] sm:tracking-[0.18em]">Talk with LensCraft AI</span>
      </motion.button>
    </>
  );
}
