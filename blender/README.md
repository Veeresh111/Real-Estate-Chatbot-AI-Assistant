# Blender Build Guide

This folder contains a Blender build script and config for the Bhunidhi site animation.

## 1) Add the map image
Place the scanned layout image at:
`blender/assets/site_map.jpg`

If you use a different filename, update `map_image` in `blender/scene_config.json`.

## 2) Open Blender and run the script
From a terminal:
```bash
blender -b -P blender/build_scene.py
```

Or in Blender:
1. Open the Scripting workspace.
2. Open `blender/build_scene.py`.
3. Press Run Script.

## 3) Adjust layout accuracy
Because the scan is low contrast, the script creates a base scene. You can:
- Move/scale the map plane to match the real road width.
- Select generated buildings and move them to the exact plot centers.
- Add or remove buildings in `blender/scene_config.json` for precise placement.

## 4) Render
Set your output path in Blender and render the animation at 1080p.

## Notes
- Duration is set to 180s (3 minutes). Change `duration_sec` in the config if needed.
- Hologram styling uses emissive materials. Adjust colors in `build_scene.py` if required.
