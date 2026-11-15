export const CLIENT_CHECK_ID = '6f1c9a2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
export const CHECK_ID = '2026-11-15T08:00:00.000Z';
export const OBSERVED_AT = '2026-11-15T08:00:00.000Z';
export const CREW_ID = 'crew-a1b2c3';
export const MISSION_DAY = 23;

export function validSyncCheck() {
  const readings = {
    sleep: {
      sensor: 'sleep',
      level: 'green',
      phase: 'confirmed',
      value: '7 h',
      outsideNormal: false,
      teamCriterion: false,
      reason: null,
    },
    pulse: {
      sensor: 'pulse',
      level: 'green',
      phase: 'confirmed',
      value: '62 lpm',
      outsideNormal: false,
      teamCriterion: false,
      reason: null,
    },
    pressure: {
      sensor: 'pressure',
      level: 'green',
      phase: 'confirmed',
      value: '118/76',
      outsideNormal: false,
      teamCriterion: false,
      reason: null,
    },
    temperature: {
      sensor: 'temperature',
      level: 'green',
      phase: 'confirmed',
      value: '36.6 °C',
      outsideNormal: false,
      teamCriterion: false,
      reason: null,
    },
    oxygen: {
      sensor: 'oxygen',
      level: 'green',
      phase: 'confirmed',
      value: '98 %',
      outsideNormal: false,
      teamCriterion: false,
      reason: null,
    },
  };

  return {
    clientCheckId: CLIENT_CHECK_ID,
    crewId: CREW_ID,
    kind: 'daily',
    missionDay: MISSION_DAY,
    check: {
      id: CHECK_ID,
      observations: [
        {
          indicator: 'sleep_hours',
          source: 'voice',
          confirmed: true,
          simulated: false,
          at: OBSERVED_AT,
          value: 7,
        },
        {
          indicator: 'mood',
          source: 'voice',
          confirmed: true,
          simulated: false,
          at: OBSERVED_AT,
          value: 4,
        },
        {
          indicator: 'resting_heart_rate',
          source: 'device',
          confirmed: true,
          simulated: true,
          at: OBSERVED_AT,
          value: 62,
        },
        {
          indicator: 'blood_pressure',
          source: 'device',
          confirmed: true,
          simulated: true,
          at: OBSERVED_AT,
          value: { systolic: 118, diastolic: 76 },
        },
        {
          indicator: 'body_temperature',
          source: 'device',
          confirmed: true,
          simulated: true,
          at: OBSERVED_AT,
          value: 36.6,
        },
        {
          indicator: 'oxygen_saturation',
          source: 'device',
          confirmed: true,
          simulated: true,
          at: OBSERVED_AT,
          value: 98,
        },
      ],
      symptoms: ['none'],
      readings,
      verdict: 'ok',
      actionKey: '',
      simulated: false,
    },
  };
}

