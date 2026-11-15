import { setLocale, type Locale } from '../../config/i18n';
import { t } from '../../config/messages.es';
import { useLocale } from '../useLocale';

const SEPARATOR = '|';
const LOCALES: readonly Locale[] = ['es', 'en'];

/** "ES | EN" switch: the active language is bold; one tap changes the other. */
export function LanguageToggle() {
  const locale = useLocale();
  const next: Locale = locale === 'es' ? 'en' : 'es';
  return (
    <button
      type="button"
      aria-label={t('language.toggle')}
      onClick={() => setLocale(next)}
      className="-my-xs inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-xs rounded-full bg-track px-md py-xs text-meta text-ink"
    >
      {LOCALES.map((code, index) => (
        <span key={code} className="inline-flex items-center gap-xs">
          {index > 0 && <span aria-hidden="true">{SEPARATOR}</span>}
          <span className={code === locale ? 'font-bold' : 'font-normal'}>{code.toUpperCase()}</span>
        </span>
      ))}
    </button>
  );
}
