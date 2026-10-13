# Local-only bridge for browser tests through the managed HTTPS proxy.
# It forwards only to the configured Supabase origin and keeps TLS verification.
import os,urllib.request,urllib.error
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
base=os.environ['VITE_SUPABASE_URL'].rstrip('/')
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def handle_request(self):
  if self.path=='/__health':
   self.send_response(200);self.end_headers();self.wfile.write(b'ok');return
  body=self.rfile.read(int(self.headers.get('Content-Length','0')))
  headers={k:v for k,v in self.headers.items() if k.lower() in ['apikey','authorization','content-type','prefer','x-client-info','accept','accept-profile','content-profile','cache-control','pragma']}
  req=urllib.request.Request(base+self.path,method=self.command,data=body if body else None,headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=25) as r: status=r.status;payload=r.read();response_headers=dict(r.headers)
  except urllib.error.HTTPError as e: status=e.code;payload=e.read();response_headers=dict(e.headers)
  except Exception: status=502;payload=b'{"message":"Relay failed"}';response_headers={'Content-Type':'application/json'}
  self.send_response(status)
  for k,v in response_headers.items():
   if k.lower() in ['content-type','content-range','preference-applied','cache-control','expires','etag','last-modified','vary','age']:self.send_header(k,v)
  self.end_headers();self.wfile.write(payload)
 do_GET=handle_request;do_POST=handle_request;do_PATCH=handle_request;do_DELETE=handle_request;do_OPTIONS=handle_request
ThreadingHTTPServer(('127.0.0.1',8770),Handler).serve_forever()
