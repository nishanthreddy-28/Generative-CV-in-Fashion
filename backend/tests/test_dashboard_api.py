import time
from uuid import uuid4
import httpx
from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings
from app.dependencies import verified_principal
from app.security import Principal

def test_dashboard_actual_counts_contract_and_auth():
 app=create_app(Settings(supabase_url='https://dev.supabase.co',supabase_publishable_key='sb_publishable_test',database_foundation_enabled=True))
 principal=Principal(uuid4(),int(time.time())+300,'dashboard-token')
 counts=dict(wardrobeCount=3,savedOutfitCount=2,recommendationCount=4,savedRecommendationCount=1,tryOnJobCount=5)
 def receive(req):
  assert req.headers['authorization']=='Bearer dashboard-token'
  return httpx.Response(200,json={'userId':str(principal.user_id),'active':True} if req.url.path.endswith('account_access') else counts)
 with TestClient(app) as client:
  assert client.get('/dashboard').status_code==401
  app.dependency_overrides[verified_principal]=lambda:principal
  app.state.transport=httpx.AsyncClient(transport=httpx.MockTransport(receive))
  assert client.get('/dashboard').json()==counts
  client.portal.call(app.state.transport.aclose)
