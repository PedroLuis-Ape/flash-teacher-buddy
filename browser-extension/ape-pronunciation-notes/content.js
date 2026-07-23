(() => {
  "use strict";

  const HOST_ID = "ape-pronunciation-toolbar";
  let selectedText = "";
  let hideTimer = 0;

  function send(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => resolve(response || { ok: false }));
    });
  }

  function removeToolbar() {
    window.clearTimeout(hideTimer);
    document.getElementById(HOST_ID)?.remove();
  }

  function showFeedback(button, text) {
    const old = button.textContent;
    button.textContent = text;
    hideTimer = window.setTimeout(() => {
      button.textContent = old;
      removeToolbar();
    }, 1200);
  }

  function createToolbar(rect) {
    removeToolbar();
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.left = `${Math.max(12, Math.min(window.innerWidth - 210, rect.left + rect.width / 2 - 95))}px`;
    host.style.top = `${Math.max(12, rect.top - 52)}px`;
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "auto";

    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .bar { display:flex; gap:6px; align-items:center; border:1px solid #c4b5fd; border-radius:14px; background:#fff; box-shadow:0 16px 45px rgba(15,23,42,.25); padding:6px; font:700 13px/1.2 Inter,system-ui,sans-serif; }
        button { min-height:34px; border:0; border-radius:10px; padding:0 11px; cursor:pointer; font:inherit; }
        .speak { background:#7c3aed; color:#fff; }
        .save { background:#ede9fe; color:#4c1d95; }
      </style>
      <div class="bar" role="toolbar" aria-label="APE Pronúncia e Notas">
        <button class="speak" type="button">🔊 Ouvir</button>
        <button class="save" type="button">📝 Salvar</button>
      </div>`;

    const speakButton = root.querySelector(".speak");
    const saveButton = root.querySelector(".save");
    speakButton.addEventListener("pointerdown", (event) => event.preventDefault());
    saveButton.addEventListener("pointerdown", (event) => event.preventDefault());
    speakButton.addEventListener("click", async () => {
      const result = await send({ type: "APE_SPEAK", text: selectedText });
      showFeedback(speakButton, result.ok ? "▶ Tocando" : "Falhou");
    });
    saveButton.addEventListener("click", async () => {
      const result = await send({ type: "APE_SAVE", text: selectedText, pageUrl: location.href, pageTitle: document.title });
      showFeedback(saveButton, result.ok ? "✓ Salvo" : "Falhou");
    });

    document.documentElement.appendChild(host);
    hideTimer = window.setTimeout(removeToolbar, 8000);
  }

  function handleSelection() {
    window.setTimeout(() => {
      const selection = window.getSelection();
      const text = String(selection?.toString() || "").replace(/\s+/g, " ").trim().slice(0, 12000);
      if (!text || !selection?.rangeCount) {
        removeToolbar();
        return;
      }
      selectedText = text;
      createToolbar(selection.getRangeAt(0).getBoundingClientRect());
    }, 0);
  }

  document.addEventListener("mouseup", handleSelection, true);
  document.addEventListener("keyup", (event) => {
    if (event.key === "Shift" || event.key.startsWith("Arrow")) handleSelection();
  }, true);
  document.addEventListener("scroll", removeToolbar, true);
  document.addEventListener("mousedown", (event) => {
    if (!event.composedPath().some((node) => node?.id === HOST_ID)) removeToolbar();
  }, true);
})();
