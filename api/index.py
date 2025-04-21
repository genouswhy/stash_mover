from http.server import BaseHTTPRequestHandler
import sys, os
import json

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Flask app
from app import app

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        
        message = "Flask API server. Use appropriate API endpoints."
        self.wfile.write(message.encode())
        
        return

def handler(event, context):
    # Render and return the Flask app as a serverless function
    # This is just a placeholder that redirects to the Flask app
    return {
        "statusCode": 302,
        "headers": {
            "Location": "/"
        }
    } 