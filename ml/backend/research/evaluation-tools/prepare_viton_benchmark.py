"""Download a frozen pilot from the authors' public VITON-HD archive.

HTTP range reads avoid downloading the 4.87 GB training + test archive.
Only official test images, garments, garment masks and person parses are saved.
"""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import random
import re
import struct
import sys
import time
import zipfile
import zlib

import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "storage/benchmarks/viton-hd"
URL = "https://drive.usercontent.google.com/download?id=1tLx8LRp-sxDp0EcYmYoV_vXdSc-jJ79w&export=download&confirm=t"
SIZE = 4867271627
SEED = 20261122


def fetch(start, end):
    # Distinct public URLs prevent intermediaries caching a different byte range.
    url = URL + f"&benchmark_range={start}-{end}"
    for attempt in range(4):
        try:
            r = requests.get(url, headers={"Range": f"bytes={start}-{end}"}, timeout=90)
            r.raise_for_status()
            break
        except (requests.ConnectionError,requests.Timeout,requests.HTTPError):
            if attempt==3: raise
            time.sleep(2**attempt)
    expected = f"bytes {start}-{end}/{SIZE}"
    if r.status_code != 206 or r.headers.get("Content-Range") != expected:
        raise ValueError(f"Server did not honor byte range: {r.status_code}, {r.headers.get('Content-Range')}, wanted {expected}")
    if len(r.content) != end-start+1:
        raise ValueError("Truncated archive range")
    return r.content


class RemoteArchive(io.RawIOBase):
    def __init__(self):
        self.position=0

    def seekable(self): return True

    def seek(self, offset, whence=0):
        self.position = offset if whence==0 else self.position+offset if whence==1 else SIZE+offset
        return self.position

    def tell(self): return self.position

    def read(self, n=-1):
        if n<0: n=SIZE-self.position
        n=min(n,SIZE-self.position)
        if not n: return b''
        data=fetch(self.position,self.position+n-1)
        self.position+=n
        return data


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    manifest_path=OUT/'selection.json'
    if manifest_path.exists():
        selected=json.loads(manifest_path.read_text())
        print('Using frozen selection',len(selected['cases']),flush=True)
    else:
        print('Reading official archive directory',flush=True)
        with zipfile.ZipFile(RemoteArchive()) as archive:
            infos={i.filename:i for i in archive.infolist()}
        (OUT/'archive_names.json').write_text(json.dumps(list(infos),indent=2))
        names=sorted(n for n in infos if re.search(r'(^|/)test/image/[^/]+\.jpg$',n))
        if len(names)!=2032:
            raise ValueError(f'Expected 2032 official test people; found {len(names)}')
        chosen=sorted(random.Random(SEED).sample(names,100))
        cases=[]
        for name in chosen:
            prefix,filename=name.rsplit('/image/',1)
            cases.append({'id':Path(filename).stem,
                'image':name,'cloth':prefix+'/cloth/'+filename,
                'cloth-mask':prefix+'/cloth-mask/'+filename,
                'image-parse-v3':prefix+'/image-parse-v3/'+Path(filename).stem+'.png',
                'agnostic-v3.2':prefix+'/agnostic-v3.2/'+filename,
                'agnostic-mask':prefix+'/agnostic-mask/'+Path(filename).stem+'_mask.png'})
        required={n for c in cases for k,n in c.items() if k!='id'}
        missing=required-set(infos)
        if missing: raise ValueError(f'Missing archive members: {sorted(missing)[:5]}')
        members={n:{'offset':infos[n].header_offset,'compressed':infos[n].compress_size,
                    'size':infos[n].file_size,'crc':infos[n].CRC,'method':infos[n].compress_type} for n in required}
        selected={'seed':SEED,'official_test_size':len(names),'source':URL,'archive_size':SIZE,
                  'authors':'Choi et al. VITON-HD, CVPR 2021','license':'CC BY-NC 4.0; research pilot only',
                  'scope':'100 paired upper-body test examples; not lower-body evaluation',
                  'cases':cases,'members':members}
        manifest_path.write_text(json.dumps(selected,indent=2))
        (OUT/'selection.sha256').write_text(hashlib.sha256(manifest_path.read_bytes()).hexdigest()+'\n')
    assert hashlib.sha256(manifest_path.read_bytes()).hexdigest()==(OUT/'selection.sha256').read_text().strip()

    def download(pair):
        name,info=pair
        kind=Path(name).parent.name
        target=OUT/kind/Path(name).name
        target.parent.mkdir(exist_ok=True)
        if target.exists():
            data=target.read_bytes()
            if len(data)==info['size'] and zlib.crc32(data)==info['crc']:
                return str(target.relative_to(OUT)),hashlib.sha256(data).hexdigest()
        # Local ZIP header = 30 fixed bytes + filename + extra fields.
        head=fetch(info['offset'],info['offset']+29)
        values=struct.unpack('<IHHHHHIIIHH',head)
        assert values[0]==0x04034b50
        start=info['offset']+30+values[-2]+values[-1]
        compressed=fetch(start,start+info['compressed']-1)
        if info['method']==8: data=zlib.decompress(compressed,-15)
        elif info['method']==0: data=compressed
        else: raise ValueError('Unsupported archive compression')
        if len(data)!=info['size'] or zlib.crc32(data)!=info['crc']:
            raise ValueError('Archive CRC or size mismatch')
        temp=target.with_suffix('.tmp')
        temp.write_bytes(data)
        temp.replace(target)
        return str(target.relative_to(OUT)),hashlib.sha256(data).hexdigest()

    hashes={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for n,result in enumerate(pool.map(download,sorted(selected['members'].items())),1):
            hashes[result[0]]=result[1]
            if n%25==0: print(f'Verified {n}/{len(selected["members"])} files',flush=True)
    (OUT/'image_hashes.json').write_text(json.dumps(hashes,indent=2))
    print(f'Official VITON-HD pilot ready: 100 paired cases, {len(hashes)} verified files.',flush=True)


if __name__=='__main__': main()
