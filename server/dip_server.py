"""
DiP API 服务端 - 基于官方文档
Reference: https://github.com/GuyTevet/motion-diffusion-model/blob/main/DiP.md
"""
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import tempfile
import os
import subprocess

# 忽略警告
import warnings
warnings.filterwarnings('ignore')

import matplotlib
matplotlib.use('Agg')

app = Flask(__name__)
CORS(app)
logging.getLogger('werkzeug').setLevel(logging.ERROR)

# DiP 配置（来自官方文档）
MODEL_PATH = 'save/dip/model.pt'
GUIDANCE_PARAM = '7.5'
AUTOREGRESSIVE = True
CONTEXT_LEN = 20  # 上下文长度，用于 autoregressive 模式
PRED_LEN = 40     # 每段生成帧数
FPS = 20

# 服务端存储上一次生成的 hml_vec 格式 motion（用于连续动作过渡）
_last_hml_vec_file = '/tmp/dip_last_hml_vec.npy'

def _save_last_hml_vec(motion):
    """保存上一次的 hml_vec 到文件"""
    np.save(_last_hml_vec_file, motion)
    print(f"[DiP] Saved hml_vec to file, shape: {motion.shape}")

def _load_last_hml_vec():
    """从文件加载上一次的 hml_vec"""
    if os.path.exists(_last_hml_vec_file):
        motion = np.load(_last_hml_vec_file)
        print(f"[DiP] Loaded hml_vec from file, shape: {motion.shape}")
        return motion
    return None

# Python 路径
PYTHON_BIN = '/home/ssim/miniconda/envs/mdm/bin/python'

# 设置 HuggingFace 离线模式
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

# HumanML3D 关节名称
HML_JOINT_NAMES = [
    'pelvis', 'right_up_leg', 'left_up_leg', 'spine1',
    'right_leg', 'left_leg', 'spine2', 'right_foot',
    'left_foot', 'spine3', 'right_toes', 'left_toes',
    'neck', 'right_collar', 'left_collar', 'head',
    'right_shoulder', 'left_shoulder', 'right_elbow',
    'left_elbow', 'right_wrist', 'left_wrist'
]


def run_dip_generation(prompts, output_dir, motion_length=None, prefix_motion_path=None):
    """
    运行 DiP 生成
    根据官方文档: python -m sample.generate --model_path ... --autoregressive --guidance_param 7.5
    """
    # 判断是单动作还是多动作序列
    is_sequence = isinstance(prompts, list) and len(prompts) > 1
    
    # 创建临时文件
    if is_sequence:
        # 多段动作：写入动态文本文件
        text_file = os.path.join(output_dir, 'prompts.txt')
        with open(text_file, 'w') as f:
            for p in prompts:
                f.write(p.strip() + '\n')
        prompt_arg = '--dynamic_text_path'
        prompt_value = text_file
        # 多动作时，如果没有指定 motion_length，默认每段2秒
        if motion_length is None:
            motion_length = len(prompts) * 2
    else:
        # 单段动作：直接使用文本提示
        prompt_arg = '--text_prompt'
        prompt_value = prompts if isinstance(prompts, str) else prompts[0]
        # 单动作时，如果没有指定 motion_length，默认2秒
        if motion_length is None:
            motion_length = 2
    
    # 构建命令（完全按照官方文档）
    cmd = [
        PYTHON_BIN, '-m', 'sample.generate',
        '--model_path', MODEL_PATH,
        '--autoregressive',
        '--guidance_param', GUIDANCE_PARAM,
        '--num_samples', '1',
        '--output_dir', output_dir
    ]
    
    # 添加 prompt 参数
    cmd.extend([prompt_arg, prompt_value])
    
    # 添加 motion_length（如果指定）
    if motion_length:
        cmd.extend(['--motion_length', str(motion_length)])
    
    # 添加 context_len（启用 prefix 模式）
    cmd.extend(['--context_len', str(CONTEXT_LEN)])
    
    # 添加 prefix motion（用于连续动作过渡）
    if prefix_motion_path:
        cmd.extend(['--prefix_motion', prefix_motion_path])
    
    print(f"[DiP] Running: {' '.join(cmd)}")
    
    # 运行生成
    result = subprocess.run(
        cmd,
        cwd='/home/ssim/motion-diffusion-model',
        capture_output=True,
        text=True,
        timeout=600
    )
    
    if result.returncode != 0:
        print(f"[DiP] Error: {result.stderr}")
        raise RuntimeError(f"Generation failed: {result.stderr}")
    
    return result


