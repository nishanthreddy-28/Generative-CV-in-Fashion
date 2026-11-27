import {hasSavedLook} from "../features/outfitGroups";
import {useStylistState,type Look,type Result} from "../features/StylistState";
import {ProcessingCard} from "../components/ProcessingCard";
import { useCallback,useEffect,useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable,StyleSheet,Text,TextInput,View } from "react-native";
import { useResource } from "../hooks/useResource";
import { useSession } from "../features/session";
import { Screen,Notice } from "../components/Screen";
import { Fields } from "../components/Fields";
import { Button } from "../components/Button";
import { colors } from "../theme/tokens";
import { OutfitItemSelector } from "../features/OutfitItemSelector";
import { WardrobeImage } from "../components/WardrobeImage";
export default function Stylist(){
  const {request}=useSession();
  const capabilities=useResource<{sessionStorageAvailable:boolean;workerConfigured:boolean}>("/ml/capabilities",false);
  const retryCapabilities=capabilities.retry;
  useFocusEffect(useCallback(()=>{retryCapabilities();},[retryCapabilities]));
  useEffect(()=>{
    if(capabilities.loading||(capabilities.data?.sessionStorageAvailable&&capabilities.data?.workerConfigured))return;
    const timer=setTimeout(retryCapabilities,15000);
    return()=>clearTimeout(timer);
  },[capabilities.loading,capabilities.data,retryCapabilities]);
  const {values,setValues,conversation,setConversation,current,setCurrent,history,setHistory,selected,setSelected,pending,setPending,busy,setBusy,error,setError,message,setMessage,savedLooks,setSavedLooks,controllerRef,requestLockRef}=useStylistState();
  const [countMenu,setCountMenu]=useState(false);
  const [requirements,setRequirements]=useState(false);
  const [library,setLibrary]=useState(false);
  const [details,setDetails]=useState<string|null>(null);
  const [savedOnly,setSavedOnly]=useState(false);
  const reload=useCallback(async()=>{
    try{
      if(!capabilities.data?.sessionStorageAvailable)return;
      const page=await request<{items:Result[]}>(`/ml/history?limit=20&bookmarked=${savedOnly}`);
      setHistory(page.items.filter(item=>item.kind==="stylist"));
    }catch(reason){setError(reason instanceof Error?reason.message:"History could not be loaded.");}
  },[request,savedOnly,capabilities.data,setError,setHistory]);
  useEffect(()=>{const timer=setTimeout(()=>{void reload();},0);return()=>clearTimeout(timer);},[reload]);
  async function send(override?:string){
    if(requestLockRef.current)return;
    const outgoing=override??values.message;
    if(!outgoing?.trim()){setError("Enter a message.");return;}
    const count=values.count.trim()?Number(values.count):null;
    if(count!==null&&(!Number.isInteger(count)||count<1||count>5)){setError("Choose 1–5 outfits, or leave count blank.");return;}
    if(selected.length>4){setError("Choose up to four required pieces.");return;}
    requestLockRef.current=true;
    setPending(outgoing.trim());setRequirements(false);setLibrary(false);setCountMenu(false);
    setBusy(true);setError("");setMessage("");controllerRef.current=new AbortController();
    try{
      const result=await request<Result>("/ml/stylist",{method:"POST",timeoutMs:330000,signal:controllerRef.current.signal,
        body:{message:outgoing.trim(),count,wardrobeOnly:values.pieces==="My wardrobe",conversationId:conversation,requiredItems:selected}});
      setConversation(result.conversationId);setCurrent(result);setPending("");setValues(current=>({...current,message:""}));await reload();
    }catch(reason){setError(reason instanceof Error?reason.message:"The stylist is unavailable.");}
    finally{setBusy(false);controllerRef.current=null;requestLockRef.current=false;}
  }
  async function update(result:Result,body:{bookmarked?:boolean;feedback?:"like"|"dislike"|""}){
    setBusy(true);setError("");
    try{await request(`/ml/history/${encodeURIComponent(result.id)}`,{method:"PATCH",body});setCurrent(current=>current?.id===result.id?{...current,...body,feedback:body.feedback===""?null:body.feedback??current.feedback}:current);await reload();}
    catch(reason){setError(reason instanceof Error?reason.message:"Could not save feedback.");}
    finally{setBusy(false);}
  }
  async function saveOutfit(look:Look){
    if(requestLockRef.current)return;
    requestLockRef.current=true;
    setBusy(true);setError("");setMessage("");
    try{
      if(await hasSavedLook(path=>request(path),look.items)){setSavedLooks(ids=>[...new Set([...ids,look.id])]);setMessage("This look is already in your saved outfits.");return;}
      await request("/outfits",{method:"POST",body:{name:look.items.slice(0,2).map(piece=>piece.name).join(" + ").slice(0,200),description:look.explanation.slice(0,2000),
        occasion:"",items:look.items.map(item=>({source:item.source,garmentId:item.garmentId}))}});
      setSavedLooks(ids=>[...new Set([...ids,look.id])]);
      setMessage("Outfit saved. You can edit its name and details in your outfits.");
    }catch(reason){setError(reason instanceof Error?reason.message:"Outfit could not be saved.");}
    finally{setBusy(false);requestLockRef.current=false;}
  }
  function show(result:Result){
    return <View key={result.id} style={s.turn}>
      {!!result.userMessage&&<View style={s.userBubble}><Text style={s.userText}>{result.userMessage}</Text></View>}
      <View style={s.assistant}><Text style={s.signature}>YOUR STYLIST</Text><Text selectable style={s.reply}>{result.message}</Text>
        {result.status==="unavailable"&&<Button label="Try this request again" variant="secondary" disabled={busy} onPress={()=>void send(result.userMessage)}/>}
        {result.outfits.map((look,index)=><View key={look.id} style={s.look}>
          <Text style={s.lookTitle}>Look {index+1}</Text>
          <View style={s.lookGrid}>{look.items.map(piece=><View key={piece.source+piece.garmentId} style={s.lookPiece}>
            <WardrobeImage id={piece.garmentId} source={piece.source} label={piece.name}/><Text style={s.pieceName}>{piece.name}</Text>
          </View>)}</View>
          <Text style={s.reply}>{look.explanation}</Text>
          {look.fitNotes.map((note,i)=><Text key={i} style={s.small}>{note}</Text>)}
          <Button label={savedLooks.includes(look.id)?"Saved to outfits":"Save this look"} variant="secondary" disabled={busy||savedLooks.includes(look.id)} onPress={()=>void saveOutfit(look)}/>
        </View>)}
        {result.status!=="unavailable"&&<View style={s.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Save stylist response" disabled={busy} onPress={()=>void update(result,{bookmarked:!result.bookmarked})}><Text style={s.actionText}>{result.bookmarked?"Saved ✓":"Save"}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Helpful response" disabled={busy} onPress={()=>void update(result,{feedback:"like"})}><Text style={s.actionText}>{result.feedback==="like"?"Helpful ✓":"Helpful"}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Not helpful response" disabled={busy} onPress={()=>void update(result,{feedback:"dislike"})}><Text style={s.actionText}>{result.feedback==="dislike"?"Not for me ✓":"Not for me"}</Text></Pressable>
          {result.warnings.length>0&&<Pressable accessibilityRole="button" accessibilityState={{expanded:details===result.id}} onPress={()=>setDetails(result.id===details?null:result.id)}><Text style={s.actionText}>Notes {details===result.id?"−":"+"}</Text></Pressable>}
        </View>}
        {details===result.id&&<View style={s.detailBox}>{result.warnings.map((warning,index)=><Text key={index} style={s.small}>{warning}</Text>)}</View>}
      </View>
    </View>;
  }
  const thread=[...history.filter(item=>item.conversationId===conversation&&item.id!==current?.id).reverse(),...(current&&current.conversationId===conversation?[current]:[])];
  const sending=busy&&!!pending;
  const unavailable=!capabilities.loading&&(!capabilities.data?.sessionStorageAvailable||!capabilities.data?.workerConfigured);
  const availabilityMessage=capabilities.loading?"Checking your stylist connection…":capabilities.error?"Unable to connect to your stylist":!capabilities.data?.sessionStorageAvailable?"Chat setup is pending":!capabilities.data?.workerConfigured?"Stylist connection is not configured":"Your stylist is unavailable";
  const sendDisabled=busy||!values.message.trim()||!capabilities.data?.sessionStorageAvailable||!capabilities.data?.workerConfigured;
  const conversations=history.filter((item,index,items)=>items.findIndex(other=>other.conversationId===item.conversationId)===index);
  function newChat(){
    setConversation(null);setCurrent(null);setPending("");setError("");setMessage("");setSelected([]);setLibrary(false);setRequirements(false);setDetails(null);
    setValues(current=>({...current,message:""}));
  }
  const headerActions=<View style={s.toolbar}>
    <Pressable accessibilityRole="button" accessibilityLabel="Conversation history" accessibilityState={{expanded:library}} disabled={busy} style={[s.headerButton,library&&s.headerButtonActive]} onPress={()=>{setLibrary(value=>!value);setRequirements(false);}}><Text style={s.headerIcon}>☰</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" disabled={busy} style={s.headerButton} onPress={newChat}><Text style={s.headerIcon}>＋</Text></Pressable>
  </View>;
  const composer=<View style={s.composerWrap}>
    <View style={s.composer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Number of outfit recommendations" accessibilityState={{expanded:countMenu,disabled:busy}} disabled={busy} onPress={()=>setCountMenu(value=>!value)} style={s.option}><Text style={s.optionText}>{values.count||"1"} {values.count==="1"?"look":"looks"} ▾</Text></Pressable>
      {countMenu&&<View style={s.countMenu}>{[1,2,3,4,5].map(count=><Pressable key={count} accessibilityRole="radio" accessibilityState={{checked:values.count===String(count)}} disabled={busy} onPress={()=>{setValues(current=>({...current,count:String(count)}));setCountMenu(false);}} style={s.option}><Text style={s.optionText}>{count} {count===1?"look":"looks"}{count===5?" · maximum":""}</Text></Pressable>)}</View>}
      <TextInput accessibilityLabel="Message your stylist" placeholder="Message your stylist…" placeholderTextColor={colors.muted} multiline maxLength={4000}
        editable={!busy} value={values.message} onChangeText={message=>setValues(current=>({...current,message}))} style={s.input}/>
      <View style={s.composerBottom}>
        <Pressable accessibilityRole="button" accessibilityLabel="Outfit preferences and selected garments" accessibilityState={{expanded:requirements}} disabled={busy} onPress={()=>{setRequirements(value=>!value);setLibrary(false);}} style={[s.option,requirements&&s.optionActive]}><Text style={s.optionText}>☷  Preferences{selected.length?` · ${selected.length}`:""}</Text></Pressable>
        <Text style={s.sourceLabel}>{values.pieces==="My wardrobe"?"My wardrobe":"Wardrobe + catalogue"}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={sending?"Request in progress":"Send message"} accessibilityState={{disabled:sendDisabled}} disabled={sendDisabled} onPress={()=>void send()} style={[s.send,sendDisabled&&s.disabled]}><Text style={s.sendText}>{sending?"…":"↑"}</Text></Pressable>
      </View>
    </View>{unavailable?<Pressable accessibilityRole="button" accessibilityLabel="Retry stylist availability" style={s.availability} onPress={capabilities.retry}><Text style={s.footer}>{availabilityMessage} · Retry ↻</Text></Pressable>:<Text style={s.footer}>Your style. Your final say.</Text>}
  </View>;
  return <Screen title="Your AI stylist" layout="conversation" action={headerActions} footer={composer} scrollResetKey={requirements?"preferences":library?"history":undefined} autoScroll={!!(thread.length||pending)&&!requirements&&!library}>
    {library&&<View style={s.detailBox}><View style={s.panelHeading}><Text style={s.panelTitle}>Your conversations</Text><Pressable accessibilityRole="button" accessibilityLabel="Close conversation history" style={s.closeButton} onPress={()=>setLibrary(false)}><Text style={s.closeText}>×</Text></Pressable></View>
      <Button label={savedOnly?"Show recent conversations":"Show saved responses"} variant="secondary" disabled={busy} onPress={()=>setSavedOnly(value=>!value)}/>
      {conversations.map(result=><Pressable key={result.id} style={s.historyItem} onPress={()=>{setConversation(result.conversationId);setCurrent(null);setLibrary(false);}}><Text style={s.pieceName} numberOfLines={1}>{result.userMessage||"Style conversation"}</Text><Text style={s.small} numberOfLines={2}>{result.message}</Text></Pressable>)}
      {!history.length&&<Text style={s.small}>Your conversations will appear here after your first message.</Text>}
    </View>}
    {requirements&&<View style={s.preferences}><View style={s.panelHeading}><Text style={s.panelTitle}>Style preferences</Text><Pressable accessibilityRole="button" accessibilityLabel="Close outfit preferences" style={s.closeButton} onPress={()=>setRequirements(false)}><Text style={s.closeText}>×</Text></Pressable></View><Text style={s.small}>Choose a few pieces to build around, or let your stylist explore.</Text>
      <Fields fields={[{key:"pieces",label:"Choose from",options:["My wardrobe","Wardrobe and catalogue"]}]} values={values} errors={{}} disabled={busy} onChange={(key,value)=>{setValues(current=>({...current,[key]:value}));if(key==="pieces"&&value==="My wardrobe")setSelected(items=>items.filter(item=>item.source==="wardrobe"));}}/>
      <OutfitItemSelector items={selected} onChange={items=>{setSelected(items);if(items.some(item=>item.source==="catalog"))setValues(current=>({...current,pieces:"Wardrobe and catalogue"}));}} preview={false} disabled={busy}/>
      <Text style={s.small}>Up to four selected pieces. These are requirements, not automatically saved outfits.</Text>
      <Button label="Done with preferences" variant="secondary" onPress={()=>setRequirements(false)}/>
    </View>}
    {!thread.length&&!pending&&!requirements&&!library&&<View style={s.empty}>
      <Text style={s.greeting}>What are we{"\n"}wearing today?</Text>
      <Text style={s.emptyText}>Fresh ideas for the clothes you love.</Text>
      <View style={s.prompts}>{[
        {title:"Keep it casual",description:"An easy, everyday outfit",message:"A relaxed everyday look"},
        {title:"Dress for a moment",description:"Dinner, work or something special",message:"Something for dinner"},
        {title:"Style a favourite",description:"Build a look around one piece",message:"Help me style a favourite piece"},
      ].map(prompt=><Pressable key={prompt.title} accessibilityRole="button" accessibilityLabel={prompt.title+". "+prompt.description} disabled={busy} style={s.prompt} onPress={()=>setValues(current=>({...current,message:prompt.message}))}>
        <View style={s.promptCopy}><Text style={s.promptTitle}>{prompt.title}</Text><Text style={s.promptText}>{prompt.description}</Text></View><Text style={s.promptArrow}>↗</Text>
      </Pressable>)}</View>
    </View>}
    {thread.map(show)}
    {!!current?.outfits.length&&!pending&&<Button label="Another outfit" variant="secondary" disabled={busy} onPress={()=>void send("Another outfit")}/>}
    {!!pending&&<View style={s.turn}><View style={s.userBubble}><Text style={s.userText}>{pending}</Text></View>{busy&&<View style={s.assistant}><ProcessingCard title="Crafting your look…" detail="Finding pieces that work together, with your style in mind." note="Your selected pieces stay at the heart of the look."/></View>}</View>}
    {!!error&&<Notice title="Let’s try that again" text={error} tone="error"/>}
    {!!message&&<Notice title="Saved" text={message} tone="success"/>}
  </Screen>;
}
const s=StyleSheet.create({
 countMenu:{borderWidth:1,borderColor:colors.border,borderRadius:14,padding:4,backgroundColor:colors.raised},
 toolbar:{flexDirection:"row",gap:4},headerButton:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center"},headerButtonActive:{backgroundColor:colors.selected},headerIcon:{fontSize:23,color:colors.ink},
 empty:{flex:1,justifyContent:"center",alignItems:"center",paddingVertical:12,gap:12},greeting:{fontFamily:"serif",fontSize:32,lineHeight:38,textAlign:"center",color:colors.ink},emptyText:{fontSize:14,lineHeight:22,color:colors.muted,textAlign:"center"},
 prompts:{gap:9,width:"100%",maxWidth:420,paddingTop:12},prompt:{borderWidth:1,borderColor:colors.border,paddingVertical:14,paddingHorizontal:17,borderRadius:16,backgroundColor:colors.surface,flexDirection:"row",alignItems:"center",gap:12},promptCopy:{flex:1,gap:4},promptTitle:{fontSize:14,fontWeight:"600",color:colors.ink},promptText:{fontSize:12,lineHeight:18,color:colors.muted},promptArrow:{fontSize:19,color:colors.sage},
 turn:{gap:22,paddingVertical:10},userBubble:{alignSelf:"flex-end",maxWidth:"88%",backgroundColor:colors.selected,paddingVertical:13,paddingHorizontal:17,borderRadius:20,borderBottomRightRadius:6},userText:{fontSize:15,lineHeight:23,color:colors.ink},assistant:{gap:15,paddingHorizontal:2},signature:{fontSize:10,letterSpacing:1.6,color:colors.sage,fontWeight:"700"},reply:{fontSize:15,lineHeight:25,color:colors.ink},thinking:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:10},
 look:{padding:16,gap:14,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},lookTitle:{fontFamily:"serif",fontSize:24,color:colors.ink},lookGrid:{flexDirection:"row",flexWrap:"wrap",gap:10},lookPiece:{width:"47%",gap:8},pieceName:{fontSize:13,lineHeight:19,color:colors.ink,fontWeight:"600"},
 actions:{flexDirection:"row",columnGap:18,rowGap:0,flexWrap:"wrap",borderTopWidth:1,borderColor:colors.border},actionText:{fontSize:12,color:colors.muted,paddingVertical:14,minHeight:44},detailBox:{backgroundColor:colors.raised,padding:18,borderRadius:20,gap:12},small:{fontSize:12,lineHeight:20,color:colors.muted},historyItem:{paddingVertical:14,borderBottomWidth:1,borderColor:colors.border,gap:6},
 panelHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},panelTitle:{fontSize:18,fontWeight:"600",color:colors.ink,flexShrink:1},closeButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},closeText:{fontSize:26,color:colors.muted},preferences:{padding:18,borderWidth:1,borderColor:colors.border,borderRadius:20,backgroundColor:colors.surface,gap:16},
 composerWrap:{width:"100%",maxWidth:660,alignSelf:"center",paddingHorizontal:18,paddingTop:10,paddingBottom:8,backgroundColor:colors.background,gap:7},composer:{borderWidth:1,borderColor:colors.border,borderRadius:24,padding:12,backgroundColor:colors.surface},input:{minHeight:48,maxHeight:130,fontSize:16,lineHeight:24,color:colors.ink,paddingHorizontal:5,paddingTop:5,textAlignVertical:"top"},composerBottom:{flexDirection:"row",alignItems:"center",gap:8},option:{paddingVertical:12,paddingHorizontal:10,borderRadius:18,minHeight:44},optionActive:{backgroundColor:colors.selected},optionText:{fontSize:12,color:colors.ink},sourceLabel:{flex:1,fontSize:10,color:colors.muted,textAlign:"right"},send:{width:44,height:44,borderRadius:22,backgroundColor:colors.ink,alignItems:"center",justifyContent:"center",marginLeft:4},sendText:{fontSize:25,color:"#fff"},disabled:{opacity:.3},footer:{fontSize:10,color:colors.muted,textAlign:"center",lineHeight:15},availability:{minHeight:36,justifyContent:"center",alignItems:"center",paddingVertical:8}
});
