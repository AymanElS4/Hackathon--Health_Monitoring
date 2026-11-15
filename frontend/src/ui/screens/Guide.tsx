import { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  Droplet,
  Heart,
  Moon,
  ShieldAlert,
  Thermometer,
  Wrench,
} from 'lucide-react';

import { CHECKIN_PATH, HOME_PATH } from '../../config/constants';
import { t } from '../../config/messages.es';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { useLocale } from '../useLocale';

/** Structure of one protocol. All visible text lives in the guide catalogs under `guide.<id>.*`. */
interface ProtocolDef {
  id: string;
  /** Procedure identifier (not translated). */
  code: string;
  icon: typeof Moon;
  equipmentCount: number;
  /** One entry per restriction: true when it is a No-Go checkpoint. */
  restrictions: readonly boolean[];
  /** One entry per SOP step: true when the step has a time label. */
  sop: readonly boolean[];
  hasSamples: boolean;
}

const CLINICAL_PROTOCOLS: readonly ProtocolDef[] = [
  { id: 'sleep', code: 'SOP-MED-ACT01', icon: Moon, equipmentCount: 3, restrictions: [false, false], sop: [false, false, false, false], hasSamples: false },
  { id: 'temperature', code: 'SOP-MED-PHS02', icon: Thermometer, equipmentCount: 5, restrictions: [true, false], sop: [true, true, true, true], hasSamples: true },
  { id: 'blood_pressure', code: 'SOP-MED-BP03', icon: Activity, equipmentCount: 4, restrictions: [true, true, true, true], sop: [true, true, true, true], hasSamples: false },
  { id: 'ecg', code: 'SOP-MED-ECG04', icon: Heart, equipmentCount: 5, restrictions: [true, true], sop: [false, false, true, true], hasSamples: true },
  { id: 'glucose', code: 'SOP-MED-BLD05', icon: Droplet, equipmentCount: 8, restrictions: [true, false], sop: [false, true, false, false], hasSamples: true },
];

const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i + 1);

