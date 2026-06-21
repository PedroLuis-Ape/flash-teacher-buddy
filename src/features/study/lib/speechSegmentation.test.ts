import { describe, expect, it } from "vitest";
import { segmentTextForTTS } from "./speechSegmentation";

describe("segmentTextForTTS", () => {
  it("segments a basic sentence", () => {
    expect(segmentTextForTTS("I am at home.")).toEqual(["I", "am", "at", "home"]);
  });

  it("preserves contractions", () => {
    expect(segmentTextForTTS("I'm at home.")).toEqual(["I'm", "at", "home"]);
  });

  it("removes punctuation as isolated tokens", () => {
    expect(segmentTextForTTS("Hello, how are you?")).toEqual(["Hello", "how", "are", "you"]);
  });

  it("normalizes repeated spaces", () => {
    expect(segmentTextForTTS("I   am   here.")).toEqual(["I", "am", "here"]);
  });

  it("preserves hyphenated words", () => {
    expect(segmentTextForTTS("I have a part-time job.")).toEqual(["I", "have", "a", "part-time", "job"]);
  });

  it("returns an empty array for blank input", () => {
    expect(segmentTextForTTS("   ")).toEqual([]);
  });

  it("removes markup before segmentation", () => {
    const open = String.fromCharCode(60) + "strong" + String.fromCharCode(62);
    const close = String.fromCharCode(60) + "/strong" + String.fromCharCode(62);
    expect(segmentTextForTTS(`${open}I am here.${close}`)).toEqual(["I", "am", "here"]);
  });
});
