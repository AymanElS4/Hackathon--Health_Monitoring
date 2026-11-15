"""Build body.glb (skin + sensor empties + camera) and body-fallback.png from the MakeHuman base mesh.

Usage (from the repo root):
  /snap/bin/blender --background --factory-startup \
    --python frontend/scripts/blender/create_sensor_empties.py -- <in.obj> <out_dir>

Pipeline: import OBJ split by group -> keep only group `body` -> join -> decimeters to meters ->
feet on z=0, centered on x/y -> apply transforms -> triangulate (collapse-decimate if > MAX_TRIANGLES)
-> material skin_pearl -> sensor empties on the skin (index-finger joints read at import) ->
camera_default -> export GLB -> render fallback.

Blender axes: +Z up, the figure's front is -Y, the figure's left is +X. The glTF exporter maps
Blender Z-up to glTF Y-up. Node names are a fixed API (see CLAUDE.md): do not rename.
"""

import json
import math
import os
import sys

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

# ----------------------------------------------------------------------------- constants

SOURCE_UNIT_SCALE = 0.1  # the MakeHuman OBJ is in decimeters; scale to meters
SKIN_GROUP = "body"  # the only OBJ group kept; every helper-* and joint-* group is deleted
SKIN_MATERIAL = "skin_pearl"
SKIN_HEX = "#D9DDE2"
SKIN_ROUGHNESS = 0.6

MAX_TRIANGLES = 30000
DECIMATE_TARGET_TRIANGLES = 29000  # collapse target, only used when the mesh is over MAX_TRIANGLES

SURFACE_OFFSET_M = 0.002  # sensor empties sit 2 mm off the skin, along the outward normal
RAY_BACKOFF_M = 1.0  # rays start this far outside the body, so they hit the outermost skin
EMPTY_DISPLAY_SIZE = 0.02

# Every sensor is cast from the front (-Y, which is +Z in glTF), so each one sits on the skin the
# front camera sees. Each entry: (x, z). The ray runs from the front toward the back (+Y).
RAY_FRONT = Vector((0.0, 1.0, 0.0))

PRESSURE_Z_M = 1.25
LANDMARKS = {
    "sensor_sleep": (0.00, 1.60),  # center of forehead
    "sensor_pulse": (0.05, 1.25),  # figure's left chest, over the heart
    "sensor_pressure": (None, PRESSURE_Z_M),  # right upper arm, mid-biceps; x from the arm
    "sensor_temperature": (None, None),  # navel; x and z from the navel dimple
}

# Temperature: the navel is a recess in the front of the abdomen. Its deepest front vertex is the
# one with the largest y (least negative, most posterior) among front vertices near the midline
# and in this height band (meters).
NAVEL_HALF_WIDTH_M = 0.02
NAVEL_Z_RANGE_M = (0.95, 1.05)

# Pressure: the arm centerline x is the median x of right-arm vertices in this slice (x range
# and height band, meters).
ARM_SLICE_X_M = (-0.40, -0.24)
ARM_SLICE_Z_M = 1.25
ARM_SLICE_HALF_HEIGHT_M = 0.03

# Oxygen: the tip of the figure's right index finger. The MakeHuman skeleton joint cubes give the
# finger: `joint-r-finger-2-4` is the index fingertip end joint, `joint-r-finger-2-3` the one before
# it (finger 1 = thumb, 2 = index). The sensor sits on the skin closest to the tip joint, nudged
# TIP_NUDGE_M back along the finger (tip-to-previous-joint direction) so it lands on the fingertip
# pad rather than past the end.
SENSOR_OXYGEN = "sensor_oxygen"
TIP_JOINT = "joint-r-finger-2-4"
TIP_PREV_JOINT = "joint-r-finger-2-3"
TIP_NUDGE_M = 0.004
JOINTS_READ = (TIP_JOINT, TIP_PREV_JOINT)  # joint centres captured before the joint groups are deleted

CAMERA_NAME = "camera_default"
CAMERA_AZIMUTH_DEG = 0.0  # straight front, same as the viewer (CL5)
# Mirrors of src/config/constants.ts (BODY_CAMERA_FOV_DEG, BODY_FIT_MARGIN). The camera distance
# is the viewer's cameraDistanceToFit() for the render size below, so the fallback framing matches.
CAMERA_FOV_DEG = 30.0
FIT_MARGIN = 1.1
CAMERA_LENS_MM = 50.0

