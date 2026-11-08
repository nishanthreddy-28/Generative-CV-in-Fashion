import json
from uuid import uuid4
import httpx,pytest
from workers.deletion import DeletionWorker,CleanupError

@pytest.mark.asyncio
async def test_worker_fixed_manifest_storage_then_auth_and_completion():
 subject=str(uuid4());lease=str(uuid4());calls=[];manifests=0
 def receive(req):
  nonlocal manifests
  assert req.headers['apikey']=='sb_secret_test_worker' and 'authorization' not in req.headers
  calls.append(req.url.path)
  if req.url.path.endswith('claim_deletion'):return httpx.Response(200,json={'subject':subject,'lease':lease,'phase':'pending'})
  if req.url.path.endswith('deletion_manifest'):
   manifests+=1;return httpx.Response(200,json=[{'bucket':'tryon-inputs','object':subject+'/photo.jpg'}] if manifests==1 else [])
  if req.url.path.endswith('prepare_auth_deletion'):return httpx.Response(200,json=True)
  if req.url.path.endswith('finish_deletion'):assert json.loads(req.content)['p_success'];return httpx.Response(204)
  return httpx.Response(200,json={})
 worker=DeletionWorker('https://dev.supabase.co','sb_secret_test_worker','dev',httpx.MockTransport(receive))
 assert await worker.run_once()
 assert calls.index('/storage/v1/object/tryon-inputs')<calls.index('/auth/v1/admin/users/'+subject)<len(calls)-1

@pytest.mark.asyncio
async def test_worker_never_follows_redirect_or_unsafe_manifest_and_retries():
 subject=str(uuid4());lease=str(uuid4());calls=[]
 def receive(req):
  calls.append(req.url.path)
  if req.url.path.endswith('claim_deletion'):return httpx.Response(200,json={'subject':subject,'lease':lease})
  if req.url.path.endswith('deletion_manifest'):return httpx.Response(200,json=[{'bucket':'catalog-images','object':'other/photo.jpg'}])
  assert req.url.path.endswith('finish_deletion') and json.loads(req.content)['p_success'] is False
  return httpx.Response(204)
 worker=DeletionWorker('https://dev.supabase.co','sb_secret_test_worker','dev',httpx.MockTransport(receive))
 with pytest.raises(CleanupError):await worker.run_once()
 assert not any('/storage/' in path or '/admin/users/' in path for path in calls)

def test_worker_requires_explicit_matching_project_and_private_key():
 for url,key,ref in [('http://dev.supabase.co','sb_secret_test','dev'),('https://other.supabase.co','sb_secret_test','dev'),('https://dev.supabase.co','sb_publishable_test','dev')]:
  with pytest.raises(CleanupError):DeletionWorker(url,key,ref)
