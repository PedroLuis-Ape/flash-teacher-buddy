(() => {
  const status = document.querySelector('[data-tts-status]');
  const speakButton = document.querySelector('[data-tts-speak]');
  const stopButton = document.querySelector('[data-tts-stop]');
  const textInput = document.querySelector('[data-tts-text]');
  const localeInput = document.querySelector('[data-tts-locale]');
  const modeInput = document.querySelector('[data-tts-mode]');

  const labels = {
    'pt-BR': {
      unsupported: 'Este navegador não oferece síntese de voz.',
      speaking: 'Reproduzindo com locale',
      stopped: 'Áudio interrompido.',
      finished: 'Reprodução concluída.',
      empty: 'Digite uma frase antes de reproduzir.',
      error: 'A voz não pôde ser reproduzida neste dispositivo.'
    },
    en: {
      unsupported: 'Speech synthesis is not available in this browser.',
      speaking: 'Playing with locale',
      stopped: 'Audio stopped.',
      finished: 'Playback completed.',
      empty: 'Enter a sentence before playing it.',
      error: 'The voice could not be played on this device.'
    }
  };

  const uiLanguage = document.documentElement.lang === 'en' ? 'en' : 'pt-BR';
  const copy = labels[uiLanguage];
  let runId = 0;
  let pauseTimer = null;

  function setStatus(message, isError = false) {
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#ff9fba' : '#54d6a5';
  }

  function cancelSpeech(message) {
    runId += 1;
    if (pauseTimer) window.clearTimeout(pauseTimer);
    pauseTimer = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (message) setStatus(message);
  }

  function voicesFor(locale) {
    const all = window.speechSynthesis.getVoices();
    const exact = all.filter((voice) => voice.lang.toLowerCase() === locale.toLowerCase());
    if (exact.length) return exact;
    const base = locale.split('-')[0].toLowerCase();
    return all.filter((voice) => voice.lang.toLowerCase().startsWith(`${base}-`));
  }

  function chooseVoice(locale) {
    const voices = voicesFor(locale);
    return voices.find((voice) => /google|microsoft|natural|neural|enhanced/i.test(voice.name)) || voices[0] || null;
  }

  function utter(text, locale, rate, currentRun, onEnd) {
    if (currentRun !== runId) return;
    const item = new SpeechSynthesisUtterance(text);
    const voice = chooseVoice(locale);
    item.lang = voice?.lang || locale;
    if (voice) item.voice = voice;
    item.rate = rate;
    item.pitch = 1;
    item.volume = 1;
    item.onerror = () => {
      if (currentRun === runId) setStatus(copy.error, true);
    };
    item.onend = () => {
      if (currentRun === runId) onEnd?.();
    };
    window.speechSynthesis.speak(item);
  }

  function speakWordByWord(text, locale, currentRun) {
    const words = text.match(/[\p{L}\p{N}'’-]+|[^\s]/gu) || [];
    const play = (index) => {
      if (currentRun !== runId) return;
      if (index >= words.length) {
        setStatus(copy.finished);
        return;
      }
      utter(words[index], locale, 0.82, currentRun, () => {
        pauseTimer = window.setTimeout(() => play(index + 1), 260);
      });
    };
    play(0);
  }

  function speak() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setStatus(copy.unsupported, true);
      return;
    }
    const text = textInput?.value.trim() || '';
    if (!text) {
      setStatus(copy.empty, true);
      return;
    }
    cancelSpeech();
    const currentRun = runId;
    const locale = localeInput?.value || 'en-US';
    const mode = modeInput?.value || 'natural';
    setStatus(`${copy.speaking} ${locale}…`);
    if (mode === 'word-by-word') {
      speakWordByWord(text, locale, currentRun);
      return;
    }
    utter(text, locale, 1, currentRun, () => setStatus(copy.finished));
  }

  speakButton?.addEventListener('click', speak);
  stopButton?.addEventListener('click', () => cancelSpeech(copy.stopped));
  window.addEventListener('pagehide', () => cancelSpeech());

  const pathOutput = document.querySelector('[data-current-path]');
  const langOutput = document.querySelector('[data-current-lang]');
  const canonicalOutput = document.querySelector('[data-current-canonical]');
  const alternatesOutput = document.querySelector('[data-current-alternates]');
  if (pathOutput) pathOutput.textContent = window.location.pathname;
  if (langOutput) langOutput.textContent = document.documentElement.lang;
  if (canonicalOutput) {
    canonicalOutput.textContent = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '—';
  }
  if (alternatesOutput) {
    alternatesOutput.textContent = [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
      .map((link) => `${link.getAttribute('hreflang')}: ${link.getAttribute('href')}`)
      .join(' | ');
  }
})();