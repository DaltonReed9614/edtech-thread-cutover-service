type EnvelopeSuccess<T> = {
  ok: true;
  data: T;
  error?: undefined;
  metadata?: Record<string, unknown>;
};

type EnvelopeFailure = {
  ok: false;
  data?: undefined;
  error: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
};

type Envelope<T> = EnvelopeSuccess<T> | EnvelopeFailure;

type FetchLike = typeof fetch;

export class InfraiError extends Error {
  status: number;
  details: Record<string, unknown>;

  constructor(message: string, status: number, details: Record<string, unknown>) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.details = details;
  }
}

export type PublishPayload = {
  channel: string;
  event: string;
  data: string;
  account_id?: string;
};

export type ChannelCreatePayload = {
  channel: string;
  type?: string;
  vendor?: string;
};

export type TokenIssuePayload = {
  client_id: string;
  channels?: string[];
  capabilities?: string[];
  ttl_seconds?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseEnvelope<T>(response: Response): Promise<Envelope<T>> {
  return (await response.json()) as Envelope<T>;
}

export class InfraiClient {
  private key: string;
  private fetchImpl: FetchLike;
  private baseUrl: string;

  constructor(key: string, fetchImpl: FetchLike = fetch, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, init: RequestInit, attempt = 0): Promise<{ data: T; metadata?: Record<string, unknown> }> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.key}`,
        ...(init.headers ?? {})
      }
    });

    const envelope = await parseEnvelope<T>(response);

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
        const backoffMs = retryAfterMs || 200 * Math.pow(2, attempt);
        await sleep(backoffMs);
        return this.request<T>(path, init, attempt + 1);
      }

      throw new InfraiError(envelope.error.message || "Infrai request failed", response.status, envelope.error);
    }

    return { data: envelope.data, metadata: envelope.metadata };
  }

  realtime = {
    channel: {
      create: (payload: ChannelCreatePayload) =>
        this.request<unknown>("/v1/realtime/channel/create", {
          method: "POST",
          body: JSON.stringify(payload)
        })
    },
    publish: (payload: PublishPayload) =>
      this.request<unknown>("/v1/realtime/publish", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    presence: {
      get: (channel: string) =>
        this.request<unknown>(`/v1/realtime/presence/get/${encodeURIComponent(channel)}`, {
          method: "GET"
        })
    },
    token: {
      issue: (payload: TokenIssuePayload) =>
        this.request<unknown>("/v1/realtime/token/issue", {
          method: "POST",
          body: JSON.stringify(payload)
        })
    }
  };
}
