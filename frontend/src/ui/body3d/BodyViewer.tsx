import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { SensorKey } from '@base-vital/contracts';
import { useState } from 'react';
import {
  BODY_AMBIENT_INTENSITY,
  BODY_CAMERA_FOV,
  BODY_CAMERA_POSITION,
  BODY_CAMERA_TARGET,
  BODY_DASHED_RING_POINTS,
  BODY_DASH_DOT_GEOMETRY,
  BODY_DOT_GEOMETRY,
  BODY_DPR,
  BODY_EMISSIVE_INTENSITY,
  BODY_FILL_LIGHT_INTENSITY,
  BODY_HTML_DISTANCE_FACTOR,
  BODY_KEY_LIGHT_INTENSITY,
  BODY_LIGHT_POSITIONS,
  BODY_MATERIAL_METALNESS,
  BODY_MATERIAL_ROUGHNESS,
  BODY_MODEL_COLOR,
  BODY_ORBIT_LIMITS,
  BODY_PARTS,
  BODY_RING_GEOMETRY,
  BODY_RING_LABEL_OFFSET,
  BODY_SELECTED_SCALE,
  BODY_SPHERE_GEOMETRY,
  BODY_UNLIT_COLOR,
  BODY_SENSOR_POSITIONS,
} from '../../config/bodyPreview';
import { LEVEL_COLORS, SENSOR_COLORS } from '../../config/constants';
import type { HomeMetricPreview } from '../../config/homePreview';
import { t } from '../../config/messages.es';

interface BodyViewerProps {
  metrics: HomeMetricPreview[];
  selectedSensor: SensorKey | null;
  onSensorTap: (sensor: SensorKey) => void;
}

const FALLBACK_POSITIONS: Record<SensorKey, string> = {
  sleep: 'sensor-point--sleep',
  pulse: 'sensor-point--pulse',
  pressure: 'sensor-point--pressure',
  temperature: 'sensor-point--temperature',
  oxygen: 'sensor-point--oxygen',
};

export function BodyViewer({ metrics, selectedSensor, onSensorTap }: BodyViewerProps) {
  const [webglAvailable] = useState(
    () => typeof window !== 'undefined' && 'WebGLRenderingContext' in window,
  );

  if (!webglAvailable) {
    return (
      <BodyFallback
        metrics={metrics}
        selectedSensor={selectedSensor}
        onSensorTap={onSensorTap}
      />
    );
  }

  return (
    <>
      <Canvas
        camera={{ position: BODY_CAMERA_POSITION, fov: BODY_CAMERA_FOV }}
        fallback={
          <BodyFallback
            metrics={metrics}
            selectedSensor={selectedSensor}
            onSensorTap={onSensorTap}
          />
        }
        dpr={BODY_DPR}
      >
        <ambientLight intensity={BODY_AMBIENT_INTENSITY} />
        <directionalLight position={BODY_LIGHT_POSITIONS[0]} intensity={BODY_KEY_LIGHT_INTENSITY} />
        <directionalLight position={BODY_LIGHT_POSITIONS[1]} intensity={BODY_FILL_LIGHT_INTENSITY} />
        <group>
          <Anatomy />
          {metrics.map((metric) => (
            <SensorMarker
              key={metric.sensor}
              metric={metric}
              selected={selectedSensor === metric.sensor}
              onSelect={onSensorTap}
            />
          ))}
        </group>
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={BODY_ORBIT_LIMITS.minPolarAngle}
          maxPolarAngle={BODY_ORBIT_LIMITS.maxPolarAngle}
          target={BODY_CAMERA_TARGET}
        />
      </Canvas>
      <div className="body-viewer-controls">
        {metrics.map((metric) => (
          <button
            key={metric.sensor}
            type="button"
            aria-pressed={selectedSensor === metric.sensor}
            onClick={() => onSensorTap(metric.sensor)}
          >
            {t('home.bodyDot', {
              sensor: t(`home.metric.${metric.sensor}`),
              level: t(`level.${metric.level}`),
            })}
          </button>
        ))}
      </div>
    </>
  );
}

function Anatomy() {
  return (
    <group>
      {Object.values(BODY_PARTS).map((part, index) => (
        <mesh key={index} position={part.position} scale={part.scale} castShadow receiveShadow>
          <sphereGeometry args={BODY_SPHERE_GEOMETRY} />
          <meshStandardMaterial
            color={BODY_MODEL_COLOR}
            roughness={BODY_MATERIAL_ROUGHNESS}
            metalness={BODY_MATERIAL_METALNESS}
          />
        </mesh>
      ))}
    </group>
  );
}

