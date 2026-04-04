import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/ui/sidebar";
import LinearIntegrationCard from "./_components/LinearIntegrationCard";
import SlackIntegrationCard from "./_components/SlackIntegrationCard";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let linearConnected = false;
  let linearWorkspaceInfo: Record<string, unknown> = {};
  let slackConnected = false;
  let slackWorkspaceInfo: Record<string, unknown> = {};

  if (user) {
    const [linearResult, slackResult] = await Promise.all([
      supabase
        .from("user_integrations")
        .select("workspace_info")
        .eq("user_id", user.id)
        .eq("provider", "linear")
        .single(),
      supabase
        .from("user_integrations")
        .select("workspace_info")
        .eq("user_id", user.id)
        .eq("provider", "slack")
        .single(),
    ]);

    if (linearResult.data) {
      linearConnected = true;
      linearWorkspaceInfo = (linearResult.data.workspace_info as Record<string, unknown>) ?? {};
    }

    if (slackResult.data) {
      slackConnected = true;
      slackWorkspaceInfo = (slackResult.data.workspace_info as Record<string, unknown>) ?? {};
    }
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "#F8F4EF",
        fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
      }}
    >
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header bar — matches all other app pages */}
        <header
          className="flex items-center px-6 flex-shrink-0"
          style={{
            height: 52,
            background: "#FFFFFF",
            borderBottom: "1px solid #E4DDD4",
          }}
        >
          <div
            className="flex items-center gap-1.5"
            style={{ fontSize: 13, color: "#6B6B6B" }}
          >
            <span>Settings</span>
            <span style={{ color: "#C0B8B0" }}>/</span>
            <span style={{ fontWeight: 500, color: "#0D0D0D" }}>
              Integrations
            </span>
          </div>
        </header>

        {/* Page content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: "32px 40px" }}
        >
          <div style={{ maxWidth: 640 }}>
            {/* Page heading */}
            <h1
              className="font-display"
              style={{
                fontSize: 22,
                fontWeight: 400,
                marginBottom: 4,
                color: "#0D0D0D",
                letterSpacing: "-0.02em",
              }}
            >
              Integrations
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: "#6B6B6B",
                marginBottom: 32,
                lineHeight: 1.5,
              }}
            >
              Connect third-party tools to automatically sync your pipeline
              output.
            </p>

            {/* Communication section */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#9E9E9E",
                marginBottom: 10,
              }}
            >
              Communication
            </div>

            <SlackIntegrationCard
              connected={slackConnected}
              workspaceInfo={slackWorkspaceInfo}
            />

            {/* Project Management section */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#9E9E9E",
                marginBottom: 10,
                marginTop: 28,
              }}
            >
              Project Management
            </div>

            <LinearIntegrationCard
              connected={linearConnected}
              workspaceInfo={linearWorkspaceInfo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
