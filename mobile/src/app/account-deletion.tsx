import {Screen,Notice,ResourceState} from "../components/Screen";
import {Button} from "../components/Button";
import {useResource} from "../hooks/useResource";
import {useSession} from "../features/session";
import {router} from "expo-router";
export default function DeletionProgress(){
 const {session,logout}=useSession();
 const result=useResource<{status:string;message?:string;retryable:boolean}>("/account/deletion",!session);
 return <Screen title="Account deletion">
  <Notice title="Deletion progress" text="Once your request is accepted, you can check its progress here while access to your account is paused."/>
  <ResourceState {...result}/>
  {result.data && <Notice title={result.data.status==='complete' ? "Deletion completed" : result.data.status==='deleting' ? "Cleanup pending or in progress" : "No deletion requested"}
    text={result.data.retryable ? "Cleanup hit a dependency failure and is queued for retry. Private data access remains denied." : result.data.message ?? "No deletion task was found for this account."}/>}
  {session && <Button label="Refresh deletion progress" variant="secondary" onPress={result.retry} disabled={result.loading}/>}
  <Button label="Sign out and return to introduction" onPress={()=>{void logout().finally(()=>router.replace("/"));}}/>
 </Screen>;
}
