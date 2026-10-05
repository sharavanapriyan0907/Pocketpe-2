"""
PocketPe Local Prototype Server.
Runs a simple HTTP server with correct MIME types for ES modules (.js) and CSS,
and opens the default web browser.
"""

import http.server
import socketserver
import webbrowser
import threading
import time
import os
import sys

# Configure stdout and stderr for UTF-8 on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class PocketPeHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def guess_type(self, path):
        # Ensure correct MIME types for JS modules on Windows
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript; charset=utf-8'
        if path.endswith('.css'):
            return 'text/css; charset=utf-8'
        if path.endswith('.html'):
            return 'text/html; charset=utf-8'
        if path.endswith('.json'):
            return 'application/json; charset=utf-8'
        return super().guess_type(path)

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")
        sys.stdout.flush()

def open_browser(port):
    time.sleep(0.8)
    url = f"http://localhost:{port}"
    print(f">> Opening {url} in your default browser...")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Note: Could not open browser automatically ({e}). Please visit {url} manually.")

def run_server():
    port = PORT
    max_attempts = 10
    httpd = None

    for attempt in range(max_attempts):
        try:
            handler = PocketPeHTTPRequestHandler
            socketserver.ThreadingTCPServer.allow_reuse_address = True
            httpd = socketserver.ThreadingTCPServer(("", port), handler)
            break
        except OSError as e:
            if getattr(e, 'errno', None) in (48, 98, 10048) or 'already in use' in str(e).lower():
                print(f"Notice: Port {port} in use, trying port {port + 1}...")
                port += 1
            else:
                raise e

    if not httpd:
        print(f"Error: Could not find an open port starting from {PORT}.")
        sys.exit(1)

    print("=" * 60)
    print("  PocketPe 2 -- Local Development Server")
    print(f"  Serving directory: {DIRECTORY}")
    print(f"  URL: http://localhost:{port}")
    print("  Press Ctrl+C to stop the server")
    print("=" * 60)

    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
