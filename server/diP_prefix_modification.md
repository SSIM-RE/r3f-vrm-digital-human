# DiP 源码修改 - 添加 prefix_motion 参数支持

## 目标
让 DiP 支持传入自定义 prefix motion，作为初始动作序列，而不是随机采样。

## 修改文件

### 1. parser_util.py - 添加参数

在 `add_generate_options` 函数末尾添加：

```python
group.add_argument("--prefix_motion", default='', type=str,
                   help="Path to a .npy file containing prefix motion data. "
                        "Shape: (frames, joints, 3) or (joints, 3, frames). "
                        "Will use this as the initial prefix instead of sampling from dataset.")
```

### 2. generate.py - 加载自定义 prefix

在 `is_using_data = not any([...])` 之后，添加：

```python
# 支持自定义 prefix motion
if args.prefix_motion and os.path.exists(args.prefix_motion):
    is_using_data = True
    print(f'[DiP] Loading custom prefix motion: {args.prefix_motion}')
    prefix_data = np.load(args.prefix_motion)  # shape: (frames, joints, 3)
    
    # 转换为 (joints, 3, frames)
    if prefix_data.shape[-1] == 3:  # (frames, joints, 3)
        prefix_data = np.transpose(prefix_data, (1, 2, 0))
    
    # 转换为 tensor 并存储，供后续使用
    custom_prefix = torch.from_numpy(prefix_data).float()
```

在 `model_kwargs['y'] = {...}` 之后，设置 prefix：

```python
# 设置自定义 prefix（如果提供了）
if args.prefix_motion and os.path.exists(args.prefix_motion):
    model_kwargs['y']['prefix'] = custom_prefix.unsqueeze(0).to(dist_util.dev())  # [1, joints, 3, frames]
    # 更新 lengths 为 prefix 长度
    model_kwargs['y']['lengths'] = torch.tensor([custom_prefix.shape[-1]], device=dist_util.dev())
```

### 3. 服务端调用示例

```python
cmd = [
    PYTHON_BIN, '-m', 'sample.generate',
    '--model_path', MODEL_PATH,
    '--autoregressive',
    '--guidance_param', GUIDANCE_PARAM,
    '--num_samples', '1',
    '--output_dir', output_dir,
    '--dynamic_text_path', text_file,
    '--motion_length', str(motion_length),
]

# 如果有 prefix motion，添加参数
if prefix_motion_file:
    cmd.extend(['--prefix_motion', prefix_motion_file])
```

## 注意事项

1. prefix motion 的帧数应 >= context_len（默认20帧）
2. 格式为 (joints, 3, frames)，即 (22, 3, N)
3. 服务端需要保存上一次的 motion 数据到临时文件