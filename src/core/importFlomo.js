const path = require("path");
const fs = require("fs-extra");
const { createApiClient } = require("./apiClient");
const { parseFlomoHtml } = require("./parseFlomo");
const { getDefaultArtifactDir } = require("./artifactStore");

function noop() {}

async function importFlomo(options) {
  const {
    openApi,
    accessToken,
    htmlPath,
    artifactDir = getDefaultArtifactDir(),
    onEvent = noop,
    sleepMs,
    apiClient,
  } = options;

  if (!htmlPath) {
    throw new Error("htmlPath is required");
  }

  const client = apiClient || createApiClient({ openApi, accessToken, sleepMs });
  const memoJsonPath = path.join(artifactDir, "memo.json");
  const sentIdsPath = path.join(artifactDir, "sendedIds.json");

  fs.removeSync(memoJsonPath);
  fs.removeSync(sentIdsPath);

  const html = fs.readFileSync(htmlPath, "utf8");
  const memoArr = parseFlomoHtml(html);
  const sendedMemoNames = [];

  onEvent({ type: "started", message: "Flomo import started", data: { total: memoArr.length } });

  fs.writeJSONSync(memoJsonPath, memoArr, { spaces: 2 });

  const sendOrder = [...memoArr].reverse();
  let currentCount = 0;

  for (const memo of sendOrder) {
    currentCount += 1;
    onEvent({
      type: "progress",
      message: `Sending memo ${currentCount}/${sendOrder.length}`,
      data: { current: currentCount, total: sendOrder.length },
    });

    const response = await client.sendMemo({
      content: memo.content,
    });

    const memoName = client.extractMemoName(response);
    if (!memoName) {
      throw new Error("Cannot resolve memo name from response");
    }

    sendedMemoNames.push(memoName);

    await client.updateMemo(memoName, new Date(memo.time).toISOString());

    for (const filePath of memo.files) {
      const fullPath = path.resolve(path.dirname(htmlPath), filePath);
      if (!fs.existsSync(fullPath)) {
        onEvent({ type: "log", message: `资源文件不存在，已跳过: ${filePath}` });
        continue;
      }
      onEvent({ type: "log", message: `Uploading attachment: ${filePath}` });
      await client.uploadAttachment(fullPath, memoName);
    }

    fs.writeJSONSync(sentIdsPath, sendedMemoNames, { spaces: 2 });
    onEvent({ type: "success", message: `Memo sent: ${memoName}` });
  }

  const result = {
    total: sendOrder.length,
    success: sendedMemoNames.length,
    failed: 0,
    sentIdsPath,
    memoJsonPath,
  };

  onEvent({ type: "finished", message: "Flomo import finished", data: result });
  return result;
}

module.exports = {
  importFlomo,
};
