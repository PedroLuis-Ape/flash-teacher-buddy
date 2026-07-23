(() => {
  "use strict";
  const notesNode = document.getElementById("notes");
  const countNode = document.getElementById("count");
  const statusNode = document.getElementById("status");
  const template = document.getElementById("note-template");
  let notes = [];

  const send = (message) => new Promise((resolve) => chrome.runtime.sendMessage(message, (response) => resolve(response || { ok: false })));
  const sourceLabel = (note) => {
    try { return new URL(note.pageUrl).hostname; } catch { return note.pageTitle || "Página"; }
  };

  function render() {
    notesNode.textContent = "";
    countNode.textContent = `${notes.length} nota${notes.length === 1 ? "" : "s"}`;
    if (!notes.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Nenhuma nota salva ainda.";
      notesNode.appendChild(empty);
      return;
    }
    notes.forEach((note) => {
      const fragment = template.content.cloneNode(true);
      fragment.querySelector(".text").textContent = note.text;
      fragment.querySelector(".source").textContent = sourceLabel(note);
      fragment.querySelector('[data-action="speak"]').addEventListener("click", () => void send({ type: "APE_SPEAK", text: note.text }));
      fragment.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        const result = await send({ type: "APE_DELETE_NOTE", id: note.id });
        if (result.ok) { notes = result.notes; render(); }
      });
      notesNode.appendChild(fragment);
    });
  }

  document.getElementById("clear").addEventListener("click", async () => {
    if (!notes.length || !confirm("Apagar todas as notas da extensão?")) return;
    const result = await send({ type: "APE_CLEAR_NOTES" });
    if (result.ok) { notes = []; render(); statusNode.textContent = "Notas apagadas."; }
  });

  send({ type: "APE_GET_NOTES" }).then((result) => {
    notes = result.ok && Array.isArray(result.notes) ? result.notes : [];
    render();
  });
})();
