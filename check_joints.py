import json

# 检查本地文件
with open('D:/projects/vrm-bone-test/tpose_all.json') as f:
    local = json.load(f)

# 检查 API 数据
with open('dip_api_wave.json') as f:
    api = json.load(f)

print('=== 帧数对比 ===')
print('本地:', len(local))
print('API:', len(api))

print('\n=== 第一帧第17-22关节（手臂相关）===')
print('本地:', local[0][16:22])
print('API:', api[0][16:22])
