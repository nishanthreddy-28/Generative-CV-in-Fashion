"""Separate trusted image reconciler. No remote execution without project approval."""
import argparse
import asyncio
import os
from uuid import UUID
import httpx
from .deletion import DeletionWorker, CleanupError

class ImageWorker(DeletionWorker):
    async def run_once(self):
        async with httpx.AsyncClient(transport=self.transport,timeout=20,follow_redirects=False,
                headers={'apikey':self.secret}) as client:
            async def rpc(name,body):
                response=await client.post(self.url+'/rest/v1/rpc/'+name,json=body,headers={'Content-Profile':'api'})
                if response.status_code!=200:raise CleanupError('Image cleanup dependency failed.')
                try:return response.json()
                except ValueError:raise CleanupError('Invalid cleanup response.') from None
            items=await rpc('image_cleanup_manifest',{})
            if not isinstance(items,list) or len(items)>100:raise CleanupError('Invalid cleanup manifest.')
            completed=0
            for item in items:
                try:
                    ident=str(UUID(item['id']));bucket=item['bucket'];path=item['object']
                    parts=path.split('/')
                    valid=(len(parts)==2 and parts[1]==ident+'.jpg' and
                           ((bucket=='catalog-images' and parts[0]=='catalog') or
                            (bucket in ('wardrobe-images','tryon-inputs') and str(UUID(parts[0]))==parts[0])))
                    if not valid:raise CleanupError('Invalid cleanup boundary.')
                    response=await client.request('DELETE',self.url+'/storage/v1/object/'+bucket,json={'prefixes':[path]})
                    if response.status_code not in (200,204):continue  # Durable pending state; retry next run.
                    if await rpc('finish_image_cleanup',{'p_bucket':bucket,'p_id':ident}) is True:completed+=1
                except (ValueError,KeyError,TypeError,AttributeError):raise CleanupError('Invalid cleanup object.') from None
            return completed

async def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if not args.execute:print('No actions executed. Explicit project approval and --execute are required.');return
    worker=ImageWorker(os.environ.get('SUPABASE_URL',''),os.environ.get('DD_CLEANUP_SECRET_KEY',''),os.environ.get('DD_CLEANUP_APPROVED_PROJECT_REF',''))
    try:print(f'Cleaned {await worker.run_once()} eligible images.')
    except (CleanupError,httpx.HTTPError):raise SystemExit('Cleanup failed safely; pending metadata retained.') from None
if __name__=='__main__':asyncio.run(main())
