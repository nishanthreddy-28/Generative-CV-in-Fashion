"""Real MediaPipe inference in isolated fixtures; no application data writes."""
import argparse
import sys
import json
from pathlib import Path
import subprocess
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen
from websockets.sync.client import connect

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--image',type=Path,required=True)
args=parser.parse_args()
raw=args.image.read_bytes()
received=[]
validated=[]
HTML=b'''<!doctype html><input id="body-photo" type="file"><input id="body-height" value="170"><button id="body-analyze">Analyze</button><p id="body-status"></p><div id="body-confirm" hidden><fieldset id="body-attributes"></fieldset><p id="body-metadata"></p><button id="body-reset">Reset</button><input id="body-accept" type="checkbox"><button id="body-save">Save</button></div><button id="body-clear">Clear</button><form id="profile-form"><input name="height_cm"></form><input id="person-photo" type="file"><script type="module" src="/assets/body-analysis.js"></script>'''

HTML=HTML.replace(b'<button id="body-reset">',b'<button id="body-use-photo" disabled>Use photo</button><button id="body-reset">')

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,value,mime):
        self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(value)
    def do_GET(self):
        if self.path=='/':return self.send(HTML,'text/html')
        if self.path=='/person.png':return self.send(raw,'image/png')
        if self.path.startswith('/assets/'):
            path=(ROOT/'web/studio'/self.path.split('?')[0].removeprefix('/assets/')).resolve()
            if path.is_relative_to(ROOT/'web/studio') and path.is_file():return self.send(path.read_bytes(),'text/javascript')
        self.send_error(404)
    def do_PUT(self):
        value=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        sys.path.insert(0,str(ROOT))
        from app.pose.models import BodyAnalysis
        value=BodyAnalysis.model_validate(value).model_dump()
        received.append(value)
        return self.send(json.dumps({'height_cm':value['reference_height_cm'],'body_analysis':value}).encode(),'application/json')
    def do_POST(self):
        validated.append(self.path)
        # Validate the same fixture locally, without writing application data.
        self.rfile.read(int(self.headers['Content-Length']))
        import io
        sys.path.insert(0,str(ROOT))
        from PIL import Image
        from app.pose.validation import analyze_person
        return self.send(json.dumps(analyze_person(Image.open(io.BytesIO(raw)),170)).encode(),'application/json')

server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
directory=ROOT/'storage/pose-check'/uuid.uuid4().hex
directory.mkdir(parents=True)
chrome=subprocess.Popen([r'C:\Program Files\Google\Chrome\Application\chrome.exe','--headless=new','--no-first-run','--no-proxy-server','--remote-debugging-port=0',f'--user-data-dir={directory}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    active=directory/'DevToolsActivePort'
    for _ in range(100):
        if active.exists():break
        time.sleep(.1)
    port=active.read_text().splitlines()[0]
    target=json.load(urlopen(f'http://127.0.0.1:{port}/json/list'))[0]
    with connect(target['webSocketDebuggerUrl'],max_size=1000000) as ws:
        counter=0
        def call(method,**params):
            global counter
            counter+=1;ws.send(json.dumps({'id':counter,'method':method,'params':params}))
            while True:
                reply=json.loads(ws.recv(timeout=180))
                if reply.get('id')==counter:
                    assert 'error' not in reply,reply
                    return reply['result']
        def evaluate(code):
            result=call('Runtime.evaluate',expression=code,awaitPromise=True,returnByValue=True)
            assert 'exceptionDetails' not in result,result
            return result['result'].get('value')
        call('Page.navigate',url=f'http://127.0.0.1:{server.server_port}/')
        time.sleep(1)
        message=evaluate('''(async()=>{
          const blob=await(await fetch('/person.png')).blob();const files=new DataTransfer();files.items.add(new File([blob],'person.png',{type:'image/png'}));
          const tryonFiles=new DataTransfer();tryonFiles.items.add(new File([blob],'tryon-only.png',{type:'image/png'}));
          document.getElementById('person-photo').files=tryonFiles.files;document.getElementById('person-photo').dispatchEvent(new Event('change'));
          await new Promise(r=>setTimeout(r,300));
          if(document.getElementById('body-photo').files.length || document.getElementById('body-analyze').disabled) throw Error('Try-on upload changed body analysis');
          document.getElementById('body-photo').files=files.files;document.getElementById('body-photo').dispatchEvent(new Event('change'));
          for(let i=0;i<1500;i++){await new Promise(r=>setTimeout(r,100));if(!document.getElementById('body-analyze').disabled)break;}
          return {message:document.getElementById('body-status').textContent,ready:!document.getElementById('body-confirm').hidden};
        })()''')
        print(json.dumps(message),flush=True)
        assert message['ready'],message
        edited=evaluate("""(()=>{
          const input=document.getElementById('body-value-clothed_waist_front_width_cm');
          const original=Number(input.value); input.value=original+1; input.dispatchEvent(new Event('input'));
          if(document.getElementById('body-accept').checked)throw Error('Edit must require reconfirmation');
          document.getElementById('body-accept').checked=true;document.getElementById('body-save').click();
          return {original,corrected:original+1};
        })()""")
        for _ in range(100):
            if received:break
            time.sleep(.1)
        assert len(received)==1
        import sys
        sys.path.insert(0,str(ROOT))
        from app.pose.models import BodyAnalysis
        BodyAnalysis.model_validate(received[0])
        assert 'waist_cm' not in received[0]
        assert received[0]['clothed_waist_front_width_cm']==edited['corrected']
        assert received[0]['original_estimates']['clothed_waist_front_width_cm']==edited['original']
        assert received[0]['edited_fields']==['clothed_waist_front_width_cm']
        assert validated==['/phase3/body-analysis/estimate']
        evaluate('''(async()=>{
          for(let i=0;i<100 && document.getElementById('body-save').disabled;i++)await new Promise(r=>setTimeout(r,50));
          if(document.getElementById('person-photo').files[0].name!=='tryon-only.png')throw Error('Saving analysis overwrote try-on photo');
          document.getElementById('body-use-photo').click();
          if(document.getElementById('person-photo').files[0].name!=='person.png')throw Error('Explicit reuse did not select analyzed photo');
        })()''')
        (ROOT/'storage/pose-check/verification.json').write_text(json.dumps({'passed':True,'real_mediapipe_inference':True,'confirmed_save_payload_valid':True,'no_circumference_estimate':True,'editable_attributes_verified':True,'independent_uploads_verified':True,'explicit_photo_reuse_verified':True},indent=2))
        print('PASS: independent uploads, editable analysis, save without overwriting try-on, and explicit photo reuse.',flush=True)
finally:
    chrome.terminate();chrome.wait(timeout=10);server.shutdown()