def process_motion_data(data):
    """
    处理 DiP 输出数据
    DiP 输出格式: (samples, joints, 3, frames)
    转换为前端格式: [frames][joints][3]
    """
    raw_motion = data['motion']
    
    # 取第一个样本
    if len(raw_motion.shape) == 4:
        raw_motion = raw_motion[0]  # (joints, 3, frames)
    
    # shape: (joints, 3, frames) -> (frames, joints, 3)
    motion_transposed = np.transpose(raw_motion, (2, 0, 1))
    
    # 转换为 Python list（翻转 Z 轴，与 vrm-bone-test 一致）
    motion_list = []
    for frame_idx in range(motion_transposed.shape[0]):
        frame_data = []
        for joint_idx in range(motion_transposed.shape[1]):
            x = float(motion_transposed[frame_idx, joint_idx, 0])
            y = float(motion_transposed[frame_idx, joint_idx, 1])
            z = float(motion_transposed[frame_idx, joint_idx, 2])
            frame_data.append([x, y, -z])  # 翻转 Z 轴
        motion_list.append(frame_data)
    
    return raw_motion, motion_list


@app.route('/api/health', methods=['GET'])
def api_health():
    """健康检查"""
    return jsonify({"status": "ok"})


@app.route('/api/generate', methods=['POST'])
def api_generate():
    """
    生成单个动作
    官方命令: python -m sample.generate --model_path save/dip/model.pt --autoregressive --guidance_param 7.5 --text_prompt "wave"
    """
    data = request.json
    prompt = data.get('prompt', '').strip()
    
    if not prompt:
        return jsonify({"status": "error", "message": "Empty prompt"}), 400
    
    print(f"[DiP] Generating: '{prompt}'")
    
    try:
        output_dir = tempfile.mkdtemp()
        
        # 运行 DiP 生成
        run_dip_generation(prompt, output_dir)
        
        # 加载结果
        results_file = os.path.join(output_dir, 'results.npy')
        data = np.load(results_file, allow_pickle=True)
        if data.shape == ():
            data = data.item()
        
        # 处理数据
        text = data['text']
        lengths = data['lengths']
        raw_motion, motion_list = process_motion_data(data)
        
        # 保存原始数据
        np.save('/mnt/d/dip_output.npy', raw_motion)
        
        print(f"[DiP] Result: {text[0]}, frames: {lengths[0]}")
        
        return jsonify({
            "status": "ok",
            "prompt": prompt,
            "result_text": [t.decode() if isinstance(t, bytes) else t for t in text],
            "motion": motion_list,
            "joints": raw_motion.shape[0],
            "frames": raw_motion.shape[2],
            "fps": FPS,
            "hml_names": HML_JOINT_NAMES
        })
        
    except Exception as e:
        import traceback
        print(f"[DiP] Exception: {e}")
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e),
            "trace": traceback.format_exc()
        }), 500


