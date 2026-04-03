#!/usr/bin/env python3
"""
测试有道词典 suggest 接口（与 API.md 一致）。

用法:
  python scripts/test_youdao_suggest.py
  python scripts/test_youdao_suggest.py -q hello -n 3
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

# API.md: http://dict.youdao.com/suggest?q=love&num=1&doctype=json
BASE_URL = "http://dict.youdao.com/suggest"
USER_AGENT = "english-read-api-test/1.0"


def fetch_suggest(q: str, num: int, doctype: str = "json") -> dict:
    params = urllib.parse.urlencode({"q": q, "num": str(num), "doctype": doctype})
    url = f"{BASE_URL}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    return json.loads(body)


def assert_shape(data: dict) -> list[str]:
    errors: list[str] = []
    if "result" not in data:
        errors.append("缺少顶层字段 result")
    else:
        r = data["result"]
        if r.get("code") != 200:
            errors.append(f"result.code 期望 200，实际 {r.get('code')!r}")
        if r.get("msg") != "success":
            errors.append(f"result.msg 期望 'success'，实际 {r.get('msg')!r}")
    if "data" not in data:
        errors.append("缺少顶层字段 data")
    else:
        d = data["data"]
        for key in ("query", "language", "type", "entries"):
            if key not in d:
                errors.append(f"data 缺少字段 {key!r}")
        if "entries" in d and isinstance(d["entries"], list):
            for i, e in enumerate(d["entries"]):
                if not isinstance(e, dict):
                    errors.append(f"entries[{i}] 不是对象")
                    continue
                if "entry" not in e:
                    errors.append(f"entries[{i}] 缺少 entry")
                if "explain" not in e:
                    errors.append(f"entries[{i}] 缺少 explain")
    return errors


def main() -> int:
    p = argparse.ArgumentParser(description="测试有道 suggest 接口 (API.md)")
    p.add_argument("-q", "--query", default="love", help="关键字 q")
    p.add_argument("-n", "--num", type=int, default=1, help="返回条数 num")
    p.add_argument("--doctype", default="json", help="返回格式，json 与文档一致")
    p.add_argument("--raw", action="store_true", help="只打印原始 JSON，不做结构校验")
    args = p.parse_args()

    try:
        data = fetch_suggest(args.query, args.num, args.doctype)
    except urllib.error.HTTPError as e:
        print(f"HTTP 错误: {e.code} {e.reason}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"请求失败: {e.reason}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"JSON 解析失败: {e}", file=sys.stderr)
        return 1

    if args.raw:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0

    print(json.dumps(data, ensure_ascii=False, indent=2))
    errs = assert_shape(data)
    if errs:
        print("\n结构校验未通过:", file=sys.stderr)
        for line in errs:
            print(f"  - {line}", file=sys.stderr)
        return 1
    print("\n结构校验通过（含 result / data.entries 等 API.md 所述字段）。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