RENDER_WIDTH = 600
RENDER_HEIGHT = 900
RENDER_SAMPLES = 64
WORLD_GRAY = 0.15  # ambient fill strength
KEY_LIGHT_LOCATION = (1.5, -3.0, 2.8)
KEY_LIGHT_ENERGY_W = 90.0
KEY_LIGHT_SIZE_M = 3.0

GLB_NAME = "body.glb"
FALLBACK_NAME = "body-fallback.png"
SENSOR_NAMES = list(LANDMARKS.keys()) + [SENSOR_OXYGEN]


# ----------------------------------------------------------------------------- helpers


def srgb_hex_to_linear(hex_str):
    """Convert '#RRGGBB' (sRGB) to linear RGB floats, as expected by Principled BSDF."""
    values = []
    for i in (1, 3, 5):
        c = int(hex_str[i : i + 2], 16) / 255.0
        values.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(values)


def triangle_count(mesh):
    return sum(len(p.vertices) - 2 for p in mesh.polygons)


def select_only(objects, active):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active


# ----------------------------------------------------------------------------- pipeline steps


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def joint_centre(obj):
    """World-space centre of a joint cube (mean of its vertices)."""
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return sum(points, Vector()) / len(points)


def import_skin(obj_path):
    """Import the OBJ split by group, keep only the `body` group, and join it into one object.
    Returns (body, joints): the centres of JOINTS_READ, read before the joint groups are deleted."""
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(
        filepath=obj_path,
        use_split_objects=False,
        use_split_groups=True,
        import_vertex_groups=False,
        validate_meshes=False,
    )
    imported = [o for o in bpy.data.objects if o not in before]
    skin = [
        o
        for o in imported
        if o.type == "MESH" and (o.name == SKIN_GROUP or o.name.startswith(SKIN_GROUP + "."))
    ]
    joints = {o.name: joint_centre(o) for o in imported if o.name in JOINTS_READ}
    missing = set(JOINTS_READ) - set(joints)
    if missing:
        raise SystemExit(f"OBJ has no joint group(s) {sorted(missing)}")
    for obj in imported:
        if obj not in skin:
            bpy.data.objects.remove(obj, do_unlink=True)
    if not skin:
        raise SystemExit(f"OBJ has no '{SKIN_GROUP}' group")
    if len(skin) > 1:
        with bpy.context.temp_override(active_object=skin[0], selected_editable_objects=skin):
            bpy.ops.object.join()
    body = skin[0]
    body.name = SKIN_GROUP
    body.data.name = SKIN_GROUP
    return body, joints


def normalize_body(body, joints):
    """Scale to meters, apply transforms, put feet at z=0 and center on x/y. The joint centres
    get the same scale and offset as the vertices, so they stay on the body."""
    body.scale = (SOURCE_UNIT_SCALE,) * 3
    select_only([body], body)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    coords = [v.co for v in body.data.vertices]
    xs, ys, zs = [c.x for c in coords], [c.y for c in coords], [c.z for c in coords]
    offset = Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)))
    for vertex in body.data.vertices:
        vertex.co += offset
    body.data.update()
    for name in joints:
        joints[name] = joints[name] * SOURCE_UNIT_SCALE + offset
    print(f"BODY bounds_m min={tuple(round(c, 3) for c in (min(xs), min(ys), min(zs)))} "
          f"height_m={max(zs) - min(zs):.3f}")


def triangulate_and_clean(body):
    mesh = body.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    print(f"TRIANGLES_TRIANGULATED={triangle_count(mesh)} verts={len(mesh.vertices)}")


def decimate_if_needed(body):
    tris = triangle_count(body.data)
    if tris <= MAX_TRIANGLES:
        return tris
    select_only([body], body)
    modifier = body.modifiers.new(name="decimate", type="DECIMATE")
    modifier.decimate_type = "COLLAPSE"
    modifier.ratio = DECIMATE_TARGET_TRIANGLES / tris
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    tris = triangle_count(body.data)
    print(f"DECIMATED to {tris} triangles")
    return tris


def make_skin_material(body):
    material = bpy.data.materials.new(SKIN_MATERIAL)
    material.use_nodes = True
    linear = srgb_hex_to_linear(SKIN_HEX)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*linear, 1.0)
    bsdf.inputs["Roughness"].default_value = SKIN_ROUGHNESS
    material.diffuse_color = (*linear, 1.0)
    body.data.materials.clear()
    body.data.materials.append(material)


