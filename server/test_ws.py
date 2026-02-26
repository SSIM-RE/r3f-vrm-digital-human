"""测试 WebSocket 连接"""
import asyncio
import websockets
import json

async def test():
    try:
        # 连接到 WebSocket 服务器
        async with websockets.connect('ws://localhost:5174') as ws:
            print("Connected!")
            
            # 发送测试消息
            test_msg = {
                "type": "voice_input",
                "text": "测试消息",
                "timestamp": 1234567890
            }
            await ws.send(json.dumps(test_msg))
            print(f"Sent: {test_msg}")
            
            # 等待回复
            response = await ws.recv()
            print(f"Received: {response}")
            
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
