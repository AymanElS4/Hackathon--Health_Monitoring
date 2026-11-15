import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { Pause } from 'lucide-react';
import type { CheckRecord } from '@base-vital/contracts';
import type { CheckinSnapshot } from '../../application/use-cases/runCheckin';
import { metricReadingsOf } from '../../application/use-cases/metricReadings';
import { priorChecksOf } from '../../application/use-cases/previousChecks';
import { HISTORY_PATH, HOME_PATH } from '../../config/constants';
import { t } from '../../config/messages.es';
import { useAppServices } from '../AppServices';
import { useCheckin } from '../useCheckin';
import { useConversation } from '../useConversation';
import type { ChatMessage } from '../conversation';
import { usePrefersReducedMotion } from '../body3d/usePrefersReducedMotion';
import { devMetricsVisible } from '../dev/devMetricsVisible';
import { LazyBodyViewer } from '../body3d/LazyBodyViewer';
import { BigButtons } from '../components/BigButtons';
import { Button } from '../components/Button';
import { MetricRows } from '../components/MetricRows';
import { SectionHeader } from '../components/SectionHeader';
import { VerdictPanel } from '../components/VerdictPanel';
import { AnaBubble, VitaBubble, VitaRow } from '../components/chat/ChatBubble';
import { CheckinProgress } from '../components/chat/CheckinProgress';
import { ConversationControls } from '../components/chat/ConversationControls';
import { MicIndicator } from '../components/chat/MicIndicator';
import { OptionChips } from '../components/chat/OptionChips';
import type { AnswerStep } from '../components/chat/stepOptions';
import { needsTeamNote } from '../teamNote';

/** Location state set by Home when the check-in should start at once (RF1). */
interface CheckinLocationState {
  autostart?: boolean;
}

/** Dev-only metrics overlay (T095): its own chunk, so the demo does not load it. */
const DevMetricsOverlay = lazy(() =>
  import('../dev/DevMetricsOverlay').then((module) => ({ default: module.DevMetricsOverlay })),
);

/** Steps whose answer is one of a few quick replies under Vita's last message (T080a). */
const CHIP_STEPS: ReadonlySet<CheckinSnapshot['step']> = new Set<CheckinSnapshot['step']>([
  'confirm_sleep',
  'ask_mood',
  'confirm_mood',
  'ask_symptoms',
  'next_activity',
]);

const STATUS_LINE = 'flex items-center gap-sm text-small font-semibold text-primary';
const ICON = 'h-xl w-xl';
const ANSWER_INPUT = 'min-h-touch flex-1 rounded-card bg-card px-lg text-body text-ink shadow-ambient';

/** The quick replies are shown only while the voice listens to a chip step and is not paused. */
function chipStepOf(snapshot: CheckinSnapshot): AnswerStep | null {
  if (!snapshot.listening || snapshot.paused || !CHIP_STEPS.has(snapshot.step)) return null;
  return snapshot.step as AnswerStep;
}

/** Steps where Vita asks for "sí" or "no" about a value: the grey hint shows. */
function isConfirmStep(step: AnswerStep): boolean {
  return step === 'confirm_sleep' || step === 'confirm_mood';
}

/** Hint under the quick replies of the step: the next activity only takes "sí" to finish. */
function hintKeyOf(step: AnswerStep): string | null {
  if (step === 'next_activity') return 'checkin.hint.finish';
  return isConfirmStep(step) ? 'checkin.confirmHint' : null;
}

/** Aligns a block with the text of a Vita row (the avatar width and its gap). */
function Indent({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-sm">
      <span aria-hidden="true" className="w-avatar shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-sm">{children}</div>
    </div>
  );
}

