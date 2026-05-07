const path = require("path");

const SUPPORTED_KINDS = new Set(["flomo", "weixin"]);

function isSupportedUploadKind(kind) {
  return SUPPORTED_KINDS.has(kind);
}

function normalizeExt(filename) {
  return path.extname(filename || "").toLowerCase();
}

function isSupportedFileForKind(kind, filename) {
  if (kind === "flomo") {
    return true;
  }
  if (kind === "weixin") {
    const ext = normalizeExt(filename);
    return ext === ".txt";
  }
  return false;
}

function sanitizeRelativePath(inputPath) {
  const normalized = path
    .normalize(String(inputPath || ""))
    .replace(/^(\.\.(\/|\\|$))+/, "")
    .replace(/^[/\\]+/, "");
  if (!normalized || normalized === ".") {
    return "";
  }
  return normalized;
}

function resolveFlomoEntryHtml(savedRelativePaths) {
  const htmlCandidates = savedRelativePaths
    .filter((item) => {
      const ext = path.extname(item).toLowerCase();
      return ext === ".html" || ext === ".htm";
    })
    .sort((a, b) => {
      const aIsIndex = /(^|[/\\])index\.html?$/i.test(a);
      const bIsIndex = /(^|[/\\])index\.html?$/i.test(b);
      if (aIsIndex && !bIsIndex) return -1;
      if (!aIsIndex && bIsIndex) return 1;
      return a.length - b.length;
    });

  return htmlCandidates[0] || "";
}

module.exports = {
  isSupportedUploadKind,
  isSupportedFileForKind,
  sanitizeRelativePath,
  resolveFlomoEntryHtml,
};
