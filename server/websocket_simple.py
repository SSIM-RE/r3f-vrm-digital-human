"""
Mico AI WebSocket 服务器
简单的 WebSocket 服务器，接收前端消息
"""

import asyncio
import json
import websockets
import requests
import sys
import io

# 设置 UTF-8 输出
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# WebSocket 服务器配置
WS_HOST = "0.0.0.0"
WS_PORT = 5174

# OpenClaw HTTP API 地址（可选）
OPENCLAW_API = "http://localhost:8080"

connected_clients = set()

def send_to_openclaw(text):
    """
    发送消息到 OpenClaw 处理
    """
    try:
        # 尝试调用 OpenClaw API
        response = requests.post(
            f"{OPENCLAW_API}/api/chat",
            json={"message": text},
            timeout=10
        )
        return response.json()
    except Exception as e:
        print(f"OpenClaw API call failed: {e}")
        # 如果没有 OpenClaw API，返回模拟响应
        return {
            "text": f"我听到你说: {text}",
            "emotion": "neutral",
            "mdm_prompt": "idle",
            "tts_params": {"speed": 1.0}
        }

async def handle_client(websocket):
    """处理 WebSocket 客户端连接"""
    connected_clients.add(websocket)
    print(f"New client connected, total: {len(connected_clients)}")
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                print(f"Received: {data}")
                
                if data.get("type") == "voice_input":
                    text = data.get("text", "")
                    
                    # 发送到 OpenClaw 处理
                    ai_response = send_to_openclaw(text)
                    
                    # 构建回复
                    reply = {
                        "type": "ai_response",
                        "data": ai_response,
                        "timestamp": int(data.get("timestamp", 0))
                    }
                    
                    # 发送回复给前端
                    await websocket.send(json.dumps(reply))
                    print(f"Sent reply: {reply}")
                    
            except json.JSONDecodeError:
                print("JSON parse failed")
            except Exception as e:
                print(f"Error: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    finally:
        connected_clients.remove(websocket)
        print(f"Client disconnected, total: {len(connected_clients)}")

async def start_server():
    """启动 WebSocket 服务器"""
    print(f"Starting WebSocket server: ws://{WS_HOST}:{WS_PORT}")
    async with websockets.serve(handle_client, WS_HOST, WS_PORT):
        await asyncio.Future()  # 永远运行

if __name__ == '__main__':
    asyncio.run(start_server())
