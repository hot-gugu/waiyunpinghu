"""Loopback-only prototype editor; MD is canonical, generated artifacts share one save."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import json, os, re, threading, tempfile, html, io, zipfile, sys
from datetime import datetime
ROOT=Path(__file__).resolve().parent
START="<!-- PROTOTYPE_ANNOTATIONS_START -->"
END="<!-- PROTOTYPE_ANNOTATIONS_END -->"
PORT=8766
LOCK=threading.RLock()
def parse(text):
    raw=text.split(START,1)[1].split(END,1)[0].strip()
    rows=json.loads(raw.removeprefix("```json").removesuffix("```").strip())
    if not isinstance(rows,list): raise ValueError("records must be an array")
    ids=set()
    for n in rows:
        if not isinstance(n,dict) or not isinstance(n.get("id"),str) or n["id"] in ids: raise ValueError("invalid or duplicate id")
        ids.add(n["id"])
        if not all(isinstance(n.get(k,""),str) for k in ("page","context","title","body")): raise ValueError("invalid text field")
        if len(n.get("body",""))>5000 or len(n.get("title",""))>120: raise ValueError("annotation too long")
    return rows
def timestamp(value):
    try:return datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()
    except (ValueError, AttributeError):return 0

def merge(old, incoming):
    result={n["id"]:n for n in old}
    for n in incoming:
        o=result.get(n["id"])
        if o and (o.get("system") is False or o.get("deleted")) and n.get("system") is True: continue
        if not o or (n.get("system") is False and o.get("system") is True) or timestamp(n.get("updatedAt", ""))>=timestamp(o.get("updatedAt", "")): result[n["id"]]=n
    return list(result.values())
def render(rows, previous):
    e=lambda x:html.escape(str(x),quote=True)
    groups={}
    for n in rows:
        if not n.get("deleted") and not(n.get('system') is True and n['id'].startswith('layer-')):groups.setdefault(n["page"],[]).append(n)
    names={}
    for page in groups:
        file=ROOT/page
        title=re.search(r"<title>(.*?)</title>",file.read_text("utf-8"),re.S|re.I) if file.is_file() and file.parent==ROOT else None
        names[page]={'AI隐患核查.html':'AI报警中心','AI识别的违章复核.html':'AI报警复核','隐患违章管理-违章查处.html':'查处管理','方案图册.html':'监测一张图','index.html':'平台入口'}.get(page,title.group(1).split('·')[0].strip() if title else page.removesuffix('.html'))
    style="*{box-sizing:border-box}body{margin:0;background:#fafbfd;color:#24344d;font:400 14px/1.8 Microsoft YaHei,sans-serif}header,main{max-width:1180px;margin:auto;padding:24px;min-width:0}h1,h2{font-size:16px;font-weight:400;color:#172033}h3{font-size:15px;font-weight:400}h4{font-size:14px;font-weight:400;margin:0}nav{display:flex;flex-wrap:wrap;gap:12px}a{color:#0879ff;overflow-wrap:anywhere}section{background:linear-gradient(145deg,#fff,#f7fbff);border:1px solid rgba(190,211,238,.95);border-radius:8px;padding:24px;margin-bottom:24px}article{padding:16px 0;border-bottom:1px solid #e7eef8}p{margin:8px 0;overflow-wrap:anywhere;white-space:pre-wrap}img{max-width:100%;height:auto}.capture,small{font-size:12px;color:#8190a5}@media(max-width:640px){header,main{padding:12px}section{padding:16px}}"
    output=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>原型标注</title><style>'+style+'</style><body><header><h1>AI智能报警处置平台 · 原型标注</h1><p>由根目录原型标注.md同步生成，包含已保存的手工标注。页面截图独立保留，不因文字保存自动重拍。</p><nav>']
    for i,page in enumerate(groups):output.append(f'<a href="#page{i}">{e(names[page])}</a>')
    output.append('</nav></header><main>')
    for i,(page,items) in enumerate(groups.items()):
        # Preserve actual prior captures when present. Never substitute a diagram for a screenshot.
        match=re.search(r'<section[^>]*>\s*<h2>.*?</h2>\s*<a href="'+re.escape(page)+r'">.*?<h3>一、页面截图</h3>(.*?)<h3>二、功能说明</h3>',previous,re.S)
        capture=match.group(1) if match else '<p class="capture">尚无当前页面截图；保存标注只同步文字与定位数据。</p>'
        shot=ROOT/'assets'/'prototype-captures'/(page+'.png')
        if shot.is_file():capture='<img src="assets/prototype-captures/'+e(page)+'.png" alt="'+e(names[page])+'页面截图"><p class="capture">页面截图为实际预览快照；标注文字保存后即时同步，截图需重新拍摄刷新。</p>'
        output.append(f'<section id="page{i}"><h2>{e(names[page])}</h2><a href="{e(page)}">打开原型页面</a><h3>一、页面截图</h3>{capture}<h3>二、功能说明</h3>')
        for label,filtered in [('页面层',[n for n in items if n['context'].endswith('::page') or n['context'].endswith(':page')]),('临时层与状态页面',[n for n in items if not(n['context'].endswith('::page') or n['context'].endswith(':page'))])]:
            if not filtered:continue
            output.append('<h3>'+label+'</h3>')
            for n in filtered:
                output.append('<article><h4>'+e(n.get('title',''))+'</h4><p>'+e(n.get('body',''))+'</p>')
                if n.get('system') is False:output.append('<small>手工标注 · '+e(n.get('updatedAt',''))+'</small>')
                output.append('</article>')
        output.append('</section>')
    flows=re.search(r'<section id="flows">.*?</section>',previous,re.S)
    if flows:output.append(flows.group(0))
    return ''.join(output)+'</main></body></html>'
def save(incoming):
    with LOCK:
        target=ROOT/'原型标注.md';existing=target.read_text('utf-8');rows=merge(parse(existing),parse(incoming))
        block=START+'\n```json\n'+json.dumps(rows,ensure_ascii=False,indent=2)+'\n```\n'+END
        md=existing.split(START,1)[0]+block+existing.split(END,1)[1]
        page=ROOT/'原型标注.HTML';reading=render(rows,page.read_text('utf-8') if page.exists() else '')
        data=json.dumps(rows,ensure_ascii=False,indent=2)
        manual=json.dumps([n for n in rows if n.get('system') is False or n.get('deleted')],ensure_ascii=False,indent=2)
        payload={'原型标注.md':md.encode(),'原型标注.HTML':reading.encode(),'原型标注数据.js':('window.PROTOTYPE_ANNOTATIONS = '+data+';\n').encode(),'原型手工标记.json':manual.encode()}
        package=io.BytesIO()
        with zipfile.ZipFile(package,'w',zipfile.ZIP_DEFLATED) as z:
            for name,content in payload.items():z.writestr(name,content)
            for shot in (ROOT/'assets'/'prototype-captures').glob('*.png'):
                z.write(shot,shot.relative_to(ROOT).as_posix())
        payload['原型手工标记文件包.zip']=package.getvalue()
        staged={};before={name:(ROOT/name).read_bytes() if (ROOT/name).exists() else None for name in payload}
        committed=[]
        try:
            for name,content in payload.items():
                fd,tmp=tempfile.mkstemp(dir=ROOT,suffix='.tmp')
                with os.fdopen(fd,'wb') as f:f.write(content)
                staged[name]=tmp
            for name,tmp in staged.items():os.replace(tmp,ROOT/name);committed.append(name)
        except Exception:
            for name in reversed(committed):
                if before[name] is None:(ROOT/name).unlink(missing_ok=True)
                else:(ROOT/name).write_bytes(before[name])
            raise
        finally:
            for tmp in staged.values():Path(tmp).unlink(missing_ok=True)
SOURCE_NAMES=('原型标注.md','原型标注数据.js','原型手工标记.json')
source_signatures={}
def sync_sources():
    global source_signatures
    with LOCK:
        signatures={name:(ROOT/name).read_bytes() for name in SOURCE_NAMES if (ROOT/name).exists()}
        if signatures==source_signatures:return
        rows=[]
        for name in sorted(signatures,key=lambda name:(ROOT/name).stat().st_mtime_ns):
            text=signatures[name].decode('utf-8-sig')
            if name.endswith('.md'):incoming=parse(text)
            elif name.endswith('.js'):
                match=re.fullmatch(r'\s*window\.PROTOTYPE_ANNOTATIONS\s*=\s*(\[.*\])\s*;?\s*',text,re.S)
                if not match:raise ValueError('原型标注数据.js 必须为 JSON 数组赋值，不执行脚本')
                incoming=json.loads(match.group(1))
            else:incoming=json.loads(text)
            parse(START+'\n```json\n'+json.dumps(incoming,ensure_ascii=False)+'\n```\n'+END)
            rows=merge(rows,incoming)
        existing=(ROOT/'原型标注.md').read_text('utf-8-sig')
        save(existing.split(START,1)[0]+START+'\n```json\n'+json.dumps(rows,ensure_ascii=False)+'\n```\n'+END+existing.split(END,1)[1])
        source_signatures={name:(ROOT/name).read_bytes() for name in SOURCE_NAMES}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def valid_host(self):return self.headers.get('Host') in (f'127.0.0.1:{PORT}',f'localhost:{PORT}')
    def do_GET(self):
        if not self.valid_host():self.send_error(403);return
        try:sync_sources()
        except Exception as error:
            self.send_error(400,'Annotation sync failed: '+str(error));return
        if urlsplit(self.path).path=='/__prototype_annotations':
            with LOCK:text=(ROOT/'原型标注.md').read_text('utf-8')
            payload=json.dumps({'service':'sinotrans-prototype-annotations','text':text},ensure_ascii=False).encode()
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(payload)
        else:super().do_GET()
    def do_PUT(self):
        if self.path!='/__prototype_annotations':self.send_error(404);return
        if not self.valid_host() or self.headers.get('Origin') not in (None,f'http://127.0.0.1:{PORT}',f'http://localhost:{PORT}') or self.headers.get('X-Prototype-Write')!='1':self.send_error(403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=5000000:raise ValueError('invalid body size')
            save(self.rfile.read(size).decode('utf-8'))
            self.send_response(204);self.end_headers()
        except Exception as error:self.send_error(400,str(error))
if __name__=='__main__':
    sync_sources()
    if '--sync' in sys.argv:
        print('已同步原型标注 MD、JS、JSON、HTML 与文件包',flush=True)
        sys.exit(0)
    print(f'Prototype: http://127.0.0.1:{PORT}/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',PORT),Handler).serve_forever()
