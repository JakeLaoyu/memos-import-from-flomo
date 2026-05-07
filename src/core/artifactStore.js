const os = require("os");
const path = require("path");
const fs = require("fs-extra");

const ARTIFACT_DIR_ENV = "MEMOS_ARTIFACT_DIR";

function getDefaultArtifactDir() {
  const fromEnv = process.env[ARTIFACT_DIR_ENV];
  const dir = fromEnv ? path.resolve(fromEnv) : path.join(os.tmpdir(), "memos-import-artifacts");
  fs.ensureDirSync(dir);
  return dir;
}

module.exports = {
  ARTIFACT_DIR_ENV,
  getDefaultArtifactDir,
};