function SensorMarker({
  metric,
  selected,
  onSelect,
}: {
  metric: HomeMetricPreview;
  selected: boolean;
  onSelect: (sensor: SensorKey) => void;
}) {
  const position = BODY_SENSOR_POSITIONS[metric.sensor];
  const statusColor =
    metric.level === 'unknown'
      ? LEVEL_COLORS.unknown.fill
      : LEVEL_COLORS[metric.level].ring;
  const markerColor = statusColor ?? SENSOR_COLORS[metric.sensor];
  const sensorName = t(`home.metric.${metric.sensor}`);
  const levelName = t(`level.${metric.level}`);
  const label =
    metric.level === 'green'
      ? null
      : t('home.sensorLabel', { sensor: sensorName, level: levelName });

  return (
    <group position={position} onClick={(event) => {
      event.stopPropagation();
      onSelect(metric.sensor);
    }}>
      {(metric.level === 'amber' || metric.level === 'red') && (
        <mesh>
          <torusGeometry args={BODY_RING_GEOMETRY} />
          <meshBasicMaterial color={statusColor ?? SENSOR_COLORS[metric.sensor]} />
        </mesh>
      )}
      {metric.level === 'in_doubt' &&
        BODY_DASHED_RING_POINTS.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={BODY_DASH_DOT_GEOMETRY} />
            <meshBasicMaterial color={LEVEL_COLORS.in_doubt.label} />
          </mesh>
        ))}
      <mesh scale={selected ? BODY_SELECTED_SCALE : 1}>
        <sphereGeometry args={BODY_DOT_GEOMETRY} />
        <meshStandardMaterial
          color={markerColor}
          emissive={selected ? SENSOR_COLORS[metric.sensor] : BODY_UNLIT_COLOR}
          emissiveIntensity={selected ? BODY_EMISSIVE_INTENSITY : 0}
        />
      </mesh>
      {label && (
        <Html position={BODY_RING_LABEL_OFFSET} center distanceFactor={BODY_HTML_DISTANCE_FACTOR}>
          <span className={`body-3d-label body-3d-label--${metric.level}`}>{label}</span>
        </Html>
      )}
    </group>
  );
}

function BodyFallback({ metrics, selectedSensor, onSensorTap }: BodyViewerProps) {
  return (
    <div className="body-fallback">
      <div className="body-glow body-glow--one" />
      <div className="body-glow body-glow--two" />
      <svg className="body-silhouette" viewBox="0 0 300 440" role="img" aria-label={t('home.bodyLabel')}>
        <defs>
          <linearGradient id="body-fill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--body-tone-light)" />
            <stop offset="1" stopColor="var(--body-tone-dark)" />
          </linearGradient>
        </defs>
        <ellipse cx="150" cy="68" rx="34" ry="42" fill="url(#body-fill)" />
        <path d="M119 111c-22 8-39 21-48 44l-28 97c-4 14 16 22 22 8l33-78-7 74-8 128c-1 18 25 19 27 1l17-113 8 1 17 112c3 18 29 15 27-3l-8-126-7-74 34 78c6 14 26 6 22-8l-29-97c-9-23-26-36-48-44-11 13-27 13-42 0Z" fill="url(#body-fill)" />
        <path d="M150 123v241M112 173l-24 66m100-66 24 66" fill="none" stroke="var(--body-outline)" strokeLinecap="round" strokeWidth="2" />
        <path d="M130 118c6 8 14 11 20 11s14-3 20-11" fill="none" stroke="var(--body-outline)" strokeWidth="2" />
      </svg>
      {metrics.map((metric) => (
        <button
          className={`sensor-point ${FALLBACK_POSITIONS[metric.sensor]} ${metric.level !== 'green' ? `sensor-point--${metric.level}` : ''} ${selectedSensor === metric.sensor ? 'is-selected' : ''}`}
          key={metric.sensor}
          type="button"
          aria-label={t('home.bodyDot', {
            sensor: t(`home.metric.${metric.sensor}`),
            level: t(`level.${metric.level}`),
          })}
          aria-pressed={selectedSensor === metric.sensor}
          onClick={() => onSensorTap(metric.sensor)}
        >
          <span />
          {metric.level !== 'green' && (
            <span className="sensor-point-label">
              {t('home.sensorLabel', {
                sensor: t(`home.metric.${metric.sensor}`),
                level: t(`level.${metric.level}`),
              })}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
