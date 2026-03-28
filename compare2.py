import json

with open('dip_api_wave.json') as f:
    api = json.load(f)
with open('D:/projects/vrm-bone-test/tpose_all.json') as f:
    npy = json.load(f)

print('=== 对比所有关节的位置差异 ===')
print('关节     API Y        npy Y       差值')
print('-' * 50)
for i in range(22):
    api_y = api[0][i][1]
    npy_y = npy[0][i][1]
    diff = api_y - npy_y
    print(f'{i:2d}    {api_y:.4f}   {npy_y:.4f}   {diff:.4f}')

print()
print('=== 结论 ===')
# 检查是否是固定的 Y 偏移
y_offsets = [api[0][i][1] - npy[0][i][1] for i in range(22)]
avg_offset = sum(y_offsets) / len(y_offsets)
print(f'平均 Y 偏移: {avg_offset:.4f}')
print(f'Y 偏移范围: {min(y_offsets):.4f} ~ {max(y_offsets):.4f}')
