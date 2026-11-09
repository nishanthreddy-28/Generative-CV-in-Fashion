"""Local protocol tests. Test doubles never supply customer-facing production data."""
import hashlib
import json
from pathlib import Path
from uuid import uuid4
import httpx
import pytest
from fastapi.testclient import TestClient
from registration.config import RegistrationSettings
from registration.crypto import Proofs, digest, keyed
from registration.adapters import PasswordPolicy, TrustedGateway, Unavailable
from registration.main import create_registration_app


def settings(**overrides):
    values = dict(enabled=True,project_ref='test',supabase_url='https://test.supabase.co',
        secret_key='sb_secret_test',pepper='x'*32,web_origin='https://fashion.example',
        allowed_origins=['https://fashion.example'],smtp_host='smtp.example',smtp_username='test',
        smtp_password='test',sender='Wardrobe <test@example.invalid>',password_blocklist_file=Path('/not-read-in-injected-tests'),password_blocklist_sha256='a'*64)
    return RegistrationSettings(**(values|overrides))


class Gateway:
    def __init__(self):self.calls=[];self.records={};self.created=[];self.limited=False;self.duplicate=False;self.accept=True
    async def rpc(self, operation, body):
        self.calls.append((operation,body))
        if operation=='registration_rate':return not self.limited
        if operation=='registration_issue':
            if previous := body.get('p_previous'):
                record = self.records.get(previous)
                if not record or record.get('session') != body['p_session'] or record['state'] != 'pending':
                    return False
                record.update(state='superseded', session=None, link=None, otp=None)
            self.records[body['p_attempt']]={'email':body['p_email'],
                'otp':body['p_otp'],'link':body['p_link'],'state':'pending','session':body['p_session']};return True
        if operation=='registration_lookup':
            record = self.records.get(body['p_attempt'])
            return record if record and record['session'] == body['p_session'] else None
        if operation=='registration_prove':
            if not body['p_valid'] or not self.accept:
                return False
            record = self.records[body['p_attempt']]
            if body['p_kind']=='link':
                record['linkVerified']=True
            elif record.get('linkVerified'):
                record.update(state='finalizing',canFinalize=True)
            else:
                return False
            return True
        raise AssertionError(operation)

    async def create_user(self,email,password,attempt):
        if self.duplicate:
            return False
        self.created.append((email,attempt))
        self.records[str(attempt)]['state']='complete'
        return True


class Mail:
    def __init__(self):self.messages=[]
    async def send(self,email,link,code):self.messages.append((email,link,code))


class Policy:
    def accepts(self,password,email):return password=='X8!zL2@kV7#t'


def test_disabled_service_never_calls_dependencies():
    gateway=Gateway()
    with TestClient(create_registration_app(RegistrationSettings(),gateway=gateway)) as client:
        response=client.post('/auth/registration/start',json={})
        assert response.status_code==503 and not gateway.calls


def test_start_independent_proofs_and_no_password_in_rpc_or_response():
    gateway=Gateway();mail=Mail()
    with TestClient(create_registration_app(settings(),gateway=gateway,mailer=mail,policy=Policy())) as client:
        response=client.post('/auth/registration/start',json={'email':'Tester@example.invalid'})
        assert response.status_code==202
        result=response.json();assert set(result)=={'attemptId','capability','message'}
        retry=client.post('/auth/registration/start',json={'email':'tester@example.invalid'})
        assert retry.status_code==202 and retry.json()['attemptId']!=result['attemptId']
        assert len(mail.messages)==2 and not gateway.created
        _,url,code=mail.messages[0]
        assert '#' in url and len(code)==6 and code.isdigit() and result['capability'] not in url
        assert code not in json.dumps(gateway.calls) and 'X8!zL2@kV7#t' not in json.dumps(gateway.calls)
        assert response.headers['cache-control']=='no-store'


def test_link_and_code_wrong_capability_missing_binding_and_redaction():
    gateway=Gateway();mail=Mail()
    with TestClient(create_registration_app(settings(),gateway=gateway,mailer=mail,policy=Policy())) as client:
        p=Proofs();gateway.records[str(p.attempt)]={'email':'tester@example.invalid','otp':keyed(b'x'*32,'otp',str(p.attempt),'tester@example.invalid',p.otp),'link':digest(p.link),'session':digest(p.capability)}
        bound={'attemptId':str(p.attempt),'capability':p.capability}
        final=bound|{'password':'X8!zL2@kV7#t','confirmPassword':'X8!zL2@kV7#t'}
        assert client.post('/auth/registration/finalize',json=final).status_code==400
        assert client.post('/auth/registration/link',json=bound|{'link':p.link}).json()=={'status':'link_verified'}
        assert client.post('/auth/registration/verify',json=bound|{'code':'xxxxxx'}).status_code==400
        assert client.post('/auth/registration/verify',json=bound|{'code':p.otp}).json()=={'status':'finalizing'}
        assert not gateway.created
        gateway.duplicate=True
        assert client.post('/auth/registration/finalize',json=final).status_code==409
        assert not gateway.created
        gateway.duplicate=False
        assert client.post('/auth/registration/finalize',json=final).json()=={'status':'complete'}
        assert gateway.created
        response=client.post('/auth/registration/start',json={'email':'bad','password':'PRIVATE','confirmPassword':'PRIVATE'})
        assert response.status_code==422 and 'PRIVATE' not in response.text and 'bad' not in response.text
        assert client.post('/auth/registration/link',json={'attemptId':str(uuid4()),'capability':'a'*43,'link':'b'*43}).status_code==400
        assert client.get('/auth/registration/link').status_code==405


