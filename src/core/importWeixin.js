const path = require("path");
const fs = require("fs-extra");
const { createApiClient } = require("./apiClient");
const { parseWeixinText } = require("./parseWeixin");
const { getDefaultArtifactDir } = require("./artifactStore");

function noop() {}

async function importWeixin(options) {
  const {
    openApi,
    accessToken,
    txtPath,
    artifactDir = getDefaultArtifactDir(),
    onEvent = noop,
    sleepMs,
  } = options;

  if (!txtPath) {
    throw new Error("txtPath is required");
  }

  const client = createApiClient({ openApi, accessToken, sleepMs });
  const sentIdsPath = path.join(artifactDir, "sendedIds.json");

  fs.removeSync(sentIdsPath);

  const text = fs.readFileSync(txtPath, "utf8");
  const parsed = parseWeixinText(text);
  const sendedMemoNames = [];

  onEvent({ type: "started", message: "Weixin import started", data: { total: parsed.notes.length } });

  let currentCount = 0;
  for (const note of parsed.notes) {
    currentCount += 1;
    onEvent({
      type: "progress",
      message: `Sending memo ${currentCount}/${parsed.notes.length}`,
      data: { current: currentCount, total: parsed.notes.length },
    });

    const response = await client.sendMemo({
      content: `${note.content}\n\n章节: ${note.chapterTitle}\n\n${parsed.tag}`,
    });

    const memoName = client.extractMemoName(response);
    if (!memoName) {
      throw new Error("Cannot resolve memo name from response");
    }

    sendedMemoNames.push(memoName);
    fs.writeJSONSync(sentIdsPath, sendedMemoNames, { spaces: 2 });

    onEvent({ type: "success", message: `Memo sent: ${memoName}` });
  }

  const result = {
    total: parsed.notes.length,
    success: sendedMemoNames.length,
    failed: 0,
    sentIdsPath,
  };

  onEvent({ type: "finished", message: "Weixin import finished", data: result });
  return result;
}

module.exports = {
  importWeixin,
};
