#!/usr/bin/env python3
# Add --prefix_motion argument to parser_util.py

with open('/home/ssim/motion-diffusion-model/utils/parser_util.py', 'r') as f:
    lines = f.readlines()

# Find line containing target_joint_names
for i, line in enumerate(lines):
    if 'target_joint_names' in line and 'DIMP_FINAL' in line:
        print(f'Found at line {i+1}')
        # Add new argument after this line
        new_line = '''    group.add_argument("--prefix_motion", default='', type=str,
                       help="Path to a .npy file containing prefix motion data. If provided, will use this as the initial prefix instead of sampling from dataset.")
'''
        lines.insert(i+1, new_line)
        break

# Write back
with open('/home/ssim/motion-diffusion-model/utils/parser_util.py', 'w') as f:
    f.writelines(lines)

print('Done - added --prefix_motion argument')