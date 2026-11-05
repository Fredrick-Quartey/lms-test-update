// NFR-C3: user-facing text lives in resource files so the interface can be translated without code changes.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from '@/locales/en/common.json';
import errors from '@/locales/en/errors.json';
import status from '@/locales/en/status.json';

void i18n.use(initReactI18next).init({
  resources: { en: { common, errors, status } },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common', 'errors', 'status'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
