const test = require("node:test");
const assert = require("node:assert/strict");

const { parseFlomoHtml } = require("../src/core/parseFlomo");
const { parseWeixinText } = require("../src/core/parseWeixin");

test("parseFlomoHtml should parse memos, tags, files and sort by time desc", () => {
  const html = `
  <div class="memo">
    <div class="time">2024-01-01 10:00:00</div>
    <div class="content"><p>First #tag1</p></div>
    <div class="files"><img src="a.png" /></div>
  </div>
  <div class="memo">
    <div class="time">2024-01-02 10:00:00</div>
    <div class="content"><p>Second #tag2</p></div>
    <div class="files"><img src="b.png" /></div>
  </div>`;

  const memos = parseFlomoHtml(html);

  assert.equal(memos.length, 2);
  assert.equal(memos[0].content.includes("Second"), true);
  assert.deepEqual(memos[0].tags, ["tag2"]);
  assert.deepEqual(memos[0].files, ["b.png"]);
  assert.deepEqual(memos[1].tags, ["tag1"]);
});

test("parseWeixinText should parse chapters and skip review section", () => {
  const content = [
    "《Book Name》",
    "author",
    "",
    "",
    "◆ Chapter 1",
    "line one",
    "",
    "line two",
    "",
    "",
    "◆  点评",
    "ignore line",
    "",
    "",
  ].join("\n");

  const parsed = parseWeixinText(content);

  assert.equal(parsed.bookName, "Book Name");
  assert.equal(parsed.tag, "#微信读书/Book Name");
  assert.equal(parsed.notes.length, 2);
  assert.equal(parsed.notes[0].chapterTitle, "Chapter 1");
  assert.equal(parsed.notes[0].content, "line one");
  assert.equal(parsed.notes[1].content, "line two");
});
