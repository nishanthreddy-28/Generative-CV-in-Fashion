import {useState} from "react";
import {router,useLocalSearchParams} from "expo-router";
import {Button} from "../components/Button";
import {Screen,Notice,RouteLink} from "../components/Screen";
import {useSession} from "../features/session";
import {oauthCallbackIssue} from "../services/auth/contracts";
export default function OAuthCallback(){
 const {completeOAuth,request}=useSession();
 const {code,error,error_code,sb_flow_id}=useLocalSearchParams<{code?:string;error?:string;error_code?:string;sb_flow_id?:string}>();
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 const issue=oauthCallbackIssue(code,sb_flow_id,error,error_code);
 async function complete(){
  if(busy || issue || typeof code!=="string")return;setBusy(true);
  try{
   await completeOAuth(code, sb_flow_id);
   const onboarding=await request<{reviewed:{id:string}|null}>("/onboarding");
   router.replace(onboarding.reviewed ? "/dashboard" : "/profile/onboarding");
  }catch(e){setMessage(e instanceof Error ? e.message : "Unable to complete sign-in.");}
  finally{setBusy(false);}
 }
 return <Screen title="Complete sign-in">
  {issue ? <Notice title={issue} text="Return to sign-in and try again."/> : <Button label="Complete sign-in" loading={busy} onPress={complete}/>}
  {Boolean(message) && <Notice title="Sign-in status" text={message}/>}
  <RouteLink to="/login">Back to login</RouteLink>
 </Screen>;
}
