"""Frame-by-frame animation renderer + ffmpeg stitcher.

Renders matplotlib figures frame-by-frame, then stitches PNG sequences into
video with ffmpeg. Guarantees identical look to static figures.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


def render_animation(
    draw_frame,
    n_frames: int,
    output_path: str,
    fps: int = 30,
    figsize=(12, 12),
    dpi: int = 150,
    codec: str = "libx264",
    pix_fmt: str = "yuv420p",
    cleanup: bool = True,
    **frame_kwargs,
) -> str:
    """Render a frame-by-frame animation.

    Args:
        draw_frame: callable(frame_idx, fig, ax, **frame_kwargs) -> None
            Called for each frame. Should clear/redraw the axes.
        n_frames: total number of frames
        output_path: path for output MP4
        fps: frames per second
        figsize: figure size
        dpi: render DPI (higher = sharper but slower)
        codec: ffmpeg codec
        pix_fmt: ffmpeg pixel format
        cleanup: remove temp PNGs after stitching
        **frame_kwargs: passed to draw_frame

    Returns path to the output video.
    """
    output_path = str(output_path)
    tmp_dir = tempfile.mkdtemp(prefix="tennisviz_anim_")

    try:
        fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
        fig.patch.set_facecolor("#F5F0E8")

        for i in range(n_frames):
            ax.clear()
            draw_frame(i, fig, ax, **frame_kwargs)
            fig.canvas.draw()
            fig.savefig(os.path.join(tmp_dir, f"frame_{i:06d}.png"),
                        dpi=dpi, facecolor=fig.get_facecolor())
            if i % 10 == 0:
                print(f"  Rendered frame {i}/{n_frames}")

        plt.close(fig)

        # Stitch with ffmpeg
        _stitch_ffmpeg(tmp_dir, output_path, fps, codec, pix_fmt)
        print(f"Video saved: {output_path}")

    finally:
        if cleanup and os.path.isdir(tmp_dir):
            shutil.rmtree(tmp_dir)

    return output_path


def _stitch_ffmpeg(frame_dir: str, output_path: str, fps: int,
                   codec: str, pix_fmt: str):
    """Stitch PNG sequence into MP4 using ffmpeg."""
    input_pattern = os.path.join(frame_dir, "frame_%06d.png")
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", input_pattern,
        "-c:v", codec,
        "-pix_fmt", pix_fmt,
        "-crf", "18",
        "-preset", "slow",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{result.stderr}")


def ease_in_out(t: float) -> float:
    """Smooth easing function (cubic)."""
    if t < 0.5:
        return 4 * t ** 3
    return 1 - (-2 * t + 2) ** 3 / 2


def ease_out(t: float) -> float:
    """Ease-out (decelerate)."""
    return 1 - (1 - t) ** 3


def lerp(a, b, t):
    """Linear interpolation between a and b at parameter t."""
    return a + (b - a) * t


def progress(frame: int, total: int, start: float = 0.0, end: float = 1.0,
             ease=None) -> float:
    """Normalized progress through an animation segment with optional easing."""
    if total <= 0:
        return end
    t = np.clip(frame / max(total - 1, 1), 0, 1)
    t = (t - 0) / (1 - 0) * (end - start) + start
    if ease:
        t = ease(t)
    return t
