/**
 * Checks `frontend/public/models/body.glb` against contracts/body-glb.md. Exit 0 when every rule
 * passes, exit 1 (listing every failure) otherwise.
 *
 * Usage: `npm run check:model` (defaults to the body.glb above), or
 *        `npx tsx frontend/scripts/check-model.ts <path/to/model.glb>`.
 */

import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, type Mesh, type Node } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import {
  BODY_CAMERA_FOV_DEG,
  BODY_FALLBACK_SIZE,
  BODY_FIT_MARGIN,
} from '../src/config/constants';
import {
  BODY_NODE_NAME,
  BYTES_PER_MIB,
  MAX_MODEL_MIB,
  MAX_BODY_TRIANGLES,
  MAX_SENSOR_DISTANCE_M,
  MM_DECIMALS,
  MM_PER_M,
  SENSOR_NODE_NAMES,
  evaluateModel,
  frontCameraPosition,
  pointSurfaceDistance,
  sensorHiddenFromCamera,
  transformPoint,
  triangleBounds,
  type FrontFraming,
  type Triangle,
  type Vec3,
} from './checkModelRules';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODEL_PATH = resolve(SCRIPT_DIR, '../public/models/body.glb');

/** The viewer's framing at the fallback image's aspect, so both show the same front view. */
const FRONT_FRAMING: FrontFraming = {
  verticalFovDeg: BODY_CAMERA_FOV_DEG,
  aspect: BODY_FALLBACK_SIZE.width / BODY_FALLBACK_SIZE.height,
  margin: BODY_FIT_MARGIN,
};

/** glTF primitive mode for TRIANGLES (GL_TRIANGLES). */
const GLTF_MODE_TRIANGLES = 4;
const MIB_DECIMALS = 2;
const POSITION_DECIMALS = 3;
const VERTICES_PER_TRIANGLE = 3;
const CORNER_A = 0;
const CORNER_B = 1;
const CORNER_C = 2;
const EXIT_FAILURE = 1;

/** World-space triangles of every primitive of the node's mesh. */
function worldTriangles(node: Node, mesh: Mesh): Triangle[] {
  const world = node.getWorldMatrix();
  const triangles: Triangle[] = [];
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== GLTF_MODE_TRIANGLES) {
      throw new Error(`"${BODY_NODE_NAME}" uses a primitive mode other than TRIANGLES`);
    }
    const position = prim.getAttribute('POSITION');
    if (!position) throw new Error(`"${BODY_NODE_NAME}" has a primitive without POSITION`);

    const indices = prim.getIndices()?.getArray() ?? null;
    const corners = indices ? indices.length : position.getCount();
    const vertexAt = (k: number): Vec3 => {
      const vertex = indices ? indices[k] : k;
      const [x, y, z] = position.getElement(vertex, [0, 0, 0]);
      return transformPoint(world, [x, y, z]);
    };
    for (let k = 0; k < corners; k += VERTICES_PER_TRIANGLE) {
      triangles.push([vertexAt(k + CORNER_A), vertexAt(k + CORNER_B), vertexAt(k + CORNER_C)]);
    }
  }
  return triangles;
}

function resolveModelPath(argument: string | undefined): string {
  return argument ? resolve(process.cwd(), argument) : DEFAULT_MODEL_PATH;
}

function formatMib(bytes: number): string {
  return (bytes / BYTES_PER_MIB).toFixed(MIB_DECIMALS);
}

async function main(): Promise<number> {
  const modelPath = resolveModelPath(process.argv[2]);
  const fileBytes = statSync(modelPath).size;

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const document = await io.read(modelPath);
  const nodes = document.getRoot().listNodes();

  const bodyNode = nodes.find((node) => node.getName() === BODY_NODE_NAME);
  const bodyMesh = bodyNode?.getMesh() ?? null;
  const bodyTriangles = bodyNode && bodyMesh ? worldTriangles(bodyNode, bodyMesh) : [];

  const bounds = triangleBounds(bodyTriangles);
  const frontCamera: Vec3 | null = bounds ? frontCameraPosition(bounds, FRONT_FRAMING) : null;

  const sensorDistancesM: Record<string, number> = {};
  const sensorsHiddenFromFront: string[] = [];
  for (const sensorName of SENSOR_NODE_NAMES) {
    const sensor = nodes.find((node) => node.getName() === sensorName);
    if (sensor && bodyMesh) {
      const position = sensor.getWorldTranslation();
      sensorDistancesM[sensorName] = pointSurfaceDistance(position, bodyTriangles);
      if (frontCamera && sensorHiddenFromCamera(position, frontCamera, bodyTriangles)) {
        sensorsHiddenFromFront.push(sensorName);
      }
    }
  }

  const facts = {
    nodeNames: nodes.map((node) => node.getName()),
    bodyTriangleCount: bodyNode ? (bodyMesh ? bodyTriangles.length : null) : null,
    fileBytes,
    sensorDistancesM,
    sensorsHiddenFromFront,
  };
  const failures = evaluateModel(facts);

  console.log(`model: ${modelPath}`);
  console.log(`triangles: ${bodyTriangles.length} (max ${MAX_BODY_TRIANGLES})`);
  console.log(`size: ${formatMib(fileBytes)} MiB (max ${MAX_MODEL_MIB} MiB)`);
  if (frontCamera) {
    const [cx, cy, cz] = frontCamera.map((c) => c.toFixed(POSITION_DECIMALS));
    console.log(`front camera: (${cx}, ${cy}, ${cz}) m`);
  }
  for (const sensorName of SENSOR_NODE_NAMES) {
    const distance = sensorDistancesM[sensorName];
    const value =
      distance === undefined
        ? 'not measured (node or body missing)'
        : `${(distance * MM_PER_M).toFixed(MM_DECIMALS)} mm from body surface`;
    const visibility =
      distance === undefined
        ? ''
        : sensorsHiddenFromFront.includes(sensorName)
          ? ', HIDDEN from front'
          : ', visible from front';
    console.log(`${sensorName}: ${value} (max ${MAX_SENSOR_DISTANCE_M * MM_PER_M} mm)${visibility}`);
  }

  if (failures.length === 0) {
    console.log('PASS');
    return 0;
  }
  console.error(`FAIL: ${failures.length} rule(s) broken`);
  for (const failure of failures) console.error(`  - ${failure}`);
  return EXIT_FAILURE;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = EXIT_FAILURE;
  });
