import { useEffect, useMemo, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { CheckRecord, SensorKey } from '@base-vital/contracts';
import { buildHomeView, type Connectivity } from '../../application/use-cases/buildHomeView';
import { previousChecksBefore } from '../../application/use-cases/previousChecks';
import { DEMO_AGENDA } from '../../config/agenda';
import { CHECKIN_PATH, HISTORY_PATH, HOME_REFRESH_MS } from '../../config/constants';
import { LUNAR_CYCLE_OFFSET_DAYS, LUNAR_DARK_DAYS, LUNAR_LIGHT_DAYS, MISSION } from '../../config/mission';
import { t } from '../../config/messages.es';
import { useAppServices } from '../AppServices';
import { LazyBodyViewer } from '../body3d/LazyBodyViewer';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { CardHeader } from '../components/CardHeader';
import { DemoScenarioSelect } from '../components/DemoScenarioSelect';
import { HomeHeader } from '../components/HomeHeader';
import { Legend } from '../components/Legend';
import { MetricRows } from '../components/MetricRows';
import { NextList } from '../components/NextList';
import { NowCard } from '../components/NowCard';
import { StatusHeader } from '../components/StatusHeader';

/** Latest record whose local calendar day is the same as `now`'s, else null. */
function latestCheckOn(records: readonly CheckRecord[], now: Date): CheckRecord | null {
  const day = now.toDateString();
  let latest: CheckRecord | null = null;
  for (const record of records) {
    const at = new Date(record.id);
    if (at.toDateString() !== day) continue;
    if (latest === null || at.getTime() > new Date(latest.id).getTime()) latest = record;
  }
  return latest;
}

/** Starts the voice recognizer's model download. Errors are ignored: the check-in still shows captions and buttons. */
function preloadQuietly(preload: () => Promise<void>): void {
  try {
    preload().catch(() => undefined);
  } catch {
    // A synchronous failure is ignored for the same reason as an async one.
  }
}

/** Home screen (FR-014, FR-015, FR-018, RF1). The view is rebuilt on connectivity change and every minute. */
export function Home() {
  const container = useAppServices();
  const history = useHistory();
  const [now, setNow] = useState<Date>(() => container.clock.now());
  const [online, setOnline] = useState<boolean>(() => container.connectivity.isOnline());
  const [records, setRecords] = useState<CheckRecord[]>([]);
  /** Sensor tapped on the body; it is the viewer's focus and, in Phase 7, the highlighted metric row. */
  const [selectedSensor, setSelectedSensor] = useState<SensorKey | null>(null);

  useEffect(() => {
    preloadQuietly(() => container.recognizer.preload());
  }, [container]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      setNow(container.clock.now());
      container.repository.list().then(
        (list) => {
          if (active) setRecords(list);
        },
        () => {
          if (active) setRecords([]);
        },
      );
    };
    refresh();
    const timer = setInterval(refresh, HOME_REFRESH_MS);
    const unsubscribe = container.connectivity.subscribe(setOnline);
    return () => {
      active = false;
      clearInterval(timer);
      unsubscribe();
    };
  }, [container]);

  const view = useMemo(() => {
    const connectivity: Connectivity = online ? 'online' : 'offline';
    return buildHomeView({
      now,
      agenda: DEMO_AGENDA,
      lastCheckToday: latestCheckOn(records, now),
      previousChecks: previousChecksBefore(records, now),
      connectivity,
      mission: {
        ...MISSION,
        lightDays: LUNAR_LIGHT_DAYS,
        darkDays: LUNAR_DARK_DAYS,
        offsetDays: LUNAR_CYCLE_OFFSET_DAYS,
      },
    });
  }, [now, records, online]);

  const startCheckin = () => {
    history.push({ pathname: CHECKIN_PATH, state: { autostart: true } });
  };

  return (
    <main className="min-h-screen bg-canvas">
      <HomeHeader header={view.header} />
      <div className="mx-auto flex max-w-content flex-col gap-xl px-page pb-dockClearance pt-lg">
        <div className="grid grid-cols-12 items-stretch gap-xl">
          <div className="col-span-4 flex flex-col gap-xl">
            {view.now !== null && <NowCard now={view.now} onStart={startCheckin} />}
            <NextList next={view.next} pendingToday={view.pendingToday} />
          </div>
          <section className="col-span-8 flex flex-col">
            <Card className="flex flex-1 flex-col gap-sm">
              <CardHeader
                label={t('home.howAreYou')}
                trailing={
                  <Link to={HISTORY_PATH} className="inline-flex items-center gap-xs text-small font-semibold text-primary">
                    {t('nav.health')}
                    <ArrowRight aria-hidden="true" className="h-lg w-lg" />
                  </Link>
                }
              />
              <div className="flex flex-1 gap-md">
                <div className="flex w-2/5 flex-col items-center gap-sm">
                  <LazyBodyViewer
                    readings={view.status.readings}
                    focus={selectedSensor}
                    evaluated={view.status.verdict !== 'none'}
                    onSensorTap={setSelectedSensor}
                  />
                  <p className="text-meta text-ink-secondary">{t('body.tapSensor')}</p>
                </div>
                <div className="flex w-3/5 flex-col gap-sm rounded-card bg-canvas p-sm">
                  <StatusHeader
                    crewName={view.header.crewName}
                    verdict={view.status.verdict}
                    mood={view.status.mood}
                    trailing={
                      <Link
                        to={HISTORY_PATH}
                        className="inline-flex items-center gap-xs whitespace-nowrap text-small font-semibold text-primary"
                      >
                        {t('home.history')}
                        <ArrowRight aria-hidden="true" className="h-lg w-lg" />
                      </Link>
                    }
                  />
                  <MetricRows
                    readings={view.status.readings}
                    focus={selectedSensor}
                    onSelect={setSelectedSensor}
                  />
                  <div className="mt-auto flex flex-col items-end gap-xs">
                    <Legend />
                  </div>
                </div>
              </div>
            </Card>
          </section>
        </div>
        <div className="text-meta text-ink-secondary">
          <DemoScenarioSelect
            currentId={container.scenario.id}
            repository={container.repository}
            reseed={container.reseedHistory}
            storage={container.storage}
            onChanged={() => window.location.reload()}
          />
        </div>
      </div>
      <BottomNav active="home" onVita={startCheckin} />
    </main>
  );
}