export function Guide() {
  const locale = useLocale();
  const history = useHistory();
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const startCheckin = () => {
    history.push({ pathname: CHECKIN_PATH, state: { autostart: true } });
  };

  const query = searchQuery.toLowerCase();
  const filteredProtocols = CLINICAL_PROTOCOLS.filter((proto) => {
    const matchesFilter = selectedProtocolId === 'all' || proto.id === selectedProtocolId;
    const matchesSearch =
      searchQuery.trim() === '' ||
      t(`guide.${proto.id}.title`).toLowerCase().includes(query) ||
      proto.code.toLowerCase().includes(query) ||
      t(`guide.${proto.id}.objective`).toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  return (
    <main className="min-h-screen bg-canvas" data-locale={locale}>
      <div className="mx-auto flex max-w-content flex-col gap-xl px-4 pb-dockClearance pt-xl md:px-page">
        {/* Official guide header */}
        <header className="flex flex-col justify-between gap-md border-b border-slate-200 pb-5 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                {t('guide.badge')}
              </span>
              <span className="text-xs text-slate-400">{t('guide.rev')}</span>
            </div>
            <h1 className="text-title font-bold text-ink mt-1">{t('guide.title')}</h1>
            <p className="text-small text-ink-secondary">{t('guide.subtitle')}</p>
          </div>

          <Link
            to={HOME_PATH}
            className="inline-flex min-h-touch items-center gap-1.5 text-small font-semibold text-primary hover:underline md:min-h-0"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('guide.back')}
          </Link>
        </header>

        {/* Search and protocol tabs */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedProtocolId('all')}
              className={`flex min-h-touch items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors md:min-h-0 ${
                selectedProtocolId === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('guide.filter.all', { count: CLINICAL_PROTOCOLS.length })}
            </button>
            {CLINICAL_PROTOCOLS.map((proto) => {
              const Icon = proto.icon;
              return (
                <button
                  type="button"
                  key={proto.id}
                  onClick={() => setSelectedProtocolId(proto.id)}
                  className={`min-h-touch px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 md:min-h-0 ${
                    selectedProtocolId === proto.id
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {t(`guide.${proto.id}.title`).split('(')[0].trim()}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('guide.search.placeholder')}
              aria-label={t('guide.search.placeholder')}
              className="min-h-touch w-full px-3 py-1.5 pl-9 rounded-xl text-xs bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 md:min-h-0"
            />
            <BookOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none md:top-2 md:translate-y-0" />
          </div>
        </div>

        {/* Protocol list */}
        <div className="flex flex-col gap-8">
          {filteredProtocols.map((proto) => {
            const Icon = proto.icon;
            const id = `guide.${proto.id}`;
            return (
              <Card key={proto.id} className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 shrink-0 mt-0.5">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {proto.code}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {t('guide.responsible')} <strong className="text-slate-700">{t(`${id}.role`)}</strong>
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-800 mt-1">{t(`${id}.title`)}</h2>
                    </div>
                  </div>

                  <div className="inline-flex max-w-full items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600 md:shrink-0">
                    <Clock className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>{t(`${id}.duration`)}</span>
                  </div>
                </div>

                {/* 1. Objective */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    {t('guide.section.objective')}
                  </h3>
                  <p className="text-small text-slate-700 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
                    {t(`${id}.objective`)}
                  </p>
                </section>

                {/* 2. Equipment */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 shrink-0 text-indigo-600" />
                    {t('guide.section.equipment')}
                  </h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-small text-slate-700">
                    {range(proto.equipmentCount).map((n) => (
                      <li key={n} className="flex items-start gap-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                        <span className="min-w-0 text-xs">{t(`${id}.equipment.${n}`)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* 3. Restrictions (Go/No-Go checkpoints) */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                    {t('guide.section.restrictions')}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {proto.restrictions.map((isNoGo, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
                          isNoGo
                            ? 'bg-rose-50/60 border-rose-200 text-rose-800'
                            : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                            isNoGo ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {isNoGo ? t('guide.flag.nogo') : t('guide.flag.go')}
                        </span>
                        <span className="min-w-0 leading-relaxed font-medium">{t(`${id}.restriction.${idx + 1}`)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 4. SOP */}
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 shrink-0 text-blue-600" />
                    {t('guide.section.sop')}
                  </h3>
                  <ol className="flex flex-col gap-2.5 mt-1">
                    {proto.sop.map((hasTime, idx) => (
                      <li
                        key={idx}
                        className="flex flex-col gap-3 p-3.5 rounded-xl bg-slate-50/90 border border-slate-100 md:flex-row md:items-start"
                      >
                        <div className="flex flex-wrap items-center gap-2 shrink-0 md:w-48 md:flex-nowrap">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{t(`${id}.sop.${idx + 1}.phase`)}</span>
                          {hasTime && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                              {t(`${id}.sop.${idx + 1}.time`)}
                            </span>
                          )}
                        </div>
                        <p className="min-w-0 text-xs text-slate-600 leading-relaxed flex-1">{t(`${id}.sop.${idx + 1}.action`)}</p>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* 5. Data handling and close-out */}
                <section className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Database className="h-4 w-4 shrink-0 text-purple-600" />
                    {t('guide.section.closure')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {proto.hasSamples && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
                        <strong className="text-slate-800 font-semibold flex items-center gap-1">
                          <Droplet className="h-3.5 w-3.5 shrink-0 text-rose-500" /> {t('guide.closure.samples')}
                        </strong>
                        <span className="text-slate-600 leading-relaxed">{t(`${id}.closure.samples`)}</span>
                      </div>
                    )}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
                      <strong className="text-slate-800 font-semibold flex items-center gap-1">
                        <Wrench className="h-3.5 w-3.5 shrink-0 text-blue-500" /> {t('guide.closure.hardware')}
                      </strong>
                      <span className="text-slate-600 leading-relaxed">{t(`${id}.closure.hardware`)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
                      <strong className="text-slate-800 font-semibold flex items-center gap-1">
                        <Database className="h-3.5 w-3.5 shrink-0 text-purple-500" /> {t('guide.closure.data')}
                      </strong>
                      <span className="text-slate-600 leading-relaxed">{t(`${id}.closure.data`)}</span>
                    </div>
                  </div>
                </section>
              </Card>
            );
          })}
        </div>
      </div>

      <BottomNav active="guide" onVita={startCheckin} />
    </main>
  );
}
