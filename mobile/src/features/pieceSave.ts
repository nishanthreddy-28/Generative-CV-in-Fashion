import type {RequestOptions} from "../services/api/client";
type Request=<T>(path:string,options:Omit<RequestOptions,"token">)=>Promise<T>;
export type SaveStage="review"|"create"|"metadata"|"cutout";
export class PieceSaveFailure extends Error{
 readonly stage:SaveStage;
 readonly savedId:string|null;
 readonly reason:unknown;
 constructor(stage:SaveStage,savedId:string|null,reason:unknown){
  super(reason instanceof Error?reason.message:"Your piece could not be saved.");
  this.stage=stage;this.savedId=savedId;this.reason=reason;
 }
}
export async function completePieceSave({request,savedId,values,preparation,createForm,onCreated}:{
 request:Request;savedId:string|null;values:Record<string,string>;
 preparation:{category:string;receipt:string}|null;createForm:()=>FormData;onCreated:(id:string)=>void;
}){
 let stage:SaveStage="review",id=savedId;
 try{
  if(!preparation||preparation.category!==values.category)throw new Error("Check the photo again to prepare a clean image for the selected category.");
  if(id){
   stage="metadata";
   await request(`/wardrobe/${encodeURIComponent(id)}`,{method:"PATCH",body:{name:values.name.trim(),category:values.category,color:values.color?.trim()??""}});
  }else{
   stage="create";
   const saved=await request<{id:string}>("/wardrobe",{method:"POST",body:createForm()});
   id=saved.id;onCreated(id);
  }
  stage="cutout";
  await request(`/ml/garments/${encodeURIComponent(id)}/prepared`,{method:"POST",body:{receipt:preparation.receipt,confirmed:true}});
  return id;
 }catch(reason){throw new PieceSaveFailure(stage,id,reason);}
}
