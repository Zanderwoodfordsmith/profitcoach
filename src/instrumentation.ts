/** Runs once when the server starts. */
export async function register() {
  // Local dev only: pull cards Claude finishes in the cloud into this folder (3002).
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "development" &&
    process.env.ROADMAP_AGENT_PULL !== "off"
  ) {
    const { startRoadmapAgentPull } = await import("@/lib/roadmap/agentPull");
    startRoadmapAgentPull();
  }
}
