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
      className="relative order-3 inline-flex h-8 shrink-0 items-center justify-center gap-xs rounded-full bg-track px-md py-0 text-meta text-ink before:absolute before:-inset-2 before:content-[''] md:-my-xs md:order-none md:h-auto md:min-h-touch md:min-w-touch md:py-xs md:before:hidden"
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
