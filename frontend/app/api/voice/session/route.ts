import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RETELL_CREATE_WEB_CALL_URL = "https://api.retellai.com/v2/create-web-call";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_BYTES = 1_024;
let loggedConfigurationState: string | undefined;

type RetellWebCallResponse = {
  access_token?: unknown;
  call_id?: unknown;
};

function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

function configuration() {
  const agentIdEnvironmentKey = "NEXT_PUBLIC_RETELL_AGENT_ID";
  const apiKey = process.env.RETELL_API_KEY?.trim();
  const agentId = process.env[agentIdEnvironmentKey]?.trim();
  const state = {
    hasRetellKey: Boolean(apiKey),
    hasAgentId: Boolean(agentId),
  };
  const serializedState = JSON.stringify(state);

  if (serializedState !== loggedConfigurationState) {
    console.info("[retell-session] config", state);
    loggedConfigurationState = serializedState;
  }

  return { apiKey, agentId };
}

export async function POST(request: NextRequest) {
  // Requiring JSON prevents cross-site form submissions. Browser requests from
  // another origin must pass a CORS preflight, while the website's same-origin
  // client can call this route through any trusted reverse proxy configuration.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { error: "Voice assistant request was not accepted." },
      { status: 415, headers: noStoreHeaders() },
    );
  }

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) throw new Error();
    const body = await request.text();
    if (!body || new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) throw new Error();
    const payload: unknown = JSON.parse(body);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Voice assistant request was not accepted." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const { apiKey, agentId } = configuration();

  if (!apiKey || !agentId) {
    console.error("[retell-session] web call is not configured");
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
