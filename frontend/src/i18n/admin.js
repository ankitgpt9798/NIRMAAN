import { addTranslations } from './dictionaries';
import adminEn from './admin.en';
import adminHi from './admin.hi';

// Imported by the admin area only, so these texts are part of the admin download.
addTranslations({ en: adminEn, hi: adminHi });
