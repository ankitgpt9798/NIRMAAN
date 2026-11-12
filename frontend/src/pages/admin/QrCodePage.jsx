import { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, LoaderCircle, Printer, QrCode, ShieldCheck, TriangleAlert } from 'lucide-react';
import Alert from '../../components/admin/Alert';
import QrPoster from '../../components/admin/QrPoster';
import { ErrorBlock, LoadingBlock } from '../../components/admin/PageStates';
import { btnPrimary, btnSecondary, card } from '../../components/admin/styles';
import { useFetch } from '../../hooks/useFetch';
import { useI18n } from '../../i18n/I18nContext';
import { apiErrorMessage } from '../../i18n/apiErrors';
import { fillTemplate } from '../../i18n/fill';
import { getQrCode } from '../../services/adminApi';
import { createPosterPng, downloadDataUrl, posterTexts } from '../../utils/qrPoster';

/** Translated text for a server warning/note { code, message }; unknown codes keep the server's English message. */
function codedText(prefix, item, t, vars) {
  const key = `${prefix}.${item.code}`;
  const text = t(key, vars);
  return text === key ? item.message : text;
}

const codeTag = (text) => <code className="rounded bg-amber-100 px-1">{text}</code>;

/** The single, permanent shop QR code: preview, downloads and printable poster. */
export default function QrCodePage() {
  const { t } = useI18n();
  const qr = useFetch('qr-code', getQrCode);
  const data = qr.data;

  return (
    <div className="max-w-5xl">
      <title>{`${t('admin.nav.qrCode')} · ${t('admin.brand')}`}</title>
      <h1 className="text-2xl font-bold text-brand-800 print:hidden">{t('admin.qr.title')}</h1>
      <p className="mt-1 max-w-3xl text-slate-600 print:hidden">{t('admin.qr.intro')}</p>

      <div className="mt-4">
        {qr.failure && <ErrorBlock message={apiErrorMessage(qr.failure, t)} onRetry={qr.reload} />}
        {!data && qr.loading && <LoadingBlock label={t('admin.qr.creating')} />}
        {data && <QrContent qr={data} />}
      </div>
    </div>
  );
}

function QrContent({ qr }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [poster, setPoster] = useState({ status: 'idle' }); // status: idle | working | done | error (+ failure)
  const svgHref = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`, [qr.svg]);
  const prefix = qr.isProductionReady ? 'shop' : 'TEST-shop';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handlePosterDownload() {
    setPoster({ status: 'working' });
    try {
      const dataUrl = await createPosterPng({ qrPngDataUrl: qr.pngDataUrl, ...posterTexts(qr) });
      downloadDataUrl(dataUrl, `${prefix}-qr-poster.png`);
      setPoster({ status: 'done' });
    } catch (error) {
      setPoster({ status: 'error', failure: error });
    }
  }

  const posterMessage =
    poster.status === 'done' ? t('admin.qr.posterDownloaded') : poster.status === 'error' ? apiErrorMessage(poster.failure, t, 'admin.qr.posterFailed') : '';

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        {qr.isProductionReady ? (
          <Alert tone="success">
            <p className="font-semibold">{t('admin.qr.ready')}</p>
            <p>{fillTemplate(t('admin.qr.readyBody'), { url: <strong className="break-all">{qr.url}</strong> })}</p>
          </Alert>
        ) : (
          <Alert tone="warning">
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-5" aria-hidden="true" />
              {t('admin.qr.notReady')}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {qr.warnings.map((warning) => (
                <li key={warning.code}>{codedText('admin.qr.warn', warning, t)}</li>
              ))}
            </ul>
            <p className="mt-2">
              {fillTemplate(t('admin.qr.fixBody'), { setting: codeTag('PUBLIC_SITE_URL'), example: codeTag('https://your-shop.vercel.app') })}
            </p>
            <p className="mt-2 text-sm">{fillTemplate(t('admin.qr.phoneTest'), { example: codeTag('http://192.168.1.20:5173') })}</p>
          </Alert>
        )}
        {qr.notes.map((note) => {
          // Older servers sent plain English strings.
          const item = typeof note === 'string' ? { code: '', message: note } : note;
          return (
            <div key={item.code || item.message} className="mt-3">
              <Alert tone="info">{item.code ? codedText('admin.qr.note', item, t, { website: item.website }) : item.message}</Alert>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} p-4 sm:p-6 print:hidden`} aria-labelledby="qr-heading">
          <h2 id="qr-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <QrCode className="size-5 text-brand-700" aria-hidden="true" />
            {t('admin.qr.cardTitle')}
          </h2>
          <img
            src={qr.pngDataUrl}
            alt={t('admin.qr.alt', { url: qr.url })}
            width="1024"
            height="1024"
            className="mx-auto mt-3 aspect-square w-full max-w-xs rounded-lg border border-slate-200 [image-rendering:pixelated]"
          />
          <p className="mt-3 text-sm font-medium text-slate-500">{t('admin.qr.opens')}</p>
          <p className="font-semibold break-all text-slate-900">{qr.url}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={handleCopy}>
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? t('admin.qr.copied') : t('admin.qr.copy')}
            </button>
            <a href={qr.url} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
              <ExternalLink className="size-4" aria-hidden="true" />
              {t('admin.qr.open')}
            </a>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <a href={qr.pngDataUrl} download={`${prefix}-qr-code.png`} className={btnPrimary}>
              <Download className="size-5" aria-hidden="true" />
              {t('admin.qr.downloadPng')}
            </a>
            <a href={svgHref} download={`${prefix}-qr-code.svg`} className={btnSecondary}>
              <Download className="size-5" aria-hidden="true" />
              {t('admin.qr.downloadSvg')}
            </a>
          </div>
          <p className="mt-2 text-sm text-slate-500">{t('admin.qr.formatHint')}</p>
          <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
            {t('admin.qr.robust')}
          </p>
        </section>

        <section className={`${card} p-4 sm:p-6 print:border-0 print:p-0`} aria-labelledby="poster-heading">
          <h2 id="poster-heading" className="text-lg font-semibold text-slate-800 print:hidden">
            {t('admin.qr.posterTitle')}
          </h2>
          <div className="mt-3 print:mt-0">
            <QrPoster qr={qr} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <button type="button" className={btnPrimary} onClick={handlePosterDownload} disabled={poster.status === 'working'}>
              {poster.status === 'working' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Download className="size-5" aria-hidden="true" />}
              {poster.status === 'working' ? t('admin.qr.creatingPoster') : t('admin.qr.downloadPoster')}
            </button>
            <button type="button" className={btnSecondary} onClick={() => window.print()}>
              <Printer className="size-5" aria-hidden="true" />
              {t('admin.qr.printPoster')}
            </button>
          </div>
          {posterMessage && (
            <p className={`mt-2 text-sm font-medium print:hidden ${poster.status === 'error' ? 'text-red-700' : 'text-brand-700'}`} role={poster.status === 'error' ? 'alert' : 'status'}>
              {posterMessage}
            </p>
          )}
          <p className="mt-2 text-sm text-slate-500 print:hidden">{t('admin.qr.posterNote')}</p>
        </section>
      </div>
    </div>
  );
}
