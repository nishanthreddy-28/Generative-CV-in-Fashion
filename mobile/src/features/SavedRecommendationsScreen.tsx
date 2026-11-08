import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { View } from "react-native";
import { Button } from "../components/Button";
import { Screen, Gate, Notice, ResourceState, RouteLink, ui, usePreview } from "../components/Screen";
import { useResource } from "../hooks/useResource";
import { useDraft } from "../hooks/useDraft";
import { useSession } from "./session";
import { RecommendationLooks } from "./RecommendationsScreen";
import { createMutationGate, removeSavedRecommendation, savedPage } from "./savedRecommendationActions";
import type { Page, SavedRecommendation } from "../types/domain";

export function SavedRecommendationsScreen() {
  const preview=usePreview();const {request,session}=useSession();
  const [cursor,setCursor]=useDraft("saved-recommendations:cursor","");
  const [,setSaved]=useDraft<Record<string,string|null>>("recommendations:saved-state",{});
  const [busy,setBusy]=useState("");const [message,setMessage]=useState("");const gate=useRef(createMutationGate());
  const result=useResource<Page<SavedRecommendation>>(`/recommendations/saved?limit=24${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,preview);
  const refresh=result.retry;
  useFocusEffect(useCallback(()=>{refresh();},[refresh]));
  let data:Page<SavedRecommendation>|null=null;let invalid="";
  try{if(result.data)data=savedPage(result.data);}catch(e){invalid=e instanceof Error ? e.message : "Invalid saved recommendations.";}
  async function remove(item:SavedRecommendation) {
    if(preview || !session)return;
    await gate.current.run(async()=>{
      setBusy(item.id);setMessage("");
      try {
        await removeSavedRecommendation(request,item.id);
        setSaved(current=>{const next={...current};next[item.recommendationId]=null;return next;});
        setMessage("Saved recommendation removed. Generated history is unchanged.");result.retry();
      }catch(e){setMessage(e instanceof Error ? e.message : "Unable to remove saved recommendation.");}
      finally{setBusy("");}
    });
  }
  return <Screen title="Your saved recommendations." subtitle="Keep useful combinations close.">
    <Gate preview={preview}>
      <Button label="Refresh saved recommendations" variant="secondary" disabled={Boolean(busy) || result.loading} onPress={refresh} />
      <ResourceState loading={result.loading} error={result.error || invalid} retry={result.retry} />
      {Boolean(message) && <Notice title="Saved recommendation status" text={message} />}
      {!result.loading && !result.error && !invalid && !data?.items.length && <Notice title="No saved recommendations on this page" text="Generate recommendations and save the combinations you like." />}
      {(data?.items ?? []).map(item=><View key={item.id} style={ui.card}>
        {item.available && item.recommendation ? <RecommendationLooks items={[item.recommendation]} preview={preview} /> :
          <Notice title="Recommendation unavailable" text="A garment was removed or is no longer available. You can remove this saved entry." />}
        <Button label="Remove saved recommendation" variant="secondary" disabled={Boolean(busy)} loading={busy===item.id} onPress={()=>remove(item)} />
      </View>)}
      {data?.nextCursor && <Button label="Next saved recommendations" variant="secondary" disabled={result.loading || Boolean(busy)} onPress={()=>setCursor(data!.nextCursor!)} />}
      {Boolean(cursor) && <Button label="Back to first page" variant="secondary" disabled={Boolean(busy)} onPress={()=>setCursor("")} />}
      <RouteLink to="/recommendations" preview={preview}>Generate recommendations →</RouteLink>
    </Gate>
  </Screen>;
}
