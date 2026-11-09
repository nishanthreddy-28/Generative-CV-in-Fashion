import { useDraft } from "../hooks/useDraft";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  Screen,
  Gate,
  Notice,
  RouteLink,
  ResourceState,
  usePreview,
  ui,
} from "../components/Screen";
import { PhotoField, appendPhoto, type Photo } from "../components/PhotoField";
import { Button } from "../components/Button";
import { useResource } from "../hooks/useResource";
import { useSession } from "../features/session";
import { TryOnJobCard } from "../features/TryOnJobCard";
import { appendTryonFields, tryonJob } from "../features/tryonJobs";
import { createMutationGate } from "../features/savedRecommendationActions";
import type { Garment, Page, TryOnJob } from "../types/domain";
export default function TryOn() {
  const preview = usePreview();
  const params = useLocalSearchParams<{
    garmentId?: string;
    source?: string;
  }>();
  const { session, request } = useSession();
  const [cursor, setCursor] = useState("");
  const wardrobe = useResource<Page<Garment>>(
    `/wardrobe?limit=24${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    preview,
  );
  const catalog = useResource<Garment>(
    `/catalog/${encodeURIComponent(params.garmentId ?? "")}`,
    preview || params.source !== "catalog" || !params.garmentId,
  );
  const [person, setPerson] = useDraft<Photo | null>("try-on:photo", null);
  const [ignoreCatalog, setIgnoreCatalog] = useDraft(
    "try-on:ignoreCatalog",
    false,
  );
  const [choice, setSelected] = useDraft<{
    garment: Garment;
    source: "wardrobe" | "catalog";
  } | null>("try-on:garment", null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jobState,setJobState]=useState<{owner:string;job:TryOnJob}|null>(null);
  const job=jobState?.owner===session?.user.id ? jobState?.job : null;
  const setJob=(value:TryOnJob|null)=>setJobState(value && session ? {owner:session.user.id,job:value} : null);
  const gate=useRef(createMutationGate());
  const [historyCursor,setHistoryCursor]=useState("");
  const history=useResource<Page<TryOnJob>>(`/try-on/jobs?limit=24${historyCursor ? `&cursor=${encodeURIComponent(historyCursor)}` : ""}`,preview);
  const [message, setMessage] = useState("");
  const selected =
    choice ??
    (!ignoreCatalog && catalog.data
      ? { garment: catalog.data, source: "catalog" as const }
      : null);
  async function generate() { await gate.current.run(submit); }
  async function submit() {
    setMessage("");
    if (!person || !selected || !consent) {
      setMessage(
        "Choose your photo, select a garment, and confirm permission to use the photo.",
      );
      return;
    }
    if (preview) {
      setMessage(
        "Preview only. Photos have not been uploaded and no try-on has been generated.",
      );
      return;
    }
    if (!session) return;
    setBusy(true);
    setJob(null);
    try {
      const form = new FormData();
      appendPhoto(form, "person", person);
      appendTryonFields(form,selected.garment.id,selected.source,consent);
      const value = await request<TryOnJob>("/try-on/jobs", {
        method: "POST",
        body: form,
      });
      setJob(tryonJob(value));
      setPerson(null);setConsent(false);history.retry();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to start your try-on.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!job || !session) return;
    setBusy(true);
    setMessage("");
    try {
      setJob(
        tryonJob(await request<TryOnJob>(`/try-on/jobs/${encodeURIComponent(job.id)}`, {})),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to check progress.");
    } finally {
      setBusy(false);
    }
  }
  async function loadJob(id:string) {
    await gate.current.run(async()=>{
      setBusy(true);
      try {setJob(tryonJob(await request<TryOnJob>(`/try-on/jobs/${encodeURIComponent(id)}`)));history.retry();}
      catch(e){setMessage(e instanceof Error ? e.message : "Unable to refresh job.");}
      finally{setBusy(false);}
    });
  }
  async function cancel(id:string) {
    await gate.current.run(async()=>{
      if(preview)return;setBusy(true);
      try{setJob(tryonJob(await request<TryOnJob>(`/try-on/jobs/${encodeURIComponent(id)}/cancel`,{method:"POST"})));history.retry();setMessage("Queued job cancelled. Input-photo cleanup requested.");}
      catch(e){setMessage(e instanceof Error ? e.message : "Unable to cancel job.");}
      finally{setBusy(false);}
    });
  }
  return (
    <Screen
      title="See it your way."
      subtitle="Select a wardrobe or catalog piece and a photo of yourself."
    >
      <Gate preview={preview}>
        <Notice title="Inference worker unavailable" text="This submits a real queued job and a private photo. No worker is configured, so no try-on image will be generated. You can cancel queued jobs."/>
        <RouteLink to="/privacy">Photo privacy and retention</RouteLink>
        <PhotoField
          label="Your full-length photo"
          value={person}
          disabled={busy}
          onChange={(p) => {
            setPerson(p);
            setConsent(false);
            setJob(null);
          }}
        />
        <Text style={ui.heading}>Choose a garment</Text>
        <ResourceState {...wardrobe} />
        {params.source === "catalog" && <ResourceState {...catalog} />}
        {selected && (
          <Notice
            title="Selected piece"
            text={`${selected.garment.name} · ${selected.source}`}
          />
        )}
        <View style={ui.row}>
          {(wardrobe.data?.items ?? []).map((g) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`Try on ${g.name}`}
              accessibilityState={{
                checked:
                  selected?.garment.id === g.id &&
                  selected.source === "wardrobe",
              }}
              disabled={busy}
              key={g.id}
              style={[ui.chip, selected?.garment.id === g.id && ui.selected]}
              onPress={() => {
                setSelected({ garment: g, source: "wardrobe" });
                setJob(null);
              }}
            >
              <Text>{g.name}</Text>
            </Pressable>
          ))}
        </View>
        {!wardrobe.loading &&
          !wardrobe.error &&
          !wardrobe.data?.items.length &&
          !selected && (
            <Notice
              title="No garment selected"
              text="Add wardrobe pieces or choose an item from the catalog. Preview does not provide sample garments."
            />
          )}
        {Boolean(wardrobe.data?.nextCursor) && (
          <Button
            label="Next page of garments"
            variant="secondary"
            onPress={() => setCursor(wardrobe.data!.nextCursor!)}
            disabled={busy}
          />
        )}
        {Boolean(cursor) && (
          <Button
            label="First page"
            variant="secondary"
            onPress={() => setCursor("")}
            disabled={busy}
          />
        )}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          accessibilityLabel="Photo processing consent"
          disabled={busy}
          style={[ui.chip, consent && ui.selected]}
          onPress={() => setConsent((v) => !v)}
        >
          <Text style={ui.body}>
            {consent ? "☑" : "☐"} I have permission to use this photo and agree
            to submit it for this try-on.
          </Text>
        </Pressable>
        <Button label="Submit try-on job" onPress={generate} loading={busy} />
        {Boolean(message) && <Notice title="Try-on status" text={message} />}
        {job && <TryOnJobCard job={job} preview={preview} busy={busy} onRefresh={refresh} onCancel={()=>cancel(job.id)}/>}
        <Text style={ui.heading}>Job history</Text>
        <Button label="Refresh job history" variant="secondary" onPress={history.retry} disabled={busy || history.loading}/>
        <ResourceState {...history}/>
        {!history.loading && !history.error && !history.data?.items.length && <Notice title="No jobs on this page" text="Submitted jobs will appear here. No example jobs are supplied."/>}
        {(history.data?.items ?? []).map(item=><TryOnJobCard key={item.id} job={item} preview={preview} busy={busy}
          onRefresh={()=>loadJob(item.id)} onCancel={()=>cancel(item.id)}/>)}
        {history.data?.nextCursor && <Button label="Next page of jobs" variant="secondary" disabled={busy} onPress={()=>setHistoryCursor(history.data!.nextCursor!)}/>}
        {Boolean(historyCursor) && <Button label="First page of jobs" variant="secondary" disabled={busy} onPress={()=>setHistoryCursor("")}/>}
        <Button
          label="Clear try-on draft"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setPerson(null);
            setSelected(null);
            setIgnoreCatalog(true);
            setConsent(false);
            setJob(null);
            setMessage("");
          }}
        />
        <RouteLink to="/wardrobe/add" preview={preview}>
          Add a wardrobe piece →
        </RouteLink>
        <RouteLink to="/catalog" preview={preview}>
          Choose from catalog →
        </RouteLink>
      </Gate>
    </Screen>
  );
}
