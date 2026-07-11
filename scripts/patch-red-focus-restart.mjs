import fs from "node:fs";

const path = "src/features/study/hooks/useStudyEngine.ts";
let source = fs.readFileSync(path, "utf8");

const randomOld = '(mode === "mixed" && !gameSettings.redFocus) || gameSettings.mode === "random"';
const randomNew = '!gameSettings.redFocus && (mode === "mixed" || gameSettings.mode === "random")';
const randomCount = source.split(randomOld).length - 1;
if (randomCount !== 3) {
  throw new Error(`Expected 3 red-focus random guards, found ${randomCount}`);
}
source = source.split(randomOld).join(randomNew);

const restartRandomOld = "    if (settings.mode === 'random') cardIds = cardIds.sort(() => Math.random() - 0.5);";
const restartRandomNew = "    if (!settings.redFocus && settings.mode === 'random') cardIds = cardIds.sort(() => Math.random() - 0.5);";
if (!source.includes(restartRandomOld)) {
  throw new Error("Restart random guard was not found");
}
source = source.replace(restartRandomOld, restartRandomNew);

const restartInjectionOld = "      settings.subset === 'favorites',";
const restartInjectionNew = "      shouldInjectRedPriority(settings),";
if (!source.includes(restartInjectionOld)) {
  throw new Error("Restart red injection condition was not found");
}
source = source.replace(restartInjectionOld, restartInjectionNew);

fs.writeFileSync(path, source);
