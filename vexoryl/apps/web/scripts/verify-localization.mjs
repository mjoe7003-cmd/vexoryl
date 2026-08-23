import { verifyTranslations } from '../src/i18n/translations.js';

const result = verifyTranslations();
console.log(JSON.stringify(result, null, 2));