#!/usr/bin/env python3
"""
Simple Flask test app for KinD deployment
"""

from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

@app.route('/api/hello', methods=['GET'])
def hello():
    """Simple hello endpoint"""
    return jsonify({
        'message': 'Hello from Backend!',
        'status': 'success',
        'environment': os.environ.get('FLASK_ENV', 'production')
    })

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'backend'
    })

@app.route('/api/info', methods=['GET'])
def info():
    """Info endpoint"""
    return jsonify({
        'service': 'Simple Backend API',
        'version': '1.0.0',
        'endpoints': [
            '/api/hello',
            '/api/health',
            '/api/info'
        ]
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    
    print(f"🚀 Starting Simple Flask App on port {port}")
    print(f"🔧 Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug) 