def test_limits_size_and_finalization_failure():
    gateway=Gateway();gateway.limited=True
    with TestClient(create_registration_app(settings(),gateway=gateway,mailer=Mail(),policy=Policy())) as client:
        body={'attemptId':str(uuid4()),'capability':'a'*43}
        assert client.post('/auth/registration/resend',json=body).status_code==429
        assert client.post('/auth/registration/start',content='a'*9000,headers={'Content-Type':'application/json'}).status_code==413
        assert client.post('/auth/registration/start',content='private').status_code==415


def test_password_corpus_fail_closed_and_policy_parity(tmp_path):
    path=tmp_path/'hashes';password='X8!zL2@kV7#t';data=(hashlib.sha256(password.encode()).hexdigest()+'\n').encode();path.write_bytes(data)
    policy=PasswordPolicy(path,hashlib.sha256(data).hexdigest())
    assert not policy.accepts(password,'tester@example.invalid')
    assert policy.accepts('Z9!vB3@rL5#s','tester@example.invalid')
    for bad in ('Password123!','XXxxxx123!','short','Tester73!'):
        assert not policy.accepts(bad,'tester@example.invalid')
    with pytest.raises(Unavailable):PasswordPolicy(path,'0'*64)


@pytest.mark.asyncio
async def test_trusted_adapter_redirect_and_subject_safety():
    calls=[]
    def receive(req):
        calls.append(req)
        assert req.headers['apikey']=='sb_secret_test' and 'authorization' not in req.headers
        return httpx.Response(302,headers={'location':'https://untrusted.example'})
    async with httpx.AsyncClient(transport=httpx.MockTransport(receive)) as client:
        gateway=TrustedGateway(settings(),client)
        with pytest.raises(Unavailable):await gateway.create_user('tester@example.invalid','not-logged',uuid4())
        assert len(calls)==1
        with pytest.raises(Unavailable):await gateway.rpc('read_profile',{})
        assert len(calls)==1


def test_secrets_do_not_appear_in_proof_repr():
    p=Proofs();assert p.otp not in repr(p) and p.link not in repr(p) and p.capability not in repr(p)


def test_completed_attempt_can_be_restored_without_reconfirming_auth():
    gateway = Gateway()
    proof = Proofs()
    gateway.records[str(proof.attempt)] = {
        'state': 'complete', 'link': None, 'otp': None, 'session': digest(proof.capability),
    }
    with TestClient(create_registration_app(settings(), gateway=gateway, policy=Policy())) as client:
        body = {'attemptId': str(proof.attempt), 'capability': proof.capability}
        assert client.post('/auth/registration/status', json=body).json() == {'status': 'complete'}
        assert client.post('/auth/registration/finalize', json=body|{'password':'ignored','confirmPassword':'ignored'}).json() == {'status': 'complete'}
    assert not gateway.created


def test_lost_resend_response_can_restore_only_the_bound_replacement():
    gateway, mail = Gateway(), Mail()
    with TestClient(create_registration_app(settings(), gateway=gateway, mailer=mail, policy=Policy())) as client:
        root = '/auth/registration/'
        start = client.post(root + 'start', json={'email': 'tester@example.invalid'}).json()
        old = {key: start[key] for key in ('attemptId', 'capability')}
        old_link = mail.messages[0][1].split('link=')[1]

        # The server commits and sends the email, but the client retains its old binding.
        assert client.post(root + 'resend', json=old).status_code == 202
        assert client.post(root + 'resend', json=old).status_code == 400
        restored = client.post(root + 'status', json=old).json()
        assert set(restored) == {'status', 'attemptId'} and restored['status'] == 'pending'
        assert restored['attemptId'] != old['attemptId'] and len(mail.messages) == 2
        assert client.post(root + 'status', json=old | {'capability': 'z' * 43}).status_code == 400
        assert client.post(root + 'link', json=old | {'link': old_link}).status_code == 400
        assert client.post(root + 'finalize', json=old | {'password':'ignored','confirmPassword':'ignored'}).status_code == 400

        current = old | {'attemptId': restored['attemptId']}
        _, url, code = mail.messages[-1]
        assert restored['attemptId'] in url
        assert client.post(root + 'link', json=current | {'link': url.split('link=')[1]}).json() == {'status':'link_verified'}
        assert client.post(root + 'verify', json=current | {'code':code}).json() == {'status':'finalizing'}
        assert client.post(root + 'status', json=old).json() == restored | {'status':'finalizing'}


@pytest.mark.asyncio
async def test_auth_create_sends_trusted_attempt_and_recognizes_only_duplicate_errors():
    attempt=uuid4()
    status, data = 422, {'error_code':'email_exists'}

    def receive(req):
        assert req.method=='POST' and req.url.path=='/auth/v1/admin/users'
        assert json.loads(req.content)=={
            'email':'tester@example.invalid', 'password':'not-logged', 'email_confirm':True,
            'app_metadata':{'dd_registration_attempt':str(attempt)},
        }
        return httpx.Response(status,json=data)

    async with httpx.AsyncClient(transport=httpx.MockTransport(receive)) as client:
        gateway=TrustedGateway(settings(),client)
        assert await gateway.create_user('tester@example.invalid','not-logged',attempt) is False
        data={'error_code':'unexpected_failure'}
        with pytest.raises(Unavailable):
            await gateway.create_user('tester@example.invalid','not-logged',attempt)
        status,data=200,{'email':'tester@example.invalid','email_confirmed_at':'confirmed','id':str(uuid4())}
        assert await gateway.create_user('tester@example.invalid','not-logged',attempt) is True
