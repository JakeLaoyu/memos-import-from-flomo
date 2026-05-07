const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const fs = require("fs-extra");

const { importFlomo } = require("../src/core/importFlomo");

test("importFlomo should skip missing resource files and continue sending memos", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "memos-flomo-test-"));
  const htmlPath = path.join(tmpDir, "index.html");

  fs.writeFileSync(
    htmlPath,
    `<div class="memo"><div class="time">2024-01-01 00:00:00</div><div class="content"><p>hello</p></div><div class="files"><img src="file/not-exists.png" /></div></div>`
  );

  let sendMemoCount = 0;
  const events = [];

  const mockClient = {
    uploadAttachment: async () => {
      throw new Error("should not be called for missing file");
    },
    sendMemo: async () => {
      sendMemoCount += 1;
      return { data: { name: `memos/${sendMemoCount}` } };
    },
    updateMemo: async () => {},
    extractMemoName: (res) => res?.data?.name,
  };

  const result = await importFlomo({
    openApi: "http://localhost:5230/api/v1",
    accessToken: "token",
    htmlPath,
    artifactDir: tmpDir,
    onEvent: (event) => events.push(event),
    apiClient: mockClient,
  });

  assert.equal(result.success, 1);
  assert.equal(sendMemoCount, 1);
  assert.equal(events.some((e) => e.type === "log" && e.message.includes("资源文件不存在，已跳过")), true);
});
