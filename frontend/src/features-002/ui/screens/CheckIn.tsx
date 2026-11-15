import { Link } from 'react-router-dom';
import { t } from '../../config/messages.es';

export function CheckIn() {
  const steps = [
    t('checkin.preview.step1'),
    t('checkin.preview.step2'),
    t('checkin.preview.step3'),
  ];

  return (
    <main className="simple-screen">
      <section className="simple-card">
        <Link className="brand" to="/" aria-label={t('screen.home')}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 40 40">
              <path d="M20 5v30M5 20h30M9.4 9.4l21.2 21.2m0-21.2L9.4 30.6" />
              <circle cx="20" cy="20" r="7" />
            </svg>
          </span>
          <span className="brand-wordmark">{t('home.brandBase')}<span>{t('home.brandVital')}</span></span>
        </Link>
        <p className="eyebrow">{t('screen.checkin')}</p>
        <h1>{t('checkin.preview.title')}</h1>
        <p>{t('checkin.preview.description')}</p>
        <ul className="preview-steps">
          {steps.map((step, index) => (
            <li key={step}><span className="preview-step-number">{index + 1}</span>{step}</li>
          ))}
        </ul>
        <div className="verdict-chip verdict-chip--unknown">{t('checkin.preview.status')}</div>
        <p><Link className="primary-button" to="/">{t('checkin.preview.back')}</Link></p>
      </section>
    </main>
  );
}
