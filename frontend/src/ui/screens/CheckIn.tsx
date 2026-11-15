import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { Mic, Pause } from 'lucide-react';
import type { CheckinSnapshot } from '../../application/use-cases/runCheckin';
import { HISTORY_PATH, HOME_PATH } from '../../config/constants';
import { t } from '../../config/messages.es';
import { useCheckin } from '../useCheckin';
import { LazyBodyViewer } from '../body3d/LazyBodyViewer';
import { BigButtons } from '../components/BigButtons';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { VerdictPanel } from '../components/VerdictPanel';
import { needsTeamNote } from '../teamNote';

/** Location state set by Home when the check-in should start at once (RF1). */
interface CheckinLocationState {
  autostart?: boolean;
}

/** Message key of the short label for each step; idle and saved have none. */
const STEP_LABEL_KEYS: Partial<Record<CheckinSnapshot['step'], string>> = {
  greeting: 'checkin.step.greeting',
  ask_sleep: 'checkin.step.sleep',
  confirm_sleep: 'checkin.step.sleep',
  ask_mood: 'checkin.step.mood',
  confirm_mood: 'checkin.step.mood',
  ask_symptoms: 'checkin.step.symptoms',
  measuring: 'checkin.step.measuring',
  evaluating: 'checkin.step.summary',
  summary: 'checkin.step.summary',
  next_activity: 'checkin.step.next',
};

/** Steps that show the verdict panel: the summary, the next activity and the end (RF9, RF10). */
const VERDICT_STEPS: ReadonlySet<CheckinSnapshot['step']> = new Set(['summary', 'next_activity', 'saved']);

const STATUS_LINE = 'flex items-center gap-sm text-small font-semibold text-primary';
const ICON = 'h-xl w-xl';
const ANSWER_INPUT = 'min-h-touch flex-1 rounded-card bg-card px-lg text-body text-ink shadow-ambient';

/** Check-in screen (T056, FR-001..FR-004, RF1). Captions every spoken line and shows the current step. */
export function CheckIn() {
  const location = useLocation<CheckinLocationState | undefined>();
  const history = useHistory();
  const { snapshot, bodyView, start, pause, resume, repeat, answerButton, answer, fakeListening } = useCheckin();
  const [autostart] = useState(() => location.state?.autostart === true);
  // Guards against a second start, e.g. when React StrictMode re-runs the effect in development.
  const started = useRef(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!autostart || started.current) return;
    started.current = true;
    void start();
  }, [autostart, start]);

  const stepLabelKey = STEP_LABEL_KEYS[snapshot.step];
  const done = snapshot.step === 'saved';
  const outcome = VERDICT_STEPS.has(snapshot.step) ? snapshot.outcome : null;
  const showTeamNote = needsTeamNote({
    readings: bodyView.readings,
    marks: [outcome?.teamCriterion === true],
  });

  const submitAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (text === '' || answer === undefined) return;
    answer(text);
    setDraft('');
  };

  return (
    <main className="flex min-h-screen flex-col gap-lg bg-canvas p-lg">
      <SectionHeader title={t('checkin.title')} />
      <div className="flex flex-col gap-lg lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-lg">
          {stepLabelKey !== undefined && !done && (
            <p className="text-small font-semibold text-ink-secondary">{t(stepLabelKey)}</p>
          )}
          <Card>
            <p aria-live="polite" className="text-display font-semibold text-ink">
              {snapshot.caption ?? ''}
            </p>
          </Card>
          {outcome !== null && (
            <VerdictPanel
              verdict={outcome.verdict}
              actionKey={outcome.actionKey}
              actionParams={outcome.actionParams}
              next={snapshot.nextItem}
            />
          )}
          {snapshot.listening && (
            <p role="status" className={STATUS_LINE}>
              <Mic aria-hidden="true" className={ICON} />
              <span>{t('checkin.listening')}</span>
            </p>
          )}
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
          {snapshot.buttonsFor !== null && (
            <div className="flex flex-col gap-sm">
              <p className="text-small text-ink-secondary">{t('checkin.buttonsHint')}</p>
              <BigButtons step={snapshot.buttonsFor} onAnswer={answerButton} />
            </div>
          )}
          {snapshot.step === 'idle' && !autostart && (
            <Button onClick={() => start()}>{t('home.start')}</Button>
          )}
          {done ? (
            <Card>
              <div className="flex flex-col gap-lg">
                <p className="text-title font-semibold text-ink">
                  {snapshot.saveFailed ? t('checkin.save_failed') : t('checkin.done')}
                </p>
                <Button onClick={() => history.push(HOME_PATH)}>{t('checkin.backHome')}</Button>
                <Link to={HISTORY_PATH} className="text-small font-semibold text-primary">
                  {t('history.link')}
                </Link>
              </div>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-sm">
              <Button onClick={pause}>{t('checkin.pause')}</Button>
              <Button onClick={resume}>{t('checkin.resume')}</Button>
              <Button onClick={repeat}>{t('checkin.repeat')}</Button>
            </div>
          )}
          {showTeamNote && <p className="text-meta text-ink-secondary">{t('team.criterion.note')}</p>}
        </div>
        {/* The body follows the script: the sensor being discussed is highlighted (CA3). Its dots are not tappable here. */}
        <div className="flex w-full flex-col lg:w-2/5">
          <LazyBodyViewer
            readings={bodyView.readings}
            focus={bodyView.focus}
            measuring={bodyView.measuring}
            evaluated={bodyView.evaluated}
          />
        </div>
      </div>
    </main>
  );
}

