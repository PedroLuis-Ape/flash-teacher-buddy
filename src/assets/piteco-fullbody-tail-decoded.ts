import { pitecoFullbodyTailHex } from "./piteco-fullbody-tail";

let decodedTail = "";
for (let index = 0; index < pitecoFullbodyTailHex.length; index += 2) {
  decodedTail += String.fromCharCode(
    Number.parseInt(pitecoFullbodyTailHex.slice(index, index + 2), 16),
  );
}

export const pitecoFullbodyTail = decodedTail;
