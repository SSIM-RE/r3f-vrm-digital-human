#!/usr/bin/env python3
import subprocess
import sys

print("Testing DiP directly...")
result = subprocess.run([
    '/home/ssim/miniconda/envs/mdm/bin/python', '-m', 'sample.generate',
    '--model_path', 'save/dip/model.pt',
    '--text_prompt', 'wave',
    '--num_samples', '1',
    '--output_dir', '/tmp/test_dip3'
], capture_output=True, text=True, cwd='/home/ssim/motion-diffusion-model', timeout=180)

print("=== STDOUT ===")
print(result.stdout[:1000])
print("=== STDERR ===")
print(result.stderr[:1000])
print("=== RETURN CODE ===")
print(result.returncode)

# Check output
import os
if os.path.exists('/tmp/test_dip3'):
    print("=== OUTPUT DIR ===")
    print(os.listdir('/tmp/test_dip3'))