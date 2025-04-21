from flask import Flask, render_template, request, jsonify
import requests
import json
import re

app = Flask(__name__)

# Game API endpoint
API_URL = "https://api.zee-verse.com"
METADATA_URL = "https://metadata.zee-verse.com/items"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/get_items', methods=['POST'])
def get_items():
    try:
        # Check for JSON data
        content_type = request.headers.get('Content-Type', '')
        if 'application/json' not in content_type:
            return jsonify({"error": "JSON data with Content-Type: application/json is required"}), 400
            
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "Invalid JSON data"}), 400
            
        token = data.get('token')
        if not token:
            return jsonify({"error": "Authorization token is required"}), 400
        
        headers = {
            "X-PLATFORM": "WebGLPlayer",
            "Authorization": f"Bearer {token}",
            "sec-ch-ua-platform": "\"Windows\"",
            "Referer": "https://play.zee-verse.com/",
            "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
            "sec-ch-ua-mobile": "?0",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
            "content-type": "application/json"
        }
        
        response = requests.get(f"{API_URL}/account/assets", headers=headers)
        response.raise_for_status()
        data = response.json()
        
        # 筛选规则:
        # 1. 保留ID长度为9的物品（如100620000）
        # 2. 保留ID以210开头的物品（如2103020001）
        # 3. 过滤掉表情类物品（物品ID包含820或'Emote'）
        
        def filter_item(item):
            item_id = str(item.get('itemId', ''))
            
            # 检查是否为表情类物品 (ID包含"820" 例如100820000、100820001)
            if "820" in item_id:
                return False
                
            # 保留ID长度为9的物品 (如100620000)
            if len(item_id) == 9:
                return True
                
            # 保留以210开头的物品 (如2103020001)
            if item_id.startswith('210'):
                return True
                
            return False
        
        filtered_inventory = [item for item in data.get('inventory', []) if filter_item(item)]
        filtered_stash = [item for item in data.get('stash', []) if filter_item(item)]
        
        result = {
            "inventory": filtered_inventory,
            "stash": filtered_stash
        }
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_item_details/<item_id>', methods=['GET'])
def get_item_details(item_id):
    try:
        response = requests.get(f"{METADATA_URL}/{item_id}")
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({"error": "Item not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/move_item', methods=['POST'])
def move_item():
    try:
        # Check for JSON data
        content_type = request.headers.get('Content-Type', '')
        if 'application/json' not in content_type:
            return jsonify({"error": "JSON data with Content-Type: application/json is required"}), 400
            
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "Invalid JSON data"}), 400
            
        token = data.get('token')
        item_id = data.get('id')
        amount = data.get('amount')
        slot = data.get('slot')
        
        if not all([token, item_id, amount]):
            return jsonify({"error": "Missing required parameters"}), 400
        
        headers = {
            "X-PLATFORM": "WebGLPlayer",
            "Authorization": f"Bearer {token}",
            "sec-ch-ua-platform": "\"Windows\"",
            "Referer": "https://play.zee-verse.com/",
            "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
            "sec-ch-ua-mobile": "?0",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
            "content-type": "application/json"
        }
        
        payload = {
            "items": [
                {
                    "id": item_id,
                    "amount": amount,
                    "slot": slot
                }
            ]
        }
        
        response = requests.post(f"{API_URL}/account/inventory/move", headers=headers, json=payload)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Exposing the app object for Vercel
app.debug = False

# Entry point for Vercel
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080) 