#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/ssim/motion-diffusion-model')

with open('/home/ssim/motion-diffusion-model/utils/parser_util.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if 'target_joint_names' in line and 'DIMP_FINAL' in line:
        new_lines.append("    group.add_argument('--prefix_motion', default='', type=str,\n")
        new_lines.append("                       help=\"Path to a .npy file containing prefix motion data. If provided, will use this as the initial prefix instead of sampling from dataset.\")\n")

with open('/home/ssim/motion-diffusion-model/utils/parser_util.py', 'w') as f:
    f.writelines(new_lines)

print('Done - added prefix_motion to add_generate_options')