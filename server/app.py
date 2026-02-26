"""
Whisper 转写服务器
用法: python app.py
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import os
import tempfile

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 全局模型变量
model = None

# 模型路径
MODEL_PATH = "D:/AI/OpenClaw/whisper"  # 本地模型路径

def load_model():
    """加载 Whisper 模型"""
    global model
    print(f"Loading model from {MODEL_PATH}...")
    model = WhisperModel(MODEL_PATH, device="cpu", compute_type="int8")
    print("Model loaded!")

@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'model': 'local'
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    转写接口
    接收音频文件，返回文字
    """
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    
    audio_file = request.files['audio']
    
    # 保存到临时文件
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # 转写
        segments, info = model.transcribe(
            tmp_path,
            language='zh',  # 中文
            beam_size=5,
            vad_filter=True  # 启用 VAD 过滤
        )
        
        # 收集结果
        text = ' '.join([seg.text for seg in segments])
        
        # 确保 UTF-8 编码
        if isinstance(text, bytes):
            text = text.decode('utf-8', errors='ignore')
        
        print(f"Transcribe result: {text}")
        
        return jsonify({
            'text': text,
            'language': info.language,
            'language_probability': info.language_probability}
        )
    
    except Exception as e:
        print(f"Transcribe error: {e}")
        return jsonify({'error': str(e)}), 500
    
    finally:
        # 删除临时文件
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == '__main__':
    # 先加载模型
    load_model()
    
    # 启动服务器
    print("Server starting: http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
