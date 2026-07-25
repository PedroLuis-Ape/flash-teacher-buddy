from pathlib import Path

path = Path("src/pages/Study.tsx")
text = path.read_text(encoding="utf-8")

old = """    currentIndex,\n    progress,\n    correctCount,\n"""
new = """    currentIndex,\n    correctCount,\n"""
if text.count(old) != 1:
    raise RuntimeError(f"progress destructure: expected one match, found {text.count(old)}")
text = text.replace(old, new, 1)

old = '<div className="text-3xl font-bold text-warning">{skippedCount}</div>'
new = '<div className="text-3xl font-bold text-warning">{isFlipMode ? skippedCount : (masteryRoundSummary?.skippedCards ?? 0)}</div>'
if text.count(old) != 1:
    raise RuntimeError(f"round skipped count: expected one match, found {text.count(old)}")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
