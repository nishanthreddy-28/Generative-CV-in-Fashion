import json,time
from uuid import uuid4
import httpx,pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.security import Principal
from app.dependencies import verified_principal

@pytest.mark.parametrize('code,status',[('',202),('DD002',403),('42501',403)])
def test_deletion_request_never_uses_privileged_fallback(code,status):
 app=create_app(Settings(supabase_url='https://dev.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
 app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+300,'user-token')
 calls=[]
 def receive(req):
  calls.append(req);assert req.headers['authorization']=='Bearer user-token'
  return httpx.Response(400 if code=='DD002' else 403 if code else 200,json={'code':code} if code else {'status':'deleting','message':'Accepted'})
 with TestClient(app) as client:
  app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
  response=client.request('DELETE','/account',json={'confirmation':'DELETE'})
  assert response.status_code==status and len(calls)==1
  assert json.loads(calls[0].content)=={'p_confirmation':'DELETE'}
  client.portal.call(app.state.transport.aclose)

def test_deletion_flag_false_and_missing_auth_fail_closed():
 app=create_app(Settings(supabase_url='https://dev.supabase.co',supabase_publishable_key='sb_publishable_test'))
 with TestClient(app) as client:
  assert client.get('/account/deletion').status_code==401
  app.dependency_overrides[verified_principal]=lambda:Principal(uuid4(),int(time.time())+300,'user-token')
  assert client.request('DELETE','/account',json={'confirmation':'DELETE'}).status_code==503
