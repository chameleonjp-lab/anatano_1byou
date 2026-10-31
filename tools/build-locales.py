#!/usr/bin/env python3
"""Embed reviewed JSON catalogs into the existing single-file release."""
import argparse
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LANGUAGES=['ja','en','es','pt-BR','zh-Hans','fr','de','ko','ru','it','zh-Hant','id','tr','vi','th']
def catalogs():
    result={lang:json.loads((ROOT/'locales'/f'{lang}.json').read_text()) for lang in LANGUAGES}
    source=result['en']
    for lang,entries in result.items():
        if set(entries)!=set(source):raise ValueError(f'Incomplete catalog: {lang}')
        for key,text in entries.items():
            if not isinstance(text,str) or not text.strip():raise ValueError(f'Empty text: {lang}/{key}')
            if sorted(re.findall(r'\{\w+\}',text))!=sorted(re.findall(r'\{\w+\}',source[key])):raise ValueError(f'Placeholder mismatch: {lang}/{key}')
    return result
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    data=catalogs();path=ROOT/'index.html';html=path.read_text()
    pattern=r'(<script id="locale-catalogs" type="application/json">)([\s\S]*?)(</script>)'
    match=re.search(pattern,html)
    if not match:raise ValueError('Missing catalog release slot')
    if args.check:
        if json.loads(match[2])!=data:raise ValueError('Run python3 tools/build-locales.py to update shipped catalogs')
    else:
        payload=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
        html=html[:match.start(2)]+payload+html[match.end(2):];path.write_text(html)
    print(f'Validated {len(data)} catalogs, {len(data["en"])} strings each')
if __name__=='__main__':main()
