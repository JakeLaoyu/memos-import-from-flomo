const path = require("path");
const fs = require("fs-extra");
const { createApiClient } = require("./apiClient");
const { getDefaultArtifactDir } = require("./artifactStore");

function noop() {}

async function deleteImported(options) {
  const { openApi, accessToken, artifactDir = getDefaultArtifactDir(), onEvent = noop } = options;

  const client = createApiClient({ openApi, accessToken });
  const idsFilePath = path.join(artifactDir, "sendedIds.json");

  if (!fs.existsSync(idsFilePath)) {
    throw new Error(`sendedIds.json not found: ${idsFilePath}`);
  }

  const ids = fs.readJSONSync(idsFilePath);

  onEvent({ type: "started", message: "Delete started", data: { total: ids.length } });

  let current = 0;
  for (const id of ids) {
    current += 1;
    onEvent({ type: "progress", message: `Deleting ${current}/${ids.length}`, data: { current, total: ids.length } });
    await client.deleteMemo(id);
    onEvent({ type: "success", message: `Deleted: ${id}` });
  }

  const result = {
    total: ids.length,
    success: ids.length,
    failed: 0,
  };

  onEvent({ type: "finished", message: "Delete finished", data: result });
  return result;
}

module.exports = {
  deleteImported,
};
