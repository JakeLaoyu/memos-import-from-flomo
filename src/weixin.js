const { importWeixin } = require("./core/importWeixin");

const [, , openApi, accessToken, txtPath] = process.argv;

if (!openApi || !accessToken || !txtPath) {
  console.error("Usage: node ./src/weixin.js <your-api-host> <your-access-token> <txt-path>");
  process.exit(1);
}

importWeixin({
  openApi,
  accessToken,
  txtPath,
  onEvent(event) {
    const payload = event.data ? ` ${JSON.stringify(event.data)}` : "";
    console.log(`[${event.type}] ${event.message}${payload}`);
  },
})
  .then((result) => {
    console.log("Weixin import summary:", result);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