@app.route('/api/generate_sequence', methods=['POST'])
def api_generate_sequence():
    """
    生成多段连续动作
    """
    data = request.json
    prompts = data.get('prompts', [])
    skip_first_frames = 0
    
    if not prompts:
        return jsonify({"status": "error", "message": "Empty prompts"}), 400
    
    if isinstance(prompts, str):
        prompts = [prompts]
    
    # 从文件加载上一次的 hml_vec
    last_motion = _load_last_hml_vec()
    
    print(f"[DiP] === Generating sequence: {prompts} ===")
    if last_motion is not None:
        print(f"[DiP] Previous motion exists: shape={last_motion.shape}")
    else:
        print(f"[DiP] No previous motion (first time)")
    
    try:
        output_dir = tempfile.mkdtemp()
        
        # 使用上一次的最后 20 帧作为 prefix
        prefix_motion_path = None
        if last_motion is not None:
            print(f"[DiP] Previous hml_vec shape: {last_motion.shape}")
            if last_motion.shape[-1] >= CONTEXT_LEN:
                last_frames = last_motion[:, :, :, -CONTEXT_LEN:]
                prefix_motion_path = os.path.join(output_dir, 'prefix.npy')
                np.save(prefix_motion_path, last_frames)
                print(f"[DiP] Created prefix file: {prefix_motion_path}")
                print(f"[DiP] Prefix shape: {last_frames.shape}")
            else:
                print(f"[DiP] Not enough frames: {last_motion.shape[-1]} < {CONTEXT_LEN}")
        else:
            print("[DiP] No previous motion, using random prefix")
        
        # 多动作：motion_length = 动作数 × 2秒
        motion_length = len(prompts) * 2
        
        # 运行 DiP 生成
        run_dip_generation(prompts, output_dir, motion_length, prefix_motion_path)
        
        # 加载结果
        results_file = os.path.join(output_dir, 'results.npy')
        data = np.load(results_file, allow_pickle=True)
        if data.shape == ():
            data = data.item()
        
        # 加载原始 hml_vec 数据（用于 prefix）
        hml_vec_file = os.path.join(output_dir, 'motion_hml_vec.npy')
        hml_vec_motion = None
        if os.path.exists(hml_vec_file):
            hml_vec_motion = np.load(hml_vec_file)
            print(f"[DiP] Loaded hml_vec: {hml_vec_motion.shape}")
        
        # 处理数据（转换为 xyz 格式）
        text = data['text']
        lengths = data['lengths']
        raw_motion, motion_list = process_motion_data(data)
        
        # 保存原始 xyz 数据
        np.save('/mnt/d/dip_sequence_output.npy', raw_motion)
        
        total_frames = raw_motion.shape[2]
        print(f"[DiP] Sequence result: frames={total_frames}")
        
        # 不再跳过任何帧
        
        # 计算每段帧数（跳过后的实际帧数）
        actual_frames_per_segment = total_frames // len(prompts)
        
        # 构建段信息
        segments = []
        for i, prompt in enumerate(prompts):
            start = i * actual_frames_per_segment
            end = min((i + 1) * actual_frames_per_segment, total_frames)
            segments.append({
                "prompt": prompt,
                "start": start,
                "end": end,
                "frames": end - start,
                "seconds": (end - start) / FPS
            })
        
        # 返回结果（包含 hml_vec 格式供下次连续生成使用）
        hml_vec_list = None
        if hml_vec_motion is not None:
            # 转换为前端需要的格式 (frames, joints, 3)
            hml_vec_transposed = np.transpose(hml_vec_motion[0], (2, 0, 1))
            hml_vec_list = hml_vec_transposed.tolist()
            
            # 保存到文件，供下次连续动作生成使用
            _save_last_hml_vec(hml_vec_motion)
        
        return jsonify({
            "status": "ok",
            "prompts": prompts,
            "motion": motion_list,
            "hml_vec": hml_vec_list,  # 原始 hml_vec 格式，供下次 prefix 使用
            "joints": raw_motion.shape[0],
            "frames": total_frames,
            "fps": FPS,
            "total_seconds": total_frames / FPS,
            "segments": segments,
            "hml_names": HML_JOINT_NAMES
        })
        
    except Exception as e:
        import traceback
        print(f"[DiP] Sequence Exception: {e}")
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e),
            "trace": traceback.format_exc()
        }), 500


if __name__ == '__main__':
    print("=" * 50)
    print("DiP API Server (Official Documentation)")
    print("=" * 50)
    print("Model:", MODEL_PATH)
    print("Guidance:", GUIDANCE_PARAM)
    print("Endpoints:")
    print("  POST /api/generate         - Generate single motion")
    print("  POST /api/generate_sequence - Generate continuous sequence")
    print("  GET  /api/health           - Health check")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5002, debug=False, threaded=True)