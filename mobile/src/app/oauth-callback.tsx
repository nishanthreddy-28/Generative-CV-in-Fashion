import {useState} from "react";
import {router,useLocalSearchParams} from "expo-router";
import {Button} from "../components/Button";
import {Screen,Notice,RouteLink} from "../components/Screen";
import {useSession} from "../features/session";
export default function OAuthCallback(){
 const {completeOAuth}=useSession();
 const {code,error,sb_flow_id}=useLocalSearchParams<{code?:string;error?:string;sb_flow_id?:string}>();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function complete(){
  if(busy || typeof code!=="string" || code.length>2048)return;setBusy(true);
  try{
   await completeOAuth(code, sb_flow_id);
   router.replace("/dashboard");
  }catch(e){setMessage(e instanceof Error ? e.message : "Unable to complete sign-in.");}
  finally{setBusy(false);}
 }
 return <Screen title="Complete sign-in">
  {error || typeof code !== "string" || !code || code.length > 2048 || typeof sb_flow_id !== "string" ? <Notice title={error === "access_denied" ? "Sign-in cancelled" : "Sign-in unavailable"} text="Return to sign-in and try again."/> : <Button label="Complete sign-in" loading={busy} onPress={complete}/>}
  {Boolean(message) && <Notice title="Sign-in status" text={message}/>}
  <RouteLink to="/login">Back to login</RouteLink>
 </Screen>;
}
