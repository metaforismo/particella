"""Read-only research captures. Serial within each invocation; keep rate <= 1/sec."""
import urllib.request, urllib.parse, json, hashlib, datetime, time, sys
from pathlib import Path
root=Path('docs/backend/verification/session-d'); root.mkdir(parents=True,exist_ok=True)
def capture(name,url):
 start=time.monotonic(); record={'name':name,'url':url,'executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Particella/0.1 (+https://github.com/metaforismo/particella)'}), timeout=25) as r:
   data=r.read(12000000); record.update(status=r.status,contentType=r.headers.get('Content-Type'),bytes=len(data),sha256=hashlib.sha256(data).hexdigest()); (root/(name+'.body')).write_bytes(data)
 except Exception as e: record['error']=str(e)
 record['durationMs']=round((time.monotonic()-start)*1000); (root/(name+'.meta.json')).write_text(json.dumps(record,indent=2)+'\n'); print(json.dumps(record),flush=True); time.sleep(1)
def wms(base,layer,lat,lon,fmt='text/plain',v='1.1.1'):
 p=dict(service='WMS',version=v,request='GetFeatureInfo',layers=layer,query_layers=layer,info_format=fmt,width=101,height=101,feature_count=100,format='image/png',styles='')
 if v=='1.3.0': p.update(crs='EPSG:4326',bbox=f'{lat-.001},{lon-.001},{lat+.001},{lon+.001}',i=50,j=50)
 else: p.update(srs='EPSG:4326',bbox=f'{lon-.001},{lat-.001},{lon+.001},{lat+.001}',x=50,y=50)
 return base+ ('&' if '?' in base else '?')+urllib.parse.urlencode(p)
if __name__=='__main__':
 capture(sys.argv[1],sys.argv[2])
