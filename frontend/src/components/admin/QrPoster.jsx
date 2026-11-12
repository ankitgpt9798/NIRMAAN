import { Phone } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { INSTRUCTION_EN, INSTRUCTION_HI, TEST_LABEL, posterTexts } from '../../utils/qrPoster';

/**
 * On-screen preview of the A4 poster. When printing, only this element is
 * printed and it fills the page (see the print rules in index.css).
 */
export default function QrPoster({ qr }) {
  const { t } = useI18n();
  const { titleHi, titleEn, phone, url, isTest } = posterTexts(qr);
  // The poster itself is always bilingual (Hindi + English), whatever the admin language.

  return (
    <div
      className="qr-print-area relative mx-auto flex aspect-[210/297] w-full max-w-sm flex-col items-center justify-between overflow-hidden rounded-xl border-8 border-brand-700 bg-white p-5 text-center text-slate-900 print:max-w-none print:rounded-none print:p-[12mm]"
      data-testid="qr-poster"
    >
      {isTest && (
        <p className="absolute inset-x-0 top-0 bg-red-600 py-1 text-sm font-bold text-white print:py-3 print:text-[18pt]">{TEST_LABEL}</p>
      )}
      <div className={isTest ? 'pt-6' : ''}>
        {titleHi && (
          <p lang="hi" className="text-2xl leading-snug font-bold text-brand-800 print:text-[30pt]">
            {titleHi}
          </p>
        )}
        {titleEn && <p className="text-lg font-semibold print:text-[20pt]">{titleEn}</p>}
      </div>

      <div className="w-full">
        <p lang="hi" className="rounded-lg bg-brand-700 px-3 py-2 text-xl leading-snug font-bold text-white print:py-4 print:text-[24pt]">
          {INSTRUCTION_HI}
        </p>
        <p className="mt-2 text-lg font-bold print:text-[20pt]">{INSTRUCTION_EN}</p>
      </div>

      <img
        src={qr.pngDataUrl}
        alt={t('admin.qr.alt', { url })}
        width="1024"
        height="1024"
        className="aspect-square w-3/4 [image-rendering:pixelated] print:w-[70%]"
      />

      <div>
        {phone && (
          <p className="flex items-center justify-center gap-1.5 font-semibold print:text-[16pt]">
            <Phone className="size-4" aria-hidden="true" />
            {phone}
          </p>
        )}
        <p className="text-xs break-all text-slate-600 print:text-[11pt]">{url}</p>
      </div>
    </div>
  );
}
