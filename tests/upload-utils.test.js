const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isSupportedUploadKind,
  isSupportedFileForKind,
  sanitizeRelativePath,
  resolveFlomoEntryHtml,
} = require("../src/server/uploadUtils");

test("isSupportedUploadKind should accept flomo and weixin", () => {
  assert.equal(isSupportedUploadKind("flomo"), true);
  assert.equal(isSupportedUploadKind("weixin"), true);
  assert.equal(isSupportedUploadKind("other"), false);
});

test("isSupportedFileForKind should validate ext by kind", () => {
  assert.equal(isSupportedFileForKind("flomo", "index.html"), true);
  assert.equal(isSupportedFileForKind("flomo", "index.htm"), true);
  assert.equal(isSupportedFileForKind("flomo", "file/abc.png"), true);
  assert.equal(isSupportedFileForKind("flomo", "assets/app.css"), true);

  assert.equal(isSupportedFileForKind("weixin", "notes.txt"), true);
  assert.equal(isSupportedFileForKind("weixin", "notes.html"), false);
});

test("sanitizeRelativePath should remove unsafe prefixes", () => {
  assert.equal(sanitizeRelativePath("../a/b/index.html"), "a/b/index.html");
  assert.equal(sanitizeRelativePath("/tmp/a.txt"), "tmp/a.txt");
});

test("resolveFlomoEntryHtml should choose index.html first", () => {
  const result = resolveFlomoEntryHtml(["file/a.png", "index.html", "nested/other.html"]);
  assert.equal(result, "index.html");
});
