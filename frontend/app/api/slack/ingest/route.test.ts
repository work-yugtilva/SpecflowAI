import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
const mockGetUserIntegrationAccessToken = vi.fn();
const mockGetRequiredAuthHeader = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/server/user-integrations", () => ({
  getUserIntegrationAccessToken: mockGetUserIntegrationAccessToken,
}));

vi.mock("@/lib/supabase/get-auth-header", () => ({
  getRequiredAuthHeader: mockGetRequiredAuthHeader,
  isMissingAuthSessionError: vi.fn(() => false),
}));

vi.mock("@/lib/api/express-base", () => ({
  getExpressApiBase: () => "http://express.test",
}));

const { POST } = await import("./route");

type SlackMessage = {
  type: string;
  subtype?: string;
  text?: string;
  username?: string;
};

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/slack/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel_id: "C123",
      channel_name: "product-feedback",
      limit: 50,
      ...overrides,
    }),
  });
}

function setupAuth() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
  });
  mockGetUserIntegrationAccessToken.mockResolvedValue("slack-token");
  mockGetRequiredAuthHeader.mockResolvedValue({ Authorization: "Bearer user-token" });
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  };
}

function setupFetch({
  messages,
  researchOk = () => true,
}: {
  messages: SlackMessage[];
  researchOk?: (index: number) => boolean | Promise<boolean>;
}) {
  const researchBodies: unknown[] = [];
  const researchUrls: string[] = [];
  let researchIndex = 0;

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("https://slack.com/api/conversations.history")) {
      return jsonResponse({ ok: true, messages });
    }

    if (url.startsWith("http://express.test/api/research")) {
      const index = researchIndex++;
      researchUrls.push(url);
      researchBodies.push(JSON.parse(String(init?.body)));
      return jsonResponse({ success: true }, await researchOk(index));
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  return { fetchMock, researchBodies, researchUrls };
}

describe("POST /api/slack/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    setupAuth();
  });

  it("imports only real Slack messages using the existing research payload shape", async () => {
    const { researchBodies } = setupFetch({
      messages: [
        { type: "message", text: "Customer wants CSV export", username: "Maya" },
        { type: "message", subtype: "bot_message", text: "Bot noise" },
        { type: "message", text: "   " },
      ],
    });

    const response = await POST(makeRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      imported: 1,
      channel: "product-feedback",
    });
    expect(researchBodies).toEqual([
      {
        type: "Interview",
        title: "Customer wants CSV export",
        content: "Customer wants CSV export",
        user: "Maya",
        pain: "",
        context: "product-feedback",
        tags: ["slack", "product-feedback"],
      },
    ]);
  });

  it("preserves session scoping when importing Slack messages", async () => {
    const { researchUrls } = setupFetch({
      messages: [{ type: "message", text: "Scoped insight", username: "Ari" }],
    });

    await POST(makeRequest({ session_id: "session-1" }) as never);

    expect(researchUrls).toHaveLength(1);
    expect(researchUrls[0]).toBe(
      "http://express.test/api/research?scope=session&sessionId=session-1"
    );
  });

  it("processes research writes in batches of at most five concurrent requests", async () => {
    const messages = Array.from({ length: 12 }, (_, i) => ({
      type: "message",
      text: `Message ${i}`,
      username: "Slack User",
    }));
    let active = 0;
    let maxActive = 0;
    const batchSizes: number[] = [];

    setupFetch({
      messages,
      researchOk: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 0));
        active -= 1;
        if (active === 0) batchSizes.push(maxActive);
        return true;
      },
    });

    const response = await POST(makeRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(12);
    expect(maxActive).toBe(5);
    expect(batchSizes).toEqual([5, 5, 5]);
  });

  it("counts only successful research writes and keeps individual failures non-fatal", async () => {
    setupFetch({
      messages: [
        { type: "message", text: "Saved", username: "Sam" },
        { type: "message", text: "Rejected", username: "Lee" },
        { type: "message", text: "Also saved", username: "Jo" },
      ],
      researchOk: (index) => index !== 1,
    });

    const response = await POST(makeRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      imported: 2,
      channel: "product-feedback",
    });
  });
});
