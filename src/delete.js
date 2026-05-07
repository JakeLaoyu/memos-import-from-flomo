const { deleteImported } = require("./core/deleteImported");

const [, , openApi, accessToken] = process.argv;

if (!openApi || !accessToken) {
  console.error("Usage: node ./src/delete.js <your-api-host> <your-access-token>");
  process.exit(1);
}

deleteImported({
  openApi,
  accessToken,
  onEvent(event) {
    const payload = event.data ? ` ${JSON.stringify(event.data)}` : "";
    console.log(`[${event.type}] ${event.message}${payload}`);
  },
})
  .then((result) => {
    console.log("Delete summary:", result);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
