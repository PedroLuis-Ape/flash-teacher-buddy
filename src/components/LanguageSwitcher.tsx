import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const languages = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const normalizedLang = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
  const currentLang = languages.some((lang) => lang.code === normalizedLang) ? normalizedLang : 'pt';

  const currentLabel = useMemo(() => {
    const current = languages.find((lang) => lang.code === currentLang);
    return current ? `${current.flag} ${current.label}` : 'Idioma';
  }, [currentLang]);

  useEffect(() => {
    if (normalizedLang !== currentLang) {
      i18n.changeLanguage(currentLang);
    }
  }, [normalizedLang, currentLang, i18n]);

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode || 'pt');
  };

  return (
    <Select value={currentLang} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue placeholder={currentLabel} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <div className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
