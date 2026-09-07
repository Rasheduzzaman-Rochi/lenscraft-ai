import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_CREATE_WEB_CALL_URL = "https://api.retellai.com/v2/create-web-call";
const REQUEST_TIMEOUT_MS = 10_000;

type RetellWebCallResponse = {
  access_token?: unknown;
  call_id?: unknown;
};

function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

function isCrossSite(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin !== request.nextUrl.origin;
  } catch {
    return true;
  }
}

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) {
    return NextResponse.json(
      { error: "Voice assistant request was not accepted." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const apiKey = process.env.RETELL_API_KEY?.trim();
  const agentId = process.env.NEXT_PUBLIC_RETELL_AGENT_ID?.trim();

  if (!apiKey || !agentId) {
    console.error("Retell web call is not configured.");
    return NextResponse.json(
      { error: "Voice assistant is temporarily unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  try {
    const response = await fetch(RETELL_CREATE_WEB_CALL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ agent_id: agentId }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const payload = (await response.json().catch(() => null)) as RetellWebCallResponse | null;
    if (!response.ok || typeof payload?.access_token !== "string") {
      console.error("Retell web call session creation failed.", { status: response.status });
      return NextResponse.json(
        { error: "Voice assistant is temporarily unavailable." },
        { status: 503, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      {
        accessToken: payload.access_token,
        callId: typeof payload.call_id === "string" ? payload.call_id : undefined,
      },
      { headers: noStoreHeaders() },
    );
  } catch {
    console.error("Retell web call session request could not be completed.");
    return NextResponse.json(
      { error: "Voice assistant is temporarily unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}
