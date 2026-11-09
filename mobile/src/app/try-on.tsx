import { useState } from "react";
import { Text } from "react-native";
import { Button } from "../components/Button";
import { Gate, Notice, ResourceState, RouteLink, Screen, ui } from "../components/Screen";
import { TryOnJobCard } from "../features/TryOnJobCard";
import { useSession } from "../features/session";
import { useResource } from "../hooks/useResource";
import type { Page, TryOnJob } from "../types/domain";

export default function TryOn() {
  const { request } = useSession();
  const [cursor, setCursor] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const history = useResource<Page<TryOnJob>>(
    `/try-on/jobs?limit=24${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    false,
  );

  async function cancel(id: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await request(`/try-on/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
      history.retry();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn’t cancel this request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Virtual try-on">
      <Gate preview={false}>
        <Notice title="Currently unavailable" text="New try-ons are unavailable. You can still view or cancel an earlier request." />
        <Text style={ui.heading}>Previous requests</Text>
        <ResourceState {...history} />
        {message && <Notice title="Couldn’t cancel request" text={message} tone="error" />}
        {history.data?.items.length === 0 && <Text style={ui.body}>You haven’t submitted any try-on requests.</Text>}
        {history.data?.items.map(job => <TryOnJobCard key={job.id} job={job} preview={false}
          busy={busy || history.loading} onRefresh={history.retry} onCancel={() => void cancel(job.id)} />)}
        {history.data?.nextCursor && <Button label="Next page" variant="secondary" onPress={() => setCursor(history.data!.nextCursor!)} />}
        {!!cursor && <Button label="First page" variant="secondary" onPress={() => setCursor("")} />}
        <RouteLink to="/wardrobe">Back to wardrobe</RouteLink>
      </Gate>
    </Screen>
  );
}
