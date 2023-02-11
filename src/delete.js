const path = require("path");
const fs = require("fs-extra");
const { deleteMemo } = require("./utils/api");

const idsFilePath = path.join(process.cwd(), "sendedIds.json");
const ids = fs.readJSONSync(idsFilePath);

for (const id of ids) {
  deleteMemo(id).then(() => {
    console.log("delete success", id);
  });
}
