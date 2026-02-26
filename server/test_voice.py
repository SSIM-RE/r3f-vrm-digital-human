"""
测试 Mico VRM 语音交互流程 - 简化版
"""
import asyncio
import json
import websockets
import sys
import os

# 设置输出编码
os.environ['PYTHONUNBUFFERED'] = '1'

# OpenClaw Gateway 配置
OPENCLAW_WS = "ws://127.0.0.1:18789/api"

async def test_voice_interaction():
    print("=" * 50)
    print("Mico VRM Voice Interaction Test")
    print("=" * 50)
    
    try:
        # 1. 连接到 OpenClaw Gateway
        print("\n[1] Connecting to OpenClaw Gateway...")
        async with websockets.connect(OPENCLAW_WS) as ws:
            # 接收认证挑战
            print("    Waiting for challenge...")
            challenge = await ws.recv()
            data = json.loads(challenge)
            print(f"    Received: {data.get('event', data.get('type'))}")
            
            if data.get('type') == 'event' and data.get('event') == 'connect.challenge':
                nonce = data.get('payload', {}).get('nonce')
                
                # 发送认证
                print("    Sending auth...")
                await ws.send(json.dumps({
                    "jsonrpc": "2.0",
                    "id": "auth-test",
                    "method": "auth.verify",
                    "params": {
                        "token": "bbdc90f999420b51a92a6526a44087037c8aa8e529b52be8",
                        "nonce": nonce,
                        "client": {"name": "mico-tester", "version": "1.0.0"}
                    }
                }))
                
                # 等待认证结果
                try:
                    auth_result = await asyncio.wait_for(ws.recv(), timeout=3)
                    print(f"    Auth result: {auth_result[:200]}")
                except asyncio.TimeoutError:
                    print("    Auth timeout, continuing...")
            
            # 2. 发送测试消息
            test_messages = [
                "hello",
                "how are you",
            ]
            
            for msg_text in test_messages:
                print(f"\n[2] Sending: {msg_text}")
                
                await ws.send(json.dumps({
                    "jsonrpc": "2.0",
                    "id": f"msg-{id(msg_text)}",
                    "method": "message",
                    "params": {"text": msg_text, "sessionKey": "main"}
                }))
                print("    Message sent")
                
                # 等待回复
                print("    Waiting for response...")
                try:
                    for _ in range(15):
                        response = await asyncio.wait_for(ws.recv(), timeout=2)
                        resp_data = json.loads(response)
                        
                        if "result" in resp_data:
                            result = resp_data.get("result", {})
                            text = result.get('text', result.get('message', str(result)))
                            print(f"\n    [OK] Response: {text[:300]}")
                            break
                        
                        if resp_data.get("type") == "event":
                            payload = resp_data.get("payload", {})
                            if payload.get("text"):
                                print(f"    ... {payload.get('text')[:50]}")
                except asyncio.TimeoutError:
                    print("    Timeout waiting for response")
                
                await asyncio.sleep(1)
            
            print("\n" + "=" * 50)
            print("Test Complete!")
            print("=" * 50)
            
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_voice_interaction())
