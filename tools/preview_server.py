# -*- coding: utf-8 -*-
"""Локальный просмотр сайта так, как его увидит Vercel (cleanUrls).
Запуск:  python3 tools/preview_server.py [порт]   → http://localhost:8000 """
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def translate_path(self, path):
        p = super().translate_path(path)
        if os.path.exists(p) or os.path.splitext(p)[1]:
            return p
        for cand in (p + '.html', os.path.join(p, 'index.html')):
            if os.path.isfile(cand):
                return cand
        return p

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    srv = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print('Нейровася локально: http://localhost:%d  (корень: %s)' % (port, ROOT))
    srv.serve_forever()
