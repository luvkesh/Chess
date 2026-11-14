#!/usr/bin/env bash
# One-time setup of the set-modelling tools in a fresh cloud container. About 20 minutes and
# 18 GB of disk, most of it model files.
#
#   bash apps/web-prototype/tools/model/setup.sh            everything
#   bash apps/web-prototype/tools/model/setup.sh model      Blender + cut-outs only (4 GB)
#   bash apps/web-prototype/tools/model/setup.sh pictures   the picture maker only (12 GB)
#   bash apps/web-prototype/tools/model/setup.sh triposr    the depth helper only (1.7 GB)
#
# What it fetches, all OK'd by the owner for this project (2026-11-13):
#   bpy (Blender as a Python wheel, GPL), Segment Anything ViT-H (Apache-2.0, ONNX export
#   Xenova/sam-vit-huge), TripoSR (MIT, ONNX export jc-builds/triposr-ios), SDXL-Lightning
#   (ByteDance, OpenRAIL++) with the SDXL base text encoders (OpenRAIL++) and madebyollin's
#   fp16 VAE (MIT). Nothing else: a new tool or model needs the owner's OK first.
#
# Where things go (override with the variable in brackets):
#   /opt/bv                       Blender venv            [CHACK_BV]
#   ~/.cache/sam-h                Segment Anything        [SAM_DIR]
#   ~/.cache/chackmate/triposr    TripoSR                 [TRIPOSR_DIR]
#   ~/.cache/chackmate/pv         picture venv (torch)    [CHACK_PV]
#   ~/.cache/chackmate/sdxl       SDXL-Lightning files    [SDXL_DIR]
set -euo pipefail
export HF_HUB_DISABLE_XET=1    # the Xet host is blocked from these containers; plain HTTPS works
HERE="$(cd "$(dirname "$0")" && pwd)"
BV="${CHACK_BV:-/opt/bv}"
PV="${CHACK_PV:-$HOME/.cache/chackmate/pv}"
SDXL="${SDXL_DIR:-$HOME/.cache/chackmate/sdxl}"
TSR="${TRIPOSR_DIR:-$HOME/.cache/chackmate/triposr}"
WHAT="${*:-model pictures triposr}"

model() {
  [ -x "$BV/bin/python" ] || python3 -m venv "$BV"
  "$BV/bin/pip" install -q --no-cache-dir bpy==5.3.0 numpy opencv-python-headless scipy pillow scikit-image onnxruntime huggingface_hub
  "$BV/bin/python" -c "import bpy, cv2, scipy, skimage, onnxruntime; print('blender', bpy.app.version_string)"
  # Segment Anything fetches itself on first use; do it now so the first build does not stall
  (cd "$HERE" && "$BV/bin/python" -c "import sam; sam._models(); print('segment anything ready')")
}

triposr() {
  mkdir -p "$TSR"
  "$BV/bin/python" - "$TSR" <<'EOF'
import sys
from huggingface_hub import hf_hub_download
for f in ('triposr_decoder.onnx', 'triposr_decoder.onnx.data', 'triposr_encoder.onnx', 'triposr_encoder.onnx.data'):
    hf_hub_download('jc-builds/triposr-ios', f, local_dir=sys.argv[1])
print('triposr ready')
EOF
}

pictures() {
  [ -x "$PV/bin/python" ] || python3 -m venv "$PV"
  # torch from PyPI (download.pytorch.org is blocked); its nvidia wheels come along and are
  # needed for the import even though everything runs on the CPU. transformers 5 wants a newer
  # torch, so both are pinned.
  "$PV/bin/pip" install -q --no-cache-dir torch==2.5.1 diffusers==0.31.0 transformers==4.46.3 accelerate safetensors "huggingface-hub>=0.36,<1" pillow numpy
  mkdir -p "$SDXL"
  "$PV/bin/python" - "$SDXL" <<'EOF'
import sys
from huggingface_hub import hf_hub_download, snapshot_download
d = sys.argv[1]
hf_hub_download('ByteDance/SDXL-Lightning', 'sdxl_lightning_4step_unet.safetensors', local_dir=d + '/light')
snapshot_download('madebyollin/sdxl-vae-fp16-fix', local_dir=d + '/vae', allow_patterns=['config.json', 'diffusion_pytorch_model.safetensors'])
snapshot_download('stabilityai/stable-diffusion-xl-base-1.0', local_dir=d + '/base', allow_patterns=[
    'model_index.json', 'scheduler/*', 'tokenizer/*', 'tokenizer_2/*', 'text_encoder/config.json', 'text_encoder_2/config.json',
    'text_encoder/model.fp16.safetensors', 'text_encoder_2/model.fp16.safetensors', 'unet/config.json', 'vae/config.json'])
print('sdxl-lightning ready')
EOF
  "$PV/bin/python" -c "import torch, diffusers, transformers; print('torch', torch.__version__, 'threads', torch.get_num_threads())"
}

for w in $WHAT; do
  case "$w" in
    model) model ;;
    triposr) [ -x "$BV/bin/python" ] || model; triposr ;;
    pictures) pictures ;;
    *) echo "unknown part: $w (model, pictures, triposr)"; exit 1 ;;
  esac
done
df -h / | tail -1
