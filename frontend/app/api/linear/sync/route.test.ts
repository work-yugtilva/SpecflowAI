import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateClient = vi.fn();
const mockGetUserIntegrationAccessToken = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/server/user-integrations", () => ({
  getUserIntegrationAccessToken: mockGetUserIntegrationAccessToken,
}));

const { POST } = await import("./route");

function makeRequest(linearPayload: unknown) {
  return new Request("http://localhost:3000/api/linear/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linear_payload: linearPayload }),
  });
}

describe("POST /api/linear/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });
    mockGetUserIntegrationAccessToken.mockResolvedValue("linear-token");
  });

  it("uses the server-owned mutation template even when the client sends a malicious mutation", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: { issueCreate: { success: true } } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const response = await POST(makeRequest({
      project: undefined,
      labels: [],
      issues: [
        {
          operation: "IssueCreate",
          mutation: "mutation ProjectDelete($input: ProjectDeleteInput!) { projectDelete(input: $input) { success } }",
          variables: {
            input: {
              title: "Safe issue title",
              teamId: "team-1",
            },
          },
        },
      ],
    }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      results: [
        {
          operation: "IssueCreate",
          success: true,
          errors: null,
        },
      ],
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      query: "mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title } } }",
      variables: {
        input: {
          title: "Safe issue title",
          teamId: "team-1",
        },
      },
    });
  });

  it("rejects unsupported operations without calling Linear", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const response = await POST(makeRequest({
      project: {
        operation: "ProjectDelete",
        variables: { input: { id: "project-1" } },
      },
      labels: [],
      issues: [],
    }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: false,
      results: [
        {
          operation: "ProjectDelete",
          success: false,
          errors: ["Operation not allowed"],
        },
      ],
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects variables with extra top-level keys without calling Linear for that item", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const response = await POST(makeRequest({
      project: undefined,
      labels: [],
      issues: [
        {
          operation: "IssueCreate",
          variables: {
            input: {
              title: "Safe issue title",
              teamId: "team-1",
            },
            query: "mutation Viewer { viewer { id } }",
          },
        },
      ],
    }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: false,
      results: [
        {
          operation: "IssueCreate",
          success: false,
          errors: ["Unexpected variables: query"],
        },
      ],
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
