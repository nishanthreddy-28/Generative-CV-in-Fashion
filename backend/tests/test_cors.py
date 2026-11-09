import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


def test_explicit_cors_origin_allows_auth_preflight_but_not_other_origins():
 settings=Settings(supabase_url='https://dev.supabase.co',supabase_publishable_key='sb_publishable_test',api_cors_origins=['http://localhost:8099'])
 with TestClient(create_app(settings)) as client:
  headers={'Origin':'http://localhost:8099','Access-Control-Request-Method':'PATCH','Access-Control-Request-Headers':'authorization,content-type'}
  response=client.options('/profile',headers=headers)
  assert response.status_code==200 and response.headers['access-control-allow-origin']==headers['Origin']
  assert 'access-control-allow-credentials' not in response.headers
  response=client.options('/profile',headers={**headers,'Origin':'https://evil.example'})
  assert response.status_code==400 and 'access-control-allow-origin' not in response.headers
  assert client.get('/profile',headers={'Origin':headers['Origin']}).status_code==401

@pytest.mark.parametrize('origin',['*','http://evil.example','https://user:password@example.com','https://example.com/path'])
def test_invalid_cors_config_rejected(origin):
 with pytest.raises(ValidationError):Settings(supabase_url='https://dev.supabase.co',supabase_publishable_key='sb_publishable_test',api_cors_origins=[origin])