def surface_hit(body, anchor, direction):
    """Ray-cast from outside the body through `anchor`; return (point, outward normal)."""
    origin = anchor - direction * RAY_BACKOFF_M
    hit, location, normal, _ = body.ray_cast(origin, direction)
    if not hit:
        raise RuntimeError(f"no skin hit for anchor {tuple(anchor)} direction {tuple(direction)}")
    normal = normal.normalized()
    if normal.dot(direction) > 0:  # make sure the normal points out of the skin
        normal = -normal
    return location, normal


def median(values):
    ordered = sorted(values)
    return ordered[len(ordered) // 2]


def right_arm_centre_x(body):
    """Arm centerline x at PRESSURE_Z_M: median x of the right-arm vertices in the arm slice."""
    return median(
        v.co.x
        for v in body.data.vertices
        if ARM_SLICE_X_M[0] <= v.co.x <= ARM_SLICE_X_M[1]
        and abs(v.co.z - ARM_SLICE_Z_M) <= ARM_SLICE_HALF_HEIGHT_M
    )


def fingertip_surface_point(body, joints):
    """Surface point (location, outward normal) for the index fingertip. The target is the tip joint
    centre nudged TIP_NUDGE_M back along the finger (from the previous joint toward the tip)."""
    tip = joints[TIP_JOINT]
    finger = (tip - joints[TIP_PREV_JOINT]).normalized()
    target = tip - finger * TIP_NUDGE_M
    print(f"OXYGEN_TIP_JOINT blender=({tip.x:.4f}, {tip.y:.4f}, {tip.z:.4f}) m "
          f"nudged_target=({target.x:.4f}, {target.y:.4f}, {target.z:.4f}) m")
    _, location, normal, _ = body.closest_point_on_mesh(target)
    normal = normal.normalized()
    if normal.dot(location - target) < 0:  # the target is inside the finger: point the normal outward
        normal = -normal
    return location, normal


def navel_xz(body):
    """(x, z) of the navel dimple: the deepest (largest y) front vertex near the midline in the
    navel height band. Its ray from the front lands in the recess."""
    candidates = [
        v.co
        for v in body.data.vertices
        if abs(v.co.x) <= NAVEL_HALF_WIDTH_M
        and NAVEL_Z_RANGE_M[0] <= v.co.z <= NAVEL_Z_RANGE_M[1]
        and v.co.y < 0.0
    ]
    deepest = max(candidates, key=lambda c: c.y)
    return deepest.x, deepest.z


def create_sensor_empties(body, joints):
    """Place each sensor empty 2 mm off the skin; return {name: empty}. The ray sensors come from
    the front, so they sit on the skin the front camera sees. The oxygen sensor sits on the skin
    nearest the index fingertip joint."""
    surface = {}
    for name, (x, z) in LANDMARKS.items():
        if name == "sensor_pressure":
            x = right_arm_centre_x(body)
        if name == "sensor_temperature":
            x, z = navel_xz(body)
        # y=0: the ray starts in front of the body
        surface[name] = surface_hit(body, Vector((x, 0.0, z)), RAY_FRONT)
    surface[SENSOR_OXYGEN] = fingertip_surface_point(body, joints)

    empties = {}
    scene = bpy.context.scene
    for name in SENSOR_NAMES:
        point, normal = surface[name]
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = "PLAIN_AXES"
        empty.empty_display_size = EMPTY_DISPLAY_SIZE
        empty.location = point + normal * SURFACE_OFFSET_M
        scene.collection.objects.link(empty)
        empties[name] = empty
    return empties


def report_sensors(body, empties):
    for name in SENSOR_NAMES:
        loc = empties[name].location
        _, closest, _, _ = body.closest_point_on_mesh(loc)
        distance = (loc - closest).length
        gltf = (loc.x, loc.z, -loc.y)  # Blender Z-up -> glTF Y-up
        print(
            f"SENSOR {name} blender=({loc.x:.4f}, {loc.y:.4f}, {loc.z:.4f}) m "
            f"gltf=({gltf[0]:.4f}, {gltf[1]:.4f}, {gltf[2]:.4f}) m distance_to_surface={distance * 1000:.2f} mm"
        )


def aim(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def body_centre_and_size(body):
    """Bounding box centre and size in Blender axes (z up), like the viewer's Box3."""
    coords = [v.co for v in body.data.vertices]
    lo = Vector(tuple(min(c[i] for c in coords) for i in range(3)))
    hi = Vector(tuple(max(c[i] for c in coords) for i in range(3)))
    return (lo + hi) / 2, hi - lo


def fit_camera_distance(size, aspect):
    """Port of cameraDistanceToFit() in src/ui/body3d/bodyViewerModel.ts. Blender z is the glTF
    height (viewer size.y), Blender x is the width, Blender y is the depth (viewer size.z)."""
    half_tan = math.tan(math.radians(CAMERA_FOV_DEG) / 2)
    by_height = size.z / 2 / half_tan
    by_width = size.x / 2 / (half_tan * aspect)
    return max(by_height, by_width) * FIT_MARGIN + size.y / 2


def add_camera(body):
    center, size = body_centre_and_size(body)
    distance = fit_camera_distance(size, RENDER_WIDTH / RENDER_HEIGHT)
    data = bpy.data.cameras.new(CAMERA_NAME)
    data.lens = CAMERA_LENS_MM
    # Vertical fit: the vertical field of view is exactly CAMERA_FOV_DEG, as in the viewer.
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 2 * CAMERA_LENS_MM * math.tan(math.radians(CAMERA_FOV_DEG) / 2)
    camera = bpy.data.objects.new(CAMERA_NAME, data)
    bpy.context.scene.collection.objects.link(camera)
    azimuth = math.radians(CAMERA_AZIMUTH_DEG)
    camera.location = center + Vector(
        (math.sin(azimuth) * distance, -math.cos(azimuth) * distance, 0.0)
    )
    aim(camera, center)
    bpy.context.scene.camera = camera
    print(f"CAMERA centre={tuple(round(c, 4) for c in center)} distance_m={distance:.4f} "
          f"fov_deg={CAMERA_FOV_DEG}")
    return camera, center


def add_lights_and_world(center):
    scene = bpy.context.scene
    light_data = bpy.data.lights.new("key_light", "AREA")
    light_data.energy = KEY_LIGHT_ENERGY_W
    light_data.size = KEY_LIGHT_SIZE_M
    light = bpy.data.objects.new("key_light", light_data)
    light.location = Vector(KEY_LIGHT_LOCATION)
    aim(light, center)
    scene.collection.objects.link(light)

    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (WORLD_GRAY, WORLD_GRAY, WORLD_GRAY, 1.0)
    background.inputs["Strength"].default_value = 1.0
    scene.world = world


def export_glb(body, empties, camera, path):
    objects = [body, *empties.values(), camera]
    select_only(objects, body)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=True,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )


def render_fallback(empties, camera, path):
    """Render the figure with a transparent background; return the dots as % of width/height."""
    scene = bpy.context.scene
    render = scene.render
    render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = RENDER_SAMPLES
    scene.cycles.use_denoising = False
    render.film_transparent = True
    render.resolution_x = RENDER_WIDTH
    render.resolution_y = RENDER_HEIGHT
    render.resolution_percentage = 100
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    render.filepath = path
    bpy.ops.render.render(write_still=True)

    dots = {}
    for name in SENSOR_NAMES:
        x, y, _ = world_to_camera_view(scene, camera, empties[name].matrix_world.translation)
        dots[name] = {"x": round(x * 100, 1), "y": round((1 - y) * 100, 1)}
    return dots


def main():
    argv = sys.argv
    if "--" not in argv or len(argv) < argv.index("--") + 3:
        raise SystemExit("usage: blender --background --factory-startup --python "
                         "create_sensor_empties.py -- <in.obj> <out_dir>")
    in_obj, out_dir = (os.path.abspath(p) for p in argv[argv.index("--") + 1 : argv.index("--") + 3])
    os.makedirs(out_dir, exist_ok=True)

    clear_scene()
    body, joints = import_skin(in_obj)
    normalize_body(body, joints)
    triangulate_and_clean(body)
    tris = decimate_if_needed(body)
    print(f"TRIANGLES={tris} (limit {MAX_TRIANGLES})")
    make_skin_material(body)

    empties = create_sensor_empties(body, joints)
    report_sensors(body, empties)
    camera, centre = add_camera(body)
    add_lights_and_world(centre)

    glb_path = os.path.join(out_dir, GLB_NAME)
    export_glb(body, empties, camera, glb_path)
    print(f"GLB {glb_path} bytes={os.path.getsize(glb_path)}")

    dots = render_fallback(empties, camera, os.path.join(out_dir, FALLBACK_NAME))
    print("FALLBACK_DOTS=" + json.dumps(dots, separators=(",", ":")))


main()
