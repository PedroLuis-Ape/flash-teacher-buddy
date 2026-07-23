(() => {
  "use strict";

  const NOTES_KEY = "ape.pronunciationNotes.v1";
  const SETTINGS_KEY = "ape.pronunciationSettings.v1";
  const MAX_NOTES = 500;
  const DEFAULT_SETTINGS = Object.freeze({
    languageMode: "manual",
    defaultLang: "en-US",
    voicePreference: "google",
    rate: 0.92,
    pitch: 0.95
  });

  const getStorage = (keys) => new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (data) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(data || {});
    });
  });

  const setStorage = (data) => new Promise((resolve, reject) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });

  const normalizeText = (value) => String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);

  async function getSettings() {
    const data = await getStorage([SETTINGS_KEY]);
    const source = data[SETTINGS_KEY] || {};
    return {
      languageMode: source.languageMode === "auto" ? "auto" : "manual",
      defaultLang: source.defaultLang || DEFAULT_SETTINGS.defaultLang,
      voicePreference: source.voicePreference === "system" ? "system" : "google",
      rate: Number.isFinite(Number(source.rate)) ? Number(source.rate) : DEFAULT_SETTINGS.rate,
      pitch: Number.isFinite(Number(source.pitch)) ? Number(source.pitch) : DEFAULT_SETTINGS.pitch
    };
  }

  const getVoices = () => new Promise((resolve) => chrome.tts.getVoices((voices) => resolve(voices || [])));

  function chooseVoice(voices, lang, preference) {
    const exact = voices.filter((voice) => String(voice.lang || "").toLowerCase() === lang.toLowerCase());
    const base = lang.split("-")[0].toLowerCase();
    const compatible = voices.filter((voice) => String(voice.lang || "").toLowerCase().startsWith(base));
    const candidates = exact.length ? exact : compatible;
    if (!candidates.length) return null;
    if (preference === "google") {
      const google = candidates.find((voice) => /google|natural|neural/i.test(voice.voiceName || ""));
      if (google) return google;
    }
    return candidates[0];
  }

  async function speak(text) {
    const normalized = normalizeText(text);
    if (!normalized) throw new Error("Selecione uma palavra ou frase.");
    const settings = await getSettings();
    const voices = await getVoices();
    const voice = chooseVoice(voices, settings.defaultLang, settings.voicePreference);
    const options = {
      lang: settings.defaultLang,
      rate: Math.min(1.4, Math.max(0.6, settings.rate)),
      pitch: Math.min(1.3, Math.max(0.7, settings.pitch))
    };
    if (voice?.voiceName) options.voiceName = voice.voiceName;
    chrome.tts.stop();
    return new Promise((resolve, reject) => {
      chrome.tts.speak(normalized, options, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve({ ok: true, lang: settings.defaultLang, voiceName: voice?.voiceName || "" });
      });
    });
  }

  async function saveNote(payload) {
    const text = normalizeText(payload?.text);
    if (!text) throw new Error("Nenhum texto selecionado.");
    const data = await getStorage([NOTES_KEY]);
    const notes = Array.isArray(data[NOTES_KEY]) ? data[NOTES_KEY] : [];
    const note = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      text,
      pageUrl: String(payload?.pageUrl || ""),
      pageTitle: String(payload?.pageTitle || ""),
      createdAt: new Date().toISOString()
    };
    await setStorage({ [NOTES_KEY]: [note, ...notes].slice(0, MAX_NOTES) });
    return { ok: true, note };
  }

  function createMenus() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: "ape-speak", title: "APE: ouvir em inglês americano", contexts: ["selection"] });
      chrome.contextMenus.create({ id: "ape-save", title: "APE: salvar seleção nas notas", contexts: ["selection"] });
    });
  }

  chrome.runtime.onInstalled.addListener(async () => {
    createMenus();
    const data = await getStorage([SETTINGS_KEY]);
    if (!data[SETTINGS_KEY]) await setStorage({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  });
  chrome.runtime.onStartup.addListener(createMenus);

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "ape-speak") void speak(info.selectionText).catch(console.warn);
    if (info.menuItemId === "ape-save") {
      void saveNote({ text: info.selectionText, pageUrl: tab?.url, pageTitle: tab?.title }).catch(console.warn);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const run = async () => {
      if (message?.type === "APE_SPEAK") return speak(message.text);
      if (message?.type === "APE_SAVE") return saveNote(message);
      if (message?.type === "APE_GET_NOTES") {
        const data = await getStorage([NOTES_KEY]);
        return { ok: true, notes: Array.isArray(data[NOTES_KEY]) ? data[NOTES_KEY] : [] };
      }
      if (message?.type === "APE_DELETE_NOTE") {
        const data = await getStorage([NOTES_KEY]);
        const notes = (Array.isArray(data[NOTES_KEY]) ? data[NOTES_KEY] : []).filter((note) => note.id !== message.id);
        await setStorage({ [NOTES_KEY]: notes });
        return { ok: true, notes };
      }
      if (message?.type === "APE_CLEAR_NOTES") {
        await setStorage({ [NOTES_KEY]: [] });
        return { ok: true, notes: [] };
      }
      return { ok: false, message: "Ação desconhecida." };
    };
    run().then(sendResponse).catch((error) => sendResponse({ ok: false, message: error.message || "Falha na extensão." }));
    return true;
  });
})();
