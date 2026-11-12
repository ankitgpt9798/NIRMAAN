import { isIP } from 'node:net';

function isPrivateIPv4(host) {
  const [a, b] = host.split('.').map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/**
 * Checks whether an address is suitable for a printed, permanent QR code.
 * Returns { url, isProductionReady, warnings: [{ code, message }] }.
 */
export function analyseSiteUrl(address) {
  const url = new URL(address);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const warnings = [];

  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.startsWith('127.')) {
    warnings.push({
      code: 'LOCALHOST',
      message: 'This is this computer’s own address (localhost). Customers’ phones cannot open it.',
    });
  } else if (isIP(host) === 4 && isPrivateIPv4(host)) {
    warnings.push({
      code: 'PRIVATE_NETWORK',
      message: 'This is a local Wi-Fi address. It only works on this network and can change, so it is only for testing.',
    });
  } else if (isIP(host)) {
    warnings.push({ code: 'IP_ADDRESS', message: 'This is a bare IP address. Use the website’s name (domain) so the address never changes.' });
  }
  if (url.protocol !== 'https:') {
    warnings.push({ code: 'NOT_HTTPS', message: 'The address starts with http:// instead of https://. Hosted websites use https.' });
  }
  if (url.search || url.hash) {
    warnings.push({ code: 'EXTRA_PARTS', message: 'The address contains extra parts (after ? or #). Use only the main website address.' });
  }

  return { url: url.href, isProductionReady: warnings.length === 0, warnings };
}
