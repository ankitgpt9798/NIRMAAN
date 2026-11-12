import { AVAILABILITY_OPTIONS, UNITS } from '../constants/catalog.js';
import { getDashboardStats } from '../services/dashboard.service.js';

export async function stats(_req, res) {
  res.json({ success: true, data: await getDashboardStats() });
}

/** Lists the admin forms need: measurement units and availability options (both bilingual). */
export function meta(_req, res) {
  res.json({ success: true, data: { units: UNITS, availability: AVAILABILITY_OPTIONS } });
}
