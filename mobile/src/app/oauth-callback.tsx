import {useState} from "react";
import {router,useLocalSearchParams} from "expo-router";
import {Button} from "../components/Button";
import {Screen,Notice,RouteLink} from "../components/Screen";
import {requireAuth} from "../services/auth/supabase";
export default function OAuthCallback(){
 const {code,error}=useLocalSearchParams<{code?:string;error?:string}>();const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function complete(){
  if(busy || typeof code!=="string" || code.length>2048)return;setBusy(true);
  try{
   const {data,error:failure}=await requireAuth().exchangeCodeForSession(code);
   if(failure || !data.session)throw new Error("Sign-in link is invalid or expired. Start Google sign-in again.");
   router.replace("/dashboard");
  }catch(e){setMessage(e instanceof Error ? e.message : "Unable to complete sign-in.");}
  finally{setBusy(false);}
 }
 return <Screen title="Complete Google sign-in.">
  {error || !code ? <Notice title="Sign-in unavailable" text="Start sign-in again from the login screen."/> : <Button label="Complete sign-in" loading={busy} onPress={complete}/>}
  {Boolean(message) && <Notice title="Sign-in status" text={message}/>}
  <RouteLink to="/login">Back to login</RouteLink>
 </Screen>;
}
