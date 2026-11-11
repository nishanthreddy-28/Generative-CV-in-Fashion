import { Link, useFocusEffect } from "expo-router";
import { colors, typography } from "../theme/tokens";
import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { Gate, Notice, ResourceState, RouteLink, Screen, ui, usePreview } from "../components/Screen";
import { useDraft } from "../hooks/useDraft";
import { ApiError } from "../services/api/client";
import type { Outfit } from "../types/domain";
import { categories } from "./schema";
import { useSession } from "./session";
import { emptyOutfitFilters, loadOutfitPages, outfitQuery, type OutfitFilters } from "./outfitCollection";

export function OutfitCollectionScreen() {
  const preview=usePreview();const {session,request}=useSession();
  const [draft,setDraft]=useDraft<OutfitFilters>("outfit-list:filters",emptyOutfitFilters);
  const [applied,setApplied]=useDraft<OutfitFilters>("outfit-list:applied",emptyOutfitFilters);
  const [pages,setPages]=useDraft("outfit-list:page-count",1);
  const [cache,setCache]=useDraft<{key:string;items:Outfit[];nextCursor:string|null}|null>("outfit-list:cache",null);
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const [validation,setValidation]=useState("");
  const [filtersOpen,setFiltersOpen]=useState(false);
  const key=JSON.stringify(applied);const userId=session?.user.id;
  const visible=cache?.key===key ? cache : null;
  useFocusEffect(useCallback(()=>{
    if(preview || !userId)return;
    const controller=new AbortController();setLoading(true);setError("");
    void loadOutfitPages(request,applied,pages,controller.signal)
      .then(result=>{if(!controller.signal.aborted)setCache({key,...result});})
      .catch(e=>{
        if(!controller.signal.aborted) {
          if(e instanceof ApiError && (e.status===401 || e.status===403))setCache(null);
          setError(e instanceof Error ? e.message : "Unable to load outfits.");
        }
      })
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[applied,key,pages,preview,userId,request,setCache]));
  function apply(next:OutfitFilters) {
    try {outfitQuery(next);setApplied({...next,search:next.search.trim()});setPages(1);setValidation("");return true;}
    catch(e){setValidation(e instanceof Error ? e.message : "Invalid filters.");return false;}
  }
  const choice=(field:"source"|"category"|"sort",values:[string,string][]) => <View style={ui.row}>{values.map(([value,label])=>
    <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${field}: ${label}`} accessibilityState={{checked:draft[field]===value}}
      style={[ui.chip,draft[field]===value && ui.selected]} onPress={()=>setDraft(current=>({...current,[field]:value}))}>
      <Text style={ui.chipLabel}>{label}</Text>
    </Pressable>)}</View>;
  return <Screen title="Saved outfits" subtitle="Create, edit, and revisit your outfits.">
    <Gate preview={preview}>
      <Link href="/outfits/new" style={ui.primaryLink}>+ Create outfit</Link>
      <Text style={ui.label}>Search outfit names</Text>
      <TextInput accessibilityLabel="Search outfits" placeholderTextColor={colors.muted} placeholder="Search by outfit name" style={ui.input} value={draft.search} maxLength={200}
        onChangeText={search=>setDraft(current=>({...current,search}))} />
      <Button label={filtersOpen ? "Hide filters" : "Filter & sort"} variant="secondary" onPress={()=>setFiltersOpen(value=>!value)}/>
      {filtersOpen && <View style={ui.card}>
      <Text style={ui.label}>Item source</Text>
      {choice("source",[["","All sources"],["wardrobe","Wardrobe"],["catalog","Catalog"]])}
      <Text style={ui.label}>Item category</Text>
      {choice("category",[["","All categories"],...categories.map(value=>[value,value] as [string,string])])}
      <Text style={ui.body}>Source and category must match the same piece in an outfit.</Text>
      <Text style={ui.label}>Order</Text>
      {choice("sort",[["newest","Newest"],["name","Name A–Z"]])}
      <Text style={ui.label}>Created from · UTC date</Text>
      <TextInput accessibilityLabel="Created from" placeholderTextColor={colors.muted} placeholder="YYYY-MM-DD" style={ui.input} value={draft.from}
        onChangeText={from=>setDraft(current=>({...current,from}))} />
      <Text style={ui.label}>Created through · UTC date</Text>
      <TextInput accessibilityLabel="Created through" placeholderTextColor={colors.muted} placeholder="YYYY-MM-DD" style={ui.input} value={draft.through}
        onChangeText={through=>setDraft(current=>({...current,through}))} />
      </View>}
      <Button label="Apply search & filters" variant="secondary" onPress={()=>{if(apply(draft))setFiltersOpen(false);}} />
      {Boolean(applied.search || applied.source || applied.category || applied.from || applied.through || applied.sort!=="newest") && <Button label="Clear filters" variant="secondary" onPress={()=>{setDraft(emptyOutfitFilters);apply(emptyOutfitFilters);}} />}
      {Boolean(validation) && <Notice title="Check filters" text={validation} />}
      <ResourceState loading={loading} error={error} retry={()=>setApplied(current=>({...current}))} />
      {Boolean(error && visible) && <Text style={ui.body}>Previously loaded outfits remain visible. Retry to refresh them.</Text>}
      {!loading && !error && (!visible || !visible.items.length) && <Notice title="No matching outfits"
        text={preview ? "Preview contains no example outfits." : "Create an outfit or adjust the filters."} />}
      {(visible?.items ?? []).map(item=><View key={item.id} style={ui.card}>
        <Text style={typography.eyebrow}>{(item.occasion || "SAVED LOOK").toUpperCase()}</Text>
        <Text style={[typography.editorial,{fontSize:24,lineHeight:30}]}>{item.name}</Text>
        <Text style={ui.body}>{item.items?.length ?? item.garmentIds.length} pieces</Text>
        {Boolean(item.description) && <Text style={ui.body}>{item.description}</Text>}
        <RouteLink to={`/outfits/${encodeURIComponent(item.id)}`} preview={preview}>View and edit outfit →</RouteLink>
      </View>)}
      {visible?.nextCursor && <Button label="Load more outfits" variant="secondary" disabled={loading || Boolean(error)} onPress={()=>setPages(n=>n+1)} />}
      {visible && !visible.nextCursor && !loading && !error && visible.items.length>0 && <Text style={ui.body}>You’ve reached the end of your outfits.</Text>}
      {pages>1 && <Button label="Back to first page" variant="secondary" disabled={loading} onPress={()=>setPages(1)} />}
    </Gate>
  </Screen>;
}
