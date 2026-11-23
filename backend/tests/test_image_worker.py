import json
from uuid import uuid4
import httpx,pytest
from workers.images import ImageWorker,CleanupError

@pytest.mark.asyncio
async def test_image_cleanup_ack_only_after_success_and_retry_failure():
 ident=str(uuid4());subject=str(uuid4());calls=[]
 def receive(req):
  calls.append(req.url.path)
  assert 'authorization' not in req.headers
  if req.url.path.endswith('image_cleanup_manifest'):return httpx.Response(200,json=[{'id':ident,'bucket':'tryon-inputs','object':subject+'/'+ident+'.jpg'}])
  if '/storage/' in req.url.path:return httpx.Response(200,json={})
  assert json.loads(req.content)=={'p_bucket':'tryon-inputs','p_id':ident}
  return httpx.Response(200,json=True)
 worker=ImageWorker('https://dev.supabase.co','sb_secret_test','dev',httpx.MockTransport(receive))
 assert await worker.run_once()==1
 assert calls[-1].endswith('finish_image_cleanup')
 def fail(req):
  if req.url.path.endswith('image_cleanup_manifest'):return receive(req)
  assert '/storage/' in req.url.path
  return httpx.Response(503)
 worker.transport=httpx.MockTransport(fail)
 with pytest.raises(CleanupError):await worker.run_once()

@pytest.mark.asyncio
async def test_onboarding_body_image_cleanup_uses_owner_path_and_acknowledges():
 ident=str(uuid4());subject=str(uuid4());calls=[]
 def receive(req):
  calls.append(req.url.path)
  if req.url.path.endswith('image_cleanup_manifest'):
   return httpx.Response(200,json=[{'id':ident,'bucket':'onboarding-body-images','object':subject+'/'+ident+'.jpg'}])
  if '/storage/' in req.url.path:return httpx.Response(200,json={})
  return httpx.Response(200,json=True)
 worker=ImageWorker('https://dev.supabase.co','sb_secret_test','dev',httpx.MockTransport(receive))
 assert await worker.run_once()==1
 assert '/storage/v1/object/onboarding-body-images' in calls

@pytest.mark.asyncio
async def test_onboarding_worker_refuses_non_owner_object_path():
 ident=str(uuid4());calls=[]
 def receive(req):
  calls.append(req.url.path)
  return httpx.Response(200,json=[{'id':ident,'bucket':'onboarding-body-images','object':'../'+ident+'.jpg'}])
 worker=ImageWorker('https://dev.supabase.co','sb_secret_test','dev',httpx.MockTransport(receive))
 with pytest.raises(CleanupError):await worker.run_once()
 assert len(calls)==1

@pytest.mark.asyncio
async def test_image_cleanup_refuses_unsafe_paths_or_redirects():
 ident=str(uuid4())
 for response in [httpx.Response(302,headers={'location':'https://evil.example'}),httpx.Response(200,json=[{'id':ident,'bucket':'tryon-inputs','object':'../'+ident+'.jpg'}])]:
  calls=[]
  def receive(req):calls.append(req.url.path);return response
  worker=ImageWorker('https://dev.supabase.co','sb_secret_test','dev',httpx.MockTransport(receive))
  with pytest.raises(CleanupError):await worker.run_once()
  assert len(calls)==1
