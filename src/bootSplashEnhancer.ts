import { pitecoFullbodyHead } from "./assets/piteco-fullbody-head";

const mascot = document.getElementById("boot-mascot") as HTMLImageElement | null;

if (mascot) {
  const reveal = () => mascot.classList.add("boot-mascot--ready");
  mascot.addEventListener("load", reveal, { once: true });
  mascot.addEventListener("error", () => mascot.remove(), { once: true });
  mascot.src = `data:image/webp;base64,${pitecoFullbodyHead}`;

  if (mascot.complete && mascot.naturalWidth > 0) reveal();
}
