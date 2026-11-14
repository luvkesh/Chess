"""SDXL-Lightning, 4 steps (ByteDance, OpenRAIL++), on the CPU: the loader gen.py and i2i.py
share. About 30 to 60 s a picture at 768 x 1024 on 4 cores. setup.sh fetches the files.

CLIP reads 77 tokens: keep every prompt under about 55 words or its tail is silently dropped."""
import os

import torch
from diffusers import AutoencoderKL, EulerDiscreteScheduler, StableDiffusionXLImg2ImgPipeline, StableDiffusionXLPipeline, UNet2DConditionModel
from safetensors.torch import load_file

D = os.environ.get('SDXL_DIR', os.path.expanduser('~/.cache/chackmate/sdxl')) + '/'
W, H = int(os.environ.get('W', 768)), int(os.environ.get('H', 1024))


def pipe(kind='txt'):
    torch.set_num_threads(os.cpu_count())
    dt = torch.bfloat16
    unet = UNet2DConditionModel.from_config(UNet2DConditionModel.load_config(D + 'base', subfolder='unet')).to(dt)
    unet.load_state_dict(load_file(D + 'light/sdxl_lightning_4step_unet.safetensors'))
    vae = AutoencoderKL.from_pretrained(D + 'vae', torch_dtype=dt)
    cls = StableDiffusionXLImg2ImgPipeline if kind == 'img' else StableDiffusionXLPipeline
    p = cls.from_pretrained(D + 'base', unet=unet, vae=vae, torch_dtype=dt, variant='fp16')
    # Lightning is trained for "trailing" timesteps and no guidance
    p.scheduler = EulerDiscreteScheduler.from_config(p.scheduler.config, timestep_spacing='trailing')
    p.set_progress_bar_config(disable=True)
    return p
