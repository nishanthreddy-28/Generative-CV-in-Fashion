/** Portable HTTP client for the Gradio API; no model or provider key in the APK.
 * Must be smoke-tested in the teammate's Expo release build before shipping.
 */
export type Session = { access_token: string };
export type SessionProvider = () => Promise<Session>;
export type PoseEstimates = {
  shoulder_landmark_span_cm: number; clothed_waist_front_width_cm: number;
  torso_landmark_length_cm: number; shoulder_hip_ratio: number;
};
export type BodyAnalysis = PoseEstimates & {
  source: 'mediapipe_pose_browser_v1' | 'mediapipe_pose_server_v1'; confirmed: boolean;
  reference_height_cm: number; image_width: number; image_height: number;
  landmark_visibility: number; original_estimates: PoseEstimates; edited_fields: string[];
};

export class InferenceClient {
  private readonly spaceUrl: string;
  private readonly session: SessionProvider;
  constructor(spaceUrl: string, session: SessionProvider) {
    if (!/^https:\/\/[a-zA-Z0-9-]+\.hf\.space\/?$/.test(spaceUrl)) throw new Error("Use your HTTPS hf.space URL");
    this.spaceUrl = spaceUrl;
    this.session = session;
  }

  private async call(endpoint: string, data: unknown[], signal?: AbortSignal): Promise<any> {
    const { access_token } = await this.session();
    const base = this.spaceUrl.replace(/\/$/, "") + "/gradio_api/call/" + endpoint;
    const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [...data, access_token] }), signal });
    if (!response.ok) throw new Error(`Could not start inference (HTTP ${response.status})`);
    const { event_id } = await response.json();
    if (!/^[a-f0-9-]+$/i.test(event_id || "")) throw new Error("Invalid inference job");
    // This stream ends on completion. Buffering works without EventSource support.
    const stream = await fetch(base + "/" + event_id, { signal });
    if (!stream.ok) throw new Error(`Could not read inference (HTTP ${stream.status})`);
    const events = (await stream.text()).replace(/\r\n/g, "\n").split("\n\n");
    for (const event of events) {
      const kind = event.split("\n").find(line => line.startsWith("event:"))?.slice(6).trim();
      const raw = event.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
      if (kind === "error") throw new Error("Inference failed. Check session, quota and service availability.");
      if (kind === "complete") return JSON.parse(raw)[0];
    }
    throw new Error("Inference ended without a result. Check your saved jobs before resubmitting.");
  }

  tag(privateObjectPath: string, signal?: AbortSignal) { return this.call("tag", [privateObjectPath], signal); }
  chat(message: string, count: number | null = null, conversation_id: string | null = null, signal?: AbortSignal) {
    return this.call("chat", [JSON.stringify({ message, count, conversation_id })], signal);
  }
  photo(privatePersonPath: string, itemIds: string[], signal?: AbortSignal) {
    return this.call("photo", [privatePersonPath, JSON.stringify(itemIds)], signal);
  }
  /** Returns unconfirmed estimates; no profile write or try-on submission. */
  bodyAnalysis(privatePersonPath: string, knownHeightCm: number, signal?: AbortSignal) {
    if (!Number.isFinite(knownHeightCm) || knownHeightCm < 80 || knownHeightCm > 250) throw new Error('Enter your known height (80–250 cm)');
    return this.call('body_analysis', [privatePersonPath, knownHeightCm], signal);
  }
  confirmBodyAnalysis(reviewed: BodyAnalysis, signal?: AbortSignal) {
    if (reviewed.confirmed !== true) throw new Error('Review and confirm attributes before saving');
    return this.call('confirm_body_analysis', [JSON.stringify(reviewed)], signal);
  }
}
