import { describe, it, expect } from 'vitest';
import {
  Indicator,
  Source,
  Observation,
  CheckRecord,
  SensorReading,
  AgendaItem,
  Threshold,
} from '../src';

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
  teamCriterion: false,
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
  actionKey: '',
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

  it('accepts an empty actionKey for an ok verdict (health-rules: no action when ok)', () => {
    expect(CheckRecord.safeParse({ ...validCheckRecord, actionKey: '' }).success).toBe(true);
  });

  it('rejects a non-empty actionKey for an ok verdict (ok has no action)', () => {
    expect(CheckRecord.safeParse({ ...validCheckRecord, actionKey: 'action.slept_little' }).success).toBe(false);
  });

  it('rejects an empty actionKey for attention or alert (RF9: exactly one action)', () => {
    for (const verdict of ['attention', 'alert'] as const) {
      const record = { ...validCheckRecord, verdict, actionKey: '' };
      expect(CheckRecord.safeParse(record).success).toBe(false);
    }
  });
});

describe('SensorReading', () => {
  const reading = {
    sensor: 'sleep',
    level: 'amber',
    phase: 'confirmed',
    value: '5 h',
    outsideNormal: false,
    teamCriterion: false,
  };

  it('requires teamCriterion as a boolean (data-model.md)', () => {
    const withoutFlag: Record<string, unknown> = { ...reading, reason: 'sleep_hours' };
    delete withoutFlag.teamCriterion;
    expect(SensorReading.safeParse(withoutFlag).success).toBe(false);
    expect(
      SensorReading.safeParse({ ...reading, teamCriterion: 'yes', reason: 'mood' }).success,
    ).toBe(false);
    expect(SensorReading.safeParse({ ...reading, teamCriterion: true, reason: 'mood' }).success).toBe(
      true,
    );
  });

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

describe('AgendaItem', () => {
  const fullItem = {
    id: 'daily-checkin',
    time: '09:30',
    titleKey: 'agenda.dailyCheckin',
    subtitleKey: 'agenda.eva.solarPanel',
    durationMin: 1,
    icon: 'checkin',
    action: 'start_checkin',
  };

  it('accepts a valid full item', () => {
    expect(AgendaItem.safeParse(fullItem).success).toBe(true);
  });

  it('accepts an item with only the required fields', () => {
    expect(
      AgendaItem.safeParse({ id: 'breakfast', time: '08:00', titleKey: 'agenda.breakfast' }).success,
    ).toBe(true);
  });

  it('rejects a missing id', () => {
    const withoutId: Partial<typeof fullItem> = { ...fullItem };
    delete withoutId.id;
    expect(AgendaItem.safeParse(withoutId).success).toBe(false);
  });

  it('rejects an empty id', () => {
    expect(AgendaItem.safeParse({ ...fullItem, id: '' }).success).toBe(false);
  });

  it('rejects an icon outside the allowed set', () => {
    expect(AgendaItem.safeParse({ ...fullItem, icon: 'medication' }).success).toBe(false);
  });

  it('rejects a durationMin of 0', () => {
    expect(AgendaItem.safeParse({ ...fullItem, durationMin: 0 }).success).toBe(false);
  });

  it('rejects a non-integer durationMin', () => {
    expect(AgendaItem.safeParse({ ...fullItem, durationMin: 1.5 }).success).toBe(false);
  });

  it('rejects an unknown action', () => {
    expect(AgendaItem.safeParse({ ...fullItem, action: 'take_dose' }).success).toBe(false);
  });

  it('rejects a time outside HH:mm', () => {
    expect(AgendaItem.safeParse({ ...fullItem, time: '25:00' }).success).toBe(false);
  });
});

describe('Threshold', () => {
  const entry = {
    indicator: 'blood_pressure',
    green: { max: 120 },
    amber: { min: 120, max: 140 },
    red: { min: 140 },
    source: 'AHA/ACC 2025 High Blood Pressure Guideline (systolic, mmHg)',
    sourceStatus: 'cited',
  };

  it('accepts a blood pressure entry without component (optional)', () => {
    expect(Threshold.safeParse(entry).success).toBe(true);
  });

  it('accepts component systolic and diastolic', () => {
    for (const component of ['systolic', 'diastolic']) {
      expect(Threshold.safeParse({ ...entry, component }).success).toBe(true);
    }
  });

  it('rejects a component that is not systolic or diastolic', () => {
    expect(Threshold.safeParse({ ...entry, component: 'mean' }).success).toBe(false);
    expect(Threshold.safeParse({ ...entry, component: 'Systolic' }).success).toBe(false);
  });
});
