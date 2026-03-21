import json
import math
import os
import random

import bpy

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "scene_config.json")


def load_config():
  with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
    return json.load(handle)


def clear_scene():
  bpy.ops.object.select_all(action="SELECT")
  bpy.ops.object.delete(use_global=False)

  for data in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images):
    for block in list(data):
      if block.users == 0:
        data.remove(block)


def setup_scene(config):
  scene = bpy.context.scene
  scene.render.engine = "BLENDER_EEVEE"
  scene.eevee.use_bloom = True
  scene.eevee.use_soft_shadows = True
  scene.render.resolution_x = config["render_resolution"][0]
  scene.render.resolution_y = config["render_resolution"][1]
  scene.render.fps = config["fps"]
  scene.frame_end = int(config["duration_sec"] * config["fps"])
  scene.unit_settings.system = "METRIC"
  scene.unit_settings.scale_length = 1.0
  return scene


def sec_to_frame(seconds, fps):
  return int(seconds * fps)


def create_hologram_material(name, color=(0.2, 0.9, 1.0), strength=5.0, alpha=0.25):
  mat = bpy.data.materials.new(name)
  mat.use_nodes = True
  nodes = mat.node_tree.nodes
  links = mat.node_tree.links
  nodes.clear()

  output = nodes.new("ShaderNodeOutputMaterial")
  emission = nodes.new("ShaderNodeEmission")
  emission.inputs["Color"].default_value = (*color, 1.0)
  emission.inputs["Strength"].default_value = strength

  transparent = nodes.new("ShaderNodeBsdfTransparent")
  mix = nodes.new("ShaderNodeMixShader")
  mix.inputs["Fac"].default_value = alpha

  links.new(transparent.outputs[0], mix.inputs[1])
  links.new(emission.outputs[0], mix.inputs[2])
  links.new(mix.outputs[0], output.inputs[0])

  mat.blend_method = "BLEND"
  mat.shadow_method = "NONE"
  return mat


def create_map_material(image_path):
  mat = bpy.data.materials.new("MapHologram")
  mat.use_nodes = True
  nodes = mat.node_tree.nodes
  links = mat.node_tree.links
  nodes.clear()

  output = nodes.new("ShaderNodeOutputMaterial")
  emission = nodes.new("ShaderNodeEmission")
  emission.inputs["Strength"].default_value = 4.5

  transparent = nodes.new("ShaderNodeBsdfTransparent")
  mix = nodes.new("ShaderNodeMixShader")
  mix.inputs["Fac"].default_value = 0.18

  if image_path and os.path.exists(image_path):
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(image_path)
    links.new(tex.outputs["Color"], emission.inputs["Color"])
  else:
    emission.inputs["Color"].default_value = (0.3, 0.85, 1.0, 1.0)

  links.new(transparent.outputs[0], mix.inputs[1])
  links.new(emission.outputs[0], mix.inputs[2])
  links.new(mix.outputs[0], output.inputs[0])

  mat.blend_method = "BLEND"
  mat.shadow_method = "NONE"
  return mat


def add_map_plane(config):
  bpy.ops.mesh.primitive_plane_add(size=config["map_plane_size_m"])
  plane = bpy.context.active_object
  plane.name = "SiteMap"
  plane.location = config["map_offset"]
  plane.rotation_euler[2] = math.radians(config["map_rotation_deg"])

  map_image = config.get("map_image")
  if map_image and os.path.isabs(map_image):
    image_path = map_image
  else:
    image_path = os.path.join(os.path.dirname(BASE_DIR), map_image or "")
  material = create_map_material(image_path)
  plane.data.materials.append(material)
  return plane


def add_ground_plane(size=320):
  bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, -0.02))
  ground = bpy.context.active_object
  ground.name = "Ground"
  ground.data.materials.append(create_hologram_material("GroundGlow", (0.05, 0.12, 0.18), 1.5, 0.4))
  return ground


def add_building(name, location, size, height, appear_start, appear_end, material):
  bpy.ops.mesh.primitive_cube_add(size=1, location=(location[0], location[1], height / 2))
  building = bpy.context.active_object
  building.name = name
  building.scale = (size[0] / 2, size[1] / 2, height / 2)
  building.data.materials.append(material)

  base_scale = building.scale.copy()
  building.scale.z = 0.02
  building.keyframe_insert(data_path="scale", frame=appear_start)
  building.scale.z = base_scale.z
  building.keyframe_insert(data_path="scale", frame=appear_end)

  return building


