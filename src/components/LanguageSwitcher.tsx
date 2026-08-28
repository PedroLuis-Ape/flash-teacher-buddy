import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { APP_LOCALES } from '@/i18n/languages';
import { changeAppLocale, getCurrentAppLocale } from '@/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  // i18n é lido para reagir a mudanças de idioma sem manter estado paralelo.
  void i18n.resolvedLanguage;

  const currentLang = getCurrentAppLocale();

  const handleLanguageChange = (langCode: string) => {
    void changeAppLocale(langCode);
  };

  return (
    <Select value={currentLang} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-full" aria-label={t('language.selectLanguage')}>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue placeholder={t('language.selectLanguage')} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {APP_LOCALES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center gap-2">
              <span aria-hidden="true">{lang.flag}</span>
              <span>{lang.nativeName}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
