import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app

# This is used by Vercel as the serverless function handler
def handler(request, start_response):
    return app(request, start_response) 