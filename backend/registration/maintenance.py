"""Bounded challenge expiry. Separate process, requires exact-project approval and --execute."""
import argparse
import asyncio
import httpx
from .config import RegistrationSettings
from .adapters import TrustedGateway, Unavailable

async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--approved-project-ref',default='')
    args=parser.parse_args()
    if not args.execute:
        print('No cleanup performed. Exact-project approval and --execute are required.')
        return
    settings=RegistrationSettings()
    if not settings.enabled or args.approved_project_ref!=settings.project_ref:
        raise SystemExit('Registration cleanup requires a matching approved project.')
    try:
        async with httpx.AsyncClient(timeout=15,follow_redirects=False) as client:
            count=await TrustedGateway(settings,client).rpc('registration_expire',{})
            if not isinstance(count,int) or isinstance(count,bool) or not 0<=count<=100:
                raise Unavailable()
            print(f'Expired {count} pending challenges. No successful proof evidence removed.')
    except (Unavailable,httpx.HTTPError):
        raise SystemExit('Cleanup unavailable; durable state retained.') from None

if __name__=='__main__':asyncio.run(main())
