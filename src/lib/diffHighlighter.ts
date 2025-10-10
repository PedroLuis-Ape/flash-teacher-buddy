// Utility to highlight differences between two strings

export interface DiffToken {
  text: string;
  type: "match" | "insert" | "delete";
}

export function getDiffTokens(input: string, correct: string): DiffToken[] {
  const tokens: DiffToken[] = [];
  const maxLen = Math.max(input.length, correct.length);

  for (let i = 0; i < maxLen; i++) {
    const inputChar = input[i] || "";
    const correctChar = correct[i] || "";

    if (inputChar === correctChar) {
      if (tokens.length > 0 && tokens[tokens.length - 1].type === "match") {
        tokens[tokens.length - 1].text += inputChar;
      } else {
        tokens.push({ text: inputChar, type: "match" });
      }
    } else {
      if (inputChar && !correctChar) {
        tokens.push({ text: inputChar, type: "insert" });
      } else if (!inputChar && correctChar) {
        tokens.push({ text: correctChar, type: "delete" });
      } else {
        tokens.push({ text: inputChar, type: "insert" });
        tokens.push({ text: correctChar, type: "delete" });
      }
    }
  }

  return tokens;
}
