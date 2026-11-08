"""Trusted deletion worker. Never run against a hosted project without explicit approval.

Uses only the separately configured worker secret; no ordinary API fallback. No secrets/paths
are logged. Run from backend: .venv/bin/python -m workers.deletion --execute
"""
import argparse
import asyncio
import os
from uuid import UUID
from urllib.parse import urlparse
import httpx

class CleanupError(Exception):pass

class DeletionWorker:
    def __init__(self,url,secret,approved_ref,transport=None):
        parsed=urlparse(url)
        if parsed.scheme!='https' or parsed.username or parsed.password or parsed.path not in ('','/') or parsed.query or parsed.fragment:
            raise CleanupError('A fixed HTTPS project origin is required.')
        if parsed.hostname!=f'{approved_ref}.supabase.co' or not approved_ref or not secret.startswith('sb_secret_'):
            raise CleanupError('Explicit matching project approval and a private worker secret are required.')
        self.url=url.rstrip('/');self.secret=secret;self.transport=transport

    async def run_once(self):
        async with httpx.AsyncClient(transport=self.transport,timeout=20,follow_redirects=False,
            headers={'apikey':self.secret}) as client:
            async def rpc(name,body):
                response=await client.post(self.url+'/rest/v1/rpc/'+name,json=body,headers={'Content-Profile':'api'})
                if response.status_code not in (200,204):raise CleanupError('Cleanup dependency request failed.')
                try:return response.json() if response.status_code!=204 else None
                except ValueError:raise CleanupError('Invalid cleanup dependency response.') from None
            task=await rpc('claim_deletion',{})
            if task is None:return False
            try:
                subject=str(UUID(task['subject']));lease=str(UUID(task['lease']))
            except (ValueError,KeyError,TypeError):raise CleanupError('Invalid cleanup task.') from None
            args={'p_subject':subject,'p_lease':lease}
            try:
                for _ in range(10):
                    objects=await rpc('deletion_manifest',args)
                    if not isinstance(objects,list) or len(objects)>100:raise CleanupError('Invalid cleanup manifest.')
                    if not objects:break
                    groups={}
                    for item in objects:
                        bucket=item['bucket'];path=item['object']
                        if bucket not in ('wardrobe-images','tryon-inputs') or not isinstance(path,str) or not path.startswith(subject+'/') or '..' in path:
                            raise CleanupError('Invalid cleanup object boundary.')
                        groups.setdefault(bucket,[]).append(path)
                    for bucket,paths in groups.items():
                        response=await client.request('DELETE',self.url+'/storage/v1/object/'+bucket,json={'prefixes':paths})
                        if response.status_code not in (200,204):raise CleanupError('Storage cleanup failed.')
                if not await rpc('prepare_auth_deletion',args):raise CleanupError('Storage cleanup remains pending.')
                response=await client.request('DELETE',self.url+'/auth/v1/admin/users/'+subject,json={'should_soft_delete':False})
                if response.status_code not in (200,204,404):raise CleanupError('Auth deletion failed.')
                await rpc('finish_deletion',{**args,'p_success':True})
                return True
            except (CleanupError,httpx.HTTPError,ValueError,KeyError,TypeError):
                try:await rpc('finish_deletion',{**args,'p_success':False})
                except (CleanupError,httpx.HTTPError):pass
                raise CleanupError('Deletion remains denied and queued for safe retry.') from None

async def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if not args.execute:print('No actions executed. Explicit project approval and --execute are required.');return
    worker=DeletionWorker(os.environ.get('SUPABASE_URL',''),os.environ.get('DD_CLEANUP_SECRET_KEY',''),os.environ.get('DD_CLEANUP_APPROVED_PROJECT_REF',''))
    try:print('Processed one deletion task.' if await worker.run_once() else 'No eligible deletion task.')
    except (CleanupError,httpx.HTTPError):raise SystemExit('Cleanup failed safely; no credentials or object details logged.') from None
if __name__=='__main__':asyncio.run(main())
