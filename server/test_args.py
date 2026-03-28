import sys
sys.argv = ['prog', '--model_path', 'test.pt', '--prefix_motion', 'test.npy']
from utils.parser_util import generate_args
args = generate_args()
print('Has prefix_motion:', hasattr(args, 'prefix_motion'))
print('Value:', getattr(args, 'prefix_motion', 'NOT_FOUND'))