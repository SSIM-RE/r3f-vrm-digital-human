"""
Mico AI WebSocket 服务器 (使用 ws 库)
"""

import json
import asyncio
from ws import WebSocket
from ws import create_server

# WebSocket 服务器配置
WS_HOST = "0.0.0.0"
WS_PORT = 5174

# 模拟 AI 响应
def get_ai_response(text):
    return {
        "text": f"我听到你说: {text}",
        "emotion": "happy",
        "mdm_prompt": "idle",
        "tts_params": {"speed": 1.0}
    }

async def handle_client(ws, path):
    """处理 WebSocket 客户端连接"""
    print(f"New client connected from {path}")
    
    try:
        async for message in ws:
            print(f"Received: {message}")
            
            try:
                data = json.loads(message)
                
                if data.get("type") == "voice_input":
                    text = data.get("text", "")
                    
                    # 获取 AI 响应
                    ai_response = get_ai_response(text)
                    
                    # 发送回复
                    reply = {
                        "type": "ai_response",
                        "data": ai_response,
                        "timestamp": data.get("timestamp", 0)
                    }
                    
                    await ws.send(json.dumps(reply))
                    print(f"Sent reply: {reply}")
                    
            except json.JSONDecodeError:
                print("JSON parse failed")
            except Exception as e:
                print(f"Error: {e}")
                
    except Exception as e:
        print(f"Client disconnected: {e}")

async def main():
    """启动 WebSocket 服务器"""
    print(f"Starting WebSocket server on ws://{WS_HOST}:{WS_PORT}")
    
    async with create_server(WS_HOST, WS_PORT) as server:
        async for ws in server:
            await handle_client(ws, ws.remote_address)

if __name__ == '__main__':
    asyncio.run(main())
