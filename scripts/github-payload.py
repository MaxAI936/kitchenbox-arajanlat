"""Emit source payloads for the connected GitHub tool, never credentials."""
from pathlib import Path
import json,subprocess,sys,base64
root=Path(__file__).resolve().parents[1]
paths=subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines()
if len(sys.argv)>1:
    target=root/sys.argv[1]
    assert sys.argv[1] in paths
    print(base64.b64encode(target.read_bytes()).decode())
else:
    binaries=[]; entries=[]
    for path in paths:
        if path.endswith(('.ttf','.pdf','.png','.jpg')):binaries.append(path)
        else:entries.append({'path':path,'mode':'100644','type':'blob','content':(root/path).read_text(encoding='utf-8')})
    print(json.dumps({'entries':entries,'binaries':binaries},ensure_ascii=True))
