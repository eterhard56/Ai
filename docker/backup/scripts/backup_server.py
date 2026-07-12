"""Simple HTTP server to trigger manual backups."""

import os
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer


class BackupHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/run":
            result = subprocess.run(["/scripts/backup.sh"], capture_output=True, text=True)
            self.send_response(200 if result.returncode == 0 else 500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{{"status": "ok", "output": "{result.stdout}"}}'.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status": "healthy"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    port = int(os.getenv("BACKUP_PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), BackupHandler)
    print(f"Backup server listening on :{port}")
    server.serve_forever()
