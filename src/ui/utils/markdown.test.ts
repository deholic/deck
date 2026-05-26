import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings and paragraphs with inline formatting", () => {
    const input = "# Hello\n\nLine *em*\nNext";
    const output = renderMarkdown(input);

    expect(output).toBe("<h1>Hello</h1><p>Line <em>em</em><br />Next</p>");
  });

  it("renders unordered lists", () => {
    const input = "- one\n- two";
    const output = renderMarkdown(input);

    expect(output).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("escapes code blocks", () => {
    const input = "```\nconst a = 1 & 2\n```";
    const output = renderMarkdown(input);

    expect(output).toBe("<pre><code>const a = 1 &amp; 2</code></pre>");
  });

  it("escapes link URLs", () => {
    const input = "[go](https://example.com/a(b))";
    const output = renderMarkdown(input);

    expect(output).toBe(
      '<p><a href="https://example.com/a%28b" target="_blank" rel="noreferrer">go</a>)</p>'
    );
  });

  it("renders custom emojis outside inline code", () => {
    const input = "hi :wave: `:wave:`";
    const emojiMap = new Map([["wave", "https://example.com/wave.png"]]);
    const output = renderMarkdown(input, emojiMap);

    expect(output).toBe(
      '<p>hi <img src="https://example.com/wave.png" alt=":wave:" class="custom-emoji" loading="lazy" /> <code>:wave:</code></p>'
    );
  });

  it("linkifies bare URLs", () => {
    const input = "visit https://example.com/test.";
    const output = renderMarkdown(input);

    expect(output).toBe(
      '<p>visit <a href="https://example.com/test" target="_blank" rel="noreferrer">https://example.com/test</a>.</p>'
    );
  });

  it("does not double-link markdown links", () => {
    const input = "[link](https://example.com) https://example.com";
    const output = renderMarkdown(input);

    expect(output).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noreferrer">link</a> <a href="https://example.com" target="_blank" rel="noreferrer">https://example.com</a></p>'
    );
  });

  it("does not render emoji shortcodes inside URLs", () => {
    const input = "https://example.com/:wave:/path";
    const emojiMap = new Map([["wave", "https://example.com/wave.png"]]);
    const output = renderMarkdown(input, emojiMap);

    expect(output).toBe(
      '<p><a href="https://example.com/:wave:/path" target="_blank" rel="noreferrer">https://example.com/:wave:/path</a></p>'
    );
  });

  it("renders emojis inside markdown link labels", () => {
    const input = "[go :wave:](https://example.com)";
    const emojiMap = new Map([["wave", "https://example.com/wave.png"]]);
    const output = renderMarkdown(input, emojiMap);

    expect(output).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noreferrer">go <img src="https://example.com/wave.png" alt=":wave:" class="custom-emoji" loading="lazy" /></a></p>'
    );
  });
});
