import type {TryOnJob} from "../types/domain.ts";
export function tryonJob(value:TryOnJob) {
  if(!value || !value.id || !['queued','processing','completed','failed'].includes(value.status) || value.workerAvailable!==false ||
     typeof value.workerMessage!=="string" || value.canCancel!==(value.status==='queued') ||
     value.inputUrl!==`/try-on/jobs/${value.id}/input` || typeof value.inputAvailable!=='boolean')throw new Error("Unexpected try-on job response.");
  return value;
}
export function appendTryonFields(form:FormData,garmentId:string,source:"wardrobe"|"catalog",consent:boolean) {
  if(!consent || !garmentId)throw new Error("Photo consent and a garment are required.");
  form.append('garmentId',garmentId);form.append('source',source);form.append('photoConsent','true');return form;
}

export function tryonForm(photo:Blob,garmentId:string,source:"wardrobe"|"catalog",consent:boolean) {
  const form=new FormData();form.append('person',photo,'person.jpg');
  return appendTryonFields(form,garmentId,source,consent);
}