def add_buildings(config, fps):
  buildings = config.get("buildings", [])
  holo_material = create_hologram_material("BuildingHolo", (0.45, 0.95, 1.0), 6.5, 0.15)

  appear_start = sec_to_frame(120, fps)
  appear_end = sec_to_frame(150, fps)

  for item in buildings:
    add_building(
      item["name"],
      item["location"],
      item["size"],
      item["height"],
      item.get("appear_start", appear_start),
      item.get("appear_end", appear_end),
      holo_material
    )

  auto = config.get("auto_buildings", {})
  if not auto.get("enabled"):
    return

  count = auto.get("count", 40)
  bounds = auto.get("bounds", [-80, 80, -80, 80])
  size_min, size_max = auto.get("size_range", [6, 10])
  g2_ratio = auto.get("g2_ratio", 0.25)

  random.seed(7)
  for idx in range(count):
    x = random.uniform(bounds[0], bounds[1])
    y = random.uniform(bounds[2], bounds[3])
    size = random.uniform(size_min, size_max)
    height = 10 if idx < int(count * g2_ratio) else 7
    add_building(
      f"AutoPlot-{idx+1}",
      (x, y, 0),
      (size, size * 1.2),
      height,
      appear_start,
      appear_end,
      holo_material
    )


def add_clubhouse(config, fps):
  clubhouse = config.get("clubhouse")
  if not clubhouse:
    return

  material = create_hologram_material("ClubhouseGlow", (0.25, 1.0, 0.75), 6.5, 0.1)
  add_building(
    "Clubhouse",
    clubhouse["location"],
    clubhouse["size"],
    clubhouse["height"],
    clubhouse.get("appear_start", sec_to_frame(150, fps)),
    clubhouse.get("appear_end", sec_to_frame(170, fps)),
    material
  )


def add_camera_rig(config, scene):
  curve_data = bpy.data.curves.new("CameraPath", type="CURVE")
  curve_data.dimensions = "3D"
  spline = curve_data.splines.new("POLY")
  spline.points.add(len(config["camera_path"]) - 1)

  for i, point in enumerate(config["camera_path"]):
    spline.points[i].co = (point[0], point[1], point[2], 1)

  curve_obj = bpy.data.objects.new("CameraPath", curve_data)
  scene.collection.objects.link(curve_obj)

  camera_data = bpy.data.cameras.new("Camera")
  camera = bpy.data.objects.new("Camera", camera_data)
  camera.data.lens = 28
  scene.collection.objects.link(camera)
  scene.camera = camera

  follow = camera.constraints.new("FOLLOW_PATH")
  follow.target = curve_obj
  follow.use_curve_follow = True
  curve_obj.data.path_duration = scene.frame_end
  follow.offset_factor = 0.0
  follow.keyframe_insert(data_path="offset_factor", frame=1)
  follow.offset_factor = 1.0
  follow.keyframe_insert(data_path="offset_factor", frame=scene.frame_end)

  target = bpy.data.objects.new("LookAtTarget", None)
  target.location = config["look_at"]
  scene.collection.objects.link(target)

  track = camera.constraints.new("TRACK_TO")
  track.target = target
  track.track_axis = "TRACK_NEGATIVE_Z"
  track.up_axis = "UP_Y"


def add_lights():
  bpy.ops.object.light_add(type="AREA", location=(30, -20, 60))
  light = bpy.context.active_object
  light.data.energy = 2500
  light.data.size = 40

  bpy.ops.object.light_add(type="POINT", location=(-40, 40, 45))
  fill = bpy.context.active_object
  fill.data.energy = 800


def main():
  config = load_config()
  clear_scene()
  scene = setup_scene(config)
  add_ground_plane()
  add_map_plane(config)
  add_buildings(config, config["fps"])
  add_clubhouse(config, config["fps"])
  add_camera_rig(config, scene)
  add_lights()


if __name__ == "__main__":
  main()
