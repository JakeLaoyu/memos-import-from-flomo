const { importFlomo } = require("./core/importFlomo");

const [, , openApi, accessToken, htmlPath] = process.argv;

if (!openApi || !accessToken || !htmlPath) {
  console.error("Usage: node ./src/main.js <your-api-host> <your-access-token> <html-path>");
  process.exit(1);
}

importFlomo({
  openApi,
  accessToken,
  htmlPath,
  onEvent(event) {
    const payload = event.data ? ` ${JSON.stringify(event.data)}` : "";
    console.log(`[${event.type}] ${event.message}${payload}`);
  },
})
  .then((result) => {
    console.log("Flomo import summary:", result);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
