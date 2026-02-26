"""
Mico AI WebSocket 服务器 (使用标准库)
"""
import asyncio
import json
import base64
import hashlib
import sys
import os
import websockets
import hmac

# 强制输出立即刷新
os.environ['PYTHONUNBUFFERED'] = '1'

# WebSocket 服务器配置
WS_HOST = "0.0.0.0"
WS_PORT = 8765  # 避免与 Vite HMR 冲突

# OpenClaw 配置
OPENCLAW_TOKEN = "bbdc90f999420b51a92a6526a44087037c8aa8e529b52be8"

def decode_websocket_frame(data):
    """解码 WebSocket 帧"""
    if len(data) < 2:
        return None
    
    fin = (data[0] >> 7) & 1
    opcode = data[0] & 0x0f
    masked = (data[1] >> 7) & 1
    payload_len = data[1] & 0x7f
    
    if payload_len == 126:
        payload_len = int.from_bytes(data[2:4], 'big')
        start = 4
    elif payload_len == 127:
        payload_len = int.from_bytes(data[2:10], 'big')
        start = 10
    else:
        start = 2
    
    mask = None
    if masked:
        mask = data[start:start+4]
        start += 4
    
    payload = data[start:start+payload_len]
    
    if masked and mask:
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    
    # 尝试多种编码
    for enc in ['utf-8', 'gbk', 'latin-1']:
        try:
            return payload.decode(enc)
        except:
            pass
    return payload.decode('utf-8', errors='ignore')

def encode_websocket_frame(message):
    """编码 WebSocket 帧"""
    message = message.encode('utf-8')
    length = len(message)
    
    if length <= 125:
        header = bytes([0x81, length])
    elif length <= 65535:
        header = bytes([0x81, 126, (length >> 8) & 0xFF, length & 0xFF])
    else:
        header = bytes([0x81, 127, 0, 0, 0, 0, (length >> 24) & 0xFF, 
                       (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF])
    
    return header + message

def create_handshake_response(key):
    """生成 WebSocket 握手响应"""
    GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
    
    return (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n"
        "\r\n"
    )

# 全局客户端列表
clients = set()

async def get_openclaw_response(text):
    """通过 WebSocket 连接 OpenClaw Gateway"""
    import asyncio
    import uuid
    try:
        # 连接 /api
        ws = await websockets.connect("ws://127.0.0.1:18789/api")
        
        # 等待认证挑战
        challenge = await ws.recv()
        data = json.loads(challenge)
        print(f"Challenge: {data}")
        
        if data.get('type') == 'event' and data.get('event') == 'connect.challenge':
            nonce = data.get('payload', {}).get('nonce')
            
            # 用完整格式发送认证 (client + version)
            auth_id = str(uuid.uuid4())
            await ws.send(json.dumps({
                "jsonrpc": "2.0",
                "id": auth_id,
                "method": "auth.verify",
                "params": {
                    "token": OPENCLAW_TOKEN,
                    "nonce": nonce,
                    "client": {
                        "name": "mico",
                        "version": "1.0.0"
                    }
                }
            }))
            print(f"Sent full auth")
            
            # 等待认证确认
            try:
                auth_result = await asyncio.wait_for(ws.recv(), timeout=3)
                print(f"Auth result: {auth_result[:200]}")
            except asyncio.TimeoutError:
                print("Auth timeout")
        
        # 发送消息
        msg_id = str(uuid.uuid4())
        await ws.send(json.dumps({
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": "message",
            "params": {"text": text, "sessionKey": "main"}
        }))
        
        print(f"Sent: {text}")
        
        # 等待响应
        for _ in range(60):
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=1)
                resp_data = json.loads(response)
                print(f"Response: {str(resp_data)[:100]}")
                
                if "result" in resp_data:
                    result = resp_data.get("result", {})
                    reply = result.get("text", result.get("message", ""))
                    if reply:
                        return {"text": reply, "emotion": "neutral", "mdm_prompt": "idle", "tts_params": {"speed": 1.0}}
            except asyncio.TimeoutError:
                continue
        
        await ws.close()
                    
    except Exception as e:
        print(f"OpenClaw error: {e}")
        return None

def get_ai_response(text):
    """获取 AI 响应"""
    import asyncio
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(get_openclaw_response(text))
            if result:
                return result
        finally:
            loop.close()
    except Exception as e:
        print(f"OpenClaw error: {e}")
    
    return {"text": f"你好！我是 Mico~", "emotion": "happy", "mdm_prompt": "idle", "tts_params": {"speed": 1.0}}

async def handle_client(reader, writer):
    """处理客户端连接"""
    addr = writer.get_extra_info('peername')
    print(f"New connection from {addr}")
    
    try:
        # 读取 HTTP 请求
        request = b""
        while b"\r\n\r\n" not in request:
            chunk = await reader.read(1024)
            if not chunk:
                return
            request += chunk
        
        request_str = request.decode('utf-8', errors='ignore')
        
        # 检查是否是 WebSocket 升级请求
        if "Upgrade: websocket" in request_str or "upgrade: websocket" in request_str:
            # 提取 Sec-WebSocket-Key
            for line in request_str.split("\r\n"):
                if line.lower().startswith("sec-websocket-key:"):
                    key = line.split(":", 1)[1].strip()
                    break
            else:
                key = None
            
            if key:
                # 发送握手响应
                response = create_handshake_response(key)
                writer.write(response.encode())
                await writer.drain()
                print(f"WebSocket handshake complete for {addr}")
                
                clients.add(writer)
                
                # 接收消息循环
                try:
                    while True:
                        data = await reader.read(1024)
                        if not data:
                            break
                        
                        message = decode_websocket_frame(data)
                        if message:
                            print(f"Received: {message}")
                            
                            try:
                                data_json = json.loads(message)
                                if data_json.get("type") == "voice_input":
                                    text = data_json.get("text", "")
                                    # 在线程池中运行 OpenClaw
                                    loop = asyncio.get_event_loop()
                                    ai_response = await loop.run_in_executor(None, get_ai_response, text)
                                    reply = {
                                        "type": "ai_response",
                                        "data": ai_response,
                                        "timestamp": data_json.get("timestamp", 0)
                                    }
                                    writer.write(encode_websocket_frame(json.dumps(reply)))
                                    await writer.drain()
                                    print(f"Sent reply")
                            except json.JSONDecodeError:
                                print("JSON parse failed")
                except Exception as e:
                    print(f"Error: {e}")
                finally:
                    clients.remove(writer)
        else:
            # 普通 HTTP 请求
            response = "HTTP/1.1 404 Not Found\r\n\r\n"
            writer.write(response.encode())
            await writer.drain()
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        writer.close()
        await writer.wait_closed()
        print(f"Client {addr} disconnected")

async def main():
    """启动服务器"""
    server = await asyncio.start_server(
        handle_client, WS_HOST, WS_PORT
    )
    
    addr = server.sockets[0].getsockname()
    print(f"WebSocket server running on ws://{addr[0]}:{addr[1]}")
    
    async with server:
        await server.serve_forever()

if __name__ == '__main__':
    asyncio.run(main())
