import { describe, it, expect } from 'vitest';
import { Indicator, Source, Observation, CheckRecord, SensorReading } from '../../src/contracts';

const AT = '2026-11-15T07:00:00.000Z';

// Minimal valid fixtures.
const voiceSleepObservation = {
  indicator: 'sleep_hours',
  value: 7.5,
  source: 'voice',
  confirmed: true,
  simulated: false,
  at: AT,
};

const deviceHeartRateObservation = {
  indicator: 'resting_heart_rate',
  value: 62,
  source: 'device',
  confirmed: true,
  simulated: true,
  at: AT,
};

const greenReading = (sensor: string, value: string) => ({
  sensor,
  level: 'green',
  phase: 'confirmed',
  value,
  outsideNormal: false,
  reason: null,
});

const readings = {
  sleep: greenReading('sleep', '7,5 h'),
  pulse: greenReading('pulse', '62 bpm'),
  pressure: greenReading('pressure', '112/72'),
  temperature: greenReading('temperature', '36,7 °C'),
  oxygen: greenReading('oxygen', '98 %'),
};

const validCheckRecord = {
  id: AT,
  observations: [voiceSleepObservation, deviceHeartRateObservation],
  symptoms: ['none'],
  readings,
  verdict: 'ok',
  actionKey: 'action.ok',
  simulated: false,
};

describe('Indicator', () => {
  it('has no face_fatigue (camera is out of scope)', () => {
    expect(Indicator.options).not.toContain('face_fatigue');
    expect(Indicator.safeParse('face_fatigue').success).toBe(false);
  });

  it('accepts the six real indicators', () => {
    for (const value of [
      'sleep_hours',
      'mood',
      'resting_heart_rate',
      'blood_pressure',
      'body_temperature',
      'oxygen_saturation',
    ]) {
      expect(Indicator.safeParse(value).success).toBe(true);
    }
  });
});

describe('Source', () => {
  it('is only voice | device', () => {
    expect([...Source.options].sort()).toEqual(['device', 'voice']);
    expect(Source.safeParse('camera').success).toBe(false);
    expect(Source.safeParse('voice').success).toBe(true);
    expect(Source.safeParse('device').success).toBe(true);
  });
});

describe('Observation', () => {
  it('accepts a valid confirmed voice observation', () => {
    expect(Observation.safeParse(voiceSleepObservation).success).toBe(true);
  });

  it('accepts a device observation', () => {
    expect(Observation.safeParse(deviceHeartRateObservation).success).toBe(true);
  });

  it('accepts sleep_hours at the 0–16 bounds and in 0.5 steps', () => {
    for (const value of [0, 0.5, 7.5, 16]) {
      expect(Observation.safeParse({ ...voiceSleepObservation, value }).success).toBe(true);
    }
  });

  it('rejects sleep_hours outside 0–16', () => {
    for (const value of [-0.5, 16.5, 24]) {
      expect(Observation.safeParse({ ...voiceSleepObservation, value }).success).toBe(false);
    }
  });

  it('rejects sleep_hours that is not a multiple of 0.5', () => {
    for (const value of [7.3, 7.25, 0.1]) {
      expect(Observation.safeParse({ ...voiceSleepObservation, value }).success).toBe(false);
    }
  });

  it('accepts mood as an integer 1–5', () => {
    for (const value of [1, 3, 5]) {
      expect(
        Observation.safeParse({ ...voiceSleepObservation, indicator: 'mood', value }).success,
      ).toBe(true);
    }
  });

  it('rejects mood outside integer 1–5', () => {
    for (const value of [0, 6, 3.5, -1]) {
      expect(
        Observation.safeParse({ ...voiceSleepObservation, indicator: 'mood', value }).success,
      ).toBe(false);
    }
  });
});

describe('CheckRecord', () => {
  it('accepts a valid record with a confirmed voice observation and device observation', () => {
    expect(CheckRecord.safeParse(validCheckRecord).success).toBe(true);
  });

  it('rejects a voice observation with confirmed: false (Principle IX)', () => {
    const record = {
      ...validCheckRecord,
      observations: [{ ...voiceSleepObservation, confirmed: false }],
    };
    expect(CheckRecord.safeParse(record).success).toBe(false);
  });
});

describe('SensorReading', () => {
  const reading = {
    sensor: 'sleep',
    level: 'amber',
    phase: 'confirmed',
    value: '5 h',
    outsideNormal: false,
  };

  it('accepts reason as an Indicator', () => {
    expect(SensorReading.safeParse({ ...reading, reason: 'mood' }).success).toBe(true);
  });

  it('accepts reason as null (green)', () => {
    expect(SensorReading.safeParse({ ...reading, level: 'green', reason: null }).success).toBe(
      true,
    );
  });

  it('rejects reason that is not an Indicator', () => {
    expect(SensorReading.safeParse({ ...reading, reason: 'face_fatigue' }).success).toBe(false);
    expect(SensorReading.safeParse({ ...reading, reason: 'camera' }).success).toBe(false);
  });
});