/** One message of the transcript (T080a). `summary` goes inside the verdict message (T091); `verdictRef` marks its start. */
function renderMessage(message: ChatMessage, summary: ReactNode, verdictRef: RefObject<HTMLDivElement>) {
  switch (message.kind) {
    case 'vita':
      return (
        <VitaRow key={message.id}>
          <VitaBubble text={message.text} />
        </VitaRow>
      );
    case 'ana':
      return <AnaBubble key={message.id} text={message.text} live={message.live} />;
    case 'verdict':
      return (
        <VitaRow key={message.id}>
          <div ref={verdictRef} className="min-w-0">
            <VerdictPanel
              verdict={message.verdict}
              actionKey={message.actionKey}
              actionParams={message.actionParams}
              next={message.next}
              summary={summary}
            />
          </div>
        </VitaRow>
      );
  }
}

/**
 * Check-in screen (T056, T080a). A chat with Vita: her lines on the left, Ana's answers on the right,
 * the verdict last. Quick replies sit under her last line and send the same text the voice would.
 * The body on the right follows the script: the sensor being discussed is highlighted (CA3).
 */
export function CheckIn() {
  const location = useLocation<CheckinLocationState | undefined>();
  const history = useHistory();
  const { snapshot, bodyView, start, pause, resume, repeat, answerButton, answer, fakeListening } = useCheckin();
  const messages = useConversation(snapshot);
  const services = useAppServices();
  // The recorder only when the overlay is on (dev server or ?dev=metrics); otherwise nothing is shown.
  const devMetrics =
    services.devMetrics !== undefined && devMetricsVisible(location.search, import.meta.env.DEV)
      ? services.devMetrics
      : undefined;
  const hasOutcome = snapshot.outcome !== null;
  /** Previous days' checks, for the "tu normal" marks of the summary rows; loaded once the verdict is known. */
  const [previousChecks, setPreviousChecks] = useState<CheckRecord[]>([]);
  const reducedMotion = usePrefersReducedMotion();
  const [autostart] = useState(() => location.state?.autostart === true);
  // Guards against a second start, e.g. when React StrictMode re-runs the effect in development.
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  /** The verdict message, once it is on screen: the log opens at its start, so the headline stays visible. */
  const verdictRef = useRef<HTMLDivElement>(null);
  const anchoredToVerdict = useRef(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!autostart || started.current) return;
    started.current = true;
    void start();
  }, [autostart, start]);

  useEffect(() => {
    if (!hasOutcome) return;
    let active = true;
    void priorChecksOf(services.repository, services.clock).then((checks) => {
      if (active) setPreviousChecks(checks);
    });
    return () => {
      active = false;
    };
  }, [hasOutcome, services]);

  const summaryRows = useMemo(
    () =>
      metricReadingsOf({
        readings: snapshot.readings,
        observations: snapshot.observations,
        previousChecks,
      }),
    [snapshot.readings, snapshot.observations, previousChecks],
  );
  // The same metric rows as Home, shown inside the verdict message once the verdict is known.
  const summary = hasOutcome ? <MetricRows readings={summaryRows} focus={bodyView.focus} /> : undefined;

  const done = snapshot.step === 'saved';
  const chipStep = chipStepOf(snapshot);
  const showTeamNote = needsTeamNote({
    readings: bodyView.readings,
    marks: [snapshot.outcome?.teamCriterion === true],
  });

  // Keeps the newest message (or the quick replies, or the end) in view. jsdom has no scrollIntoView.
  // Before the verdict the log follows the newest line. Once the verdict is on screen, the log opens at
  // the verdict's start (its title and rows stay visible) and does not jump to the end afterwards.
  useEffect(() => {
    const behavior = reducedMotion ? 'auto' : 'smooth';
    const verdict = verdictRef.current;
    if (verdict !== null) {
      if (anchoredToVerdict.current || typeof verdict.scrollIntoView !== 'function') return;
      anchoredToVerdict.current = true;
      verdict.scrollIntoView({ block: 'start', behavior });
      return;
    }
    const node = endRef.current;
    if (node === null || typeof node.scrollIntoView !== 'function') return;
    node.scrollIntoView({ block: 'end', behavior });
  }, [messages.length, chipStep, snapshot.buttonsFor, done, reducedMotion]);

  const submitAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (text === '' || answer === undefined) return;
    answer(text);
    setDraft('');
  };

  return (
    <main className="flex min-h-screen flex-col gap-lg bg-canvas px-page py-xl lg:h-screen lg:overflow-hidden">
      <SectionHeader title={t('checkin.title')} />
      <div className="flex min-h-0 flex-1 flex-col gap-xl lg:flex-row lg:items-stretch">
        <section className="flex min-h-0 min-w-0 flex-col gap-md lg:w-3/5">
          <div className="flex items-end justify-between gap-lg">
            <div className="min-w-0 flex-1">
              <CheckinProgress step={snapshot.step} />
            </div>
            {!done && snapshot.step !== 'idle' && (
              <ConversationControls
                paused={snapshot.paused}
                onPause={pause}
                onResume={resume}
                onRepeat={repeat}
              />
            )}
          </div>
          <div role="log" aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto pb-md pr-md">
            {messages.map((message) => renderMessage(message, summary, verdictRef))}
            {chipStep !== null && (
              <Indent>
                {hintKeyOf(chipStep) !== null && (
                  <p className="text-meta text-ink-secondary">{t(hintKeyOf(chipStep) as string)}</p>
                )}
                <OptionChips step={chipStep} size="quick" onAnswer={answerButton} />
              </Indent>
            )}
            {snapshot.buttonsFor !== null && (
              <Indent>
                <p className="text-small text-ink-secondary">{t('checkin.buttonsHint')}</p>
                <BigButtons step={snapshot.buttonsFor} onAnswer={answerButton} />
              </Indent>
            )}
            {snapshot.step === 'idle' && !autostart && (
              <Indent>
                <div>
                  <Button onClick={() => start()}>{t('home.start')}</Button>
                </div>
              </Indent>
            )}
            {done && (
              <Indent>
                <p className="text-title font-semibold text-ink">
                  {snapshot.saveFailed ? t('checkin.save_failed') : t('checkin.done')}
                </p>
                <div className="flex flex-wrap items-center gap-md">
                  <Button onClick={() => history.push(HOME_PATH)}>{t('checkin.backHome')}</Button>
                  <Link to={HISTORY_PATH} className="text-small font-semibold text-primary">
                    {t('history.link')}
                  </Link>
                </div>
              </Indent>
            )}
            <div ref={endRef} />
          </div>
          <MicIndicator listening={snapshot.listening} speaking={snapshot.speaking} />
          {snapshot.paused && (
            <p role="status" className={STATUS_LINE}>
              <Pause aria-hidden="true" className={ICON} />
              <span>{t('checkin.paused')}</span>
            </p>
          )}
          {answer !== undefined && fakeListening === true && !done && (
            <form onSubmit={submitAnswer} className="flex gap-sm">
              <input
                type="text"
                aria-label={t('checkin.answerLabel')}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className={ANSWER_INPUT}
              />
              <Button type="submit">{t('checkin.answerSend')}</Button>
            </form>
          )}
          {showTeamNote && <p className="text-meta text-ink-secondary">{t('team.criterion.note')}</p>}
        </section>
        {/* The body follows the script: the sensor being discussed is highlighted (CA3). Its dots are not tappable here. */}
        <div className="flex w-full flex-col items-center justify-center gap-md lg:w-2/5">
          <LazyBodyViewer
            readings={bodyView.readings}
            focus={bodyView.focus}
            measuring={bodyView.measuring}
            evaluated={bodyView.evaluated}
            onFrameRate={devMetrics?.markFps}
          />
          {bodyView.focus !== null && (
            <p className="text-body font-semibold text-ink">{t(`sensor.${bodyView.focus}`)}</p>
          )}
        </div>
      </div>
      {devMetrics !== undefined && (
        <Suspense fallback={null}>
          <DevMetricsOverlay recorder={devMetrics} />
        </Suspense>
      )}
    </main>
  );
}
