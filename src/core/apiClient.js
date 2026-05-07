const fs = require("fs-extra");
const path = require("path");
const mime = require("mime");
const axios = require("axios");
const parse = require("url-parse");

const DEFAULT_SLEEP_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getVersion(openApi) {
  if ((openApi || "").includes("/v2")) return "/v2";
  return "/v1";
}

function getRequestUrl(openApi, requestPath) {
  const { origin } = parse(openApi || "");
  return `${origin}${requestPath}`;
}

function extractMemoName(responseData) {
  return responseData?.data?.name || responseData?.data?.data?.name;
}

function createApiClient(options) {
  const { openApi, accessToken, sleepMs = DEFAULT_SLEEP_MS } = options;

  if (!openApi) {
    throw new Error("openApi is required");
  }
  if (!accessToken) {
    throw new Error("accessToken is required");
  }

  const version = getVersion(openApi);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  return {
    async uploadAttachment(filePath, memoName) {
      const readFile = fs.readFileSync(filePath);
      const response = await axios({
        method: "post",
        url: getRequestUrl(openApi, `/api${version}/attachments`),
        data: {
          content: readFile.toString("base64"),
          filename: path.basename(filePath),
          type: mime.getType(filePath) || undefined,
          memo: memoName,
        },
        headers,
      });

      return response.data;
    },

    async sendMemo(memo) {
      const response = await axios({
        method: "post",
        url: getRequestUrl(openApi, `/api${version}/memos`),
        data: memo,
        headers: {
          ...headers,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });

      await sleep(sleepMs);
      return response;
    },

    async updateMemo(memoName, createTime) {
      return axios({
        method: "patch",
        url: getRequestUrl(openApi, `/api${version}/${memoName}`),
        data: { createTime },
        headers: {
          ...headers,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });
    },

    async deleteMemo(memoName) {
      return axios({
        method: "delete",
        url: getRequestUrl(openApi, `/api${version}/${memoName}`),
        headers: {
          ...headers,
          "Content-Type": "application/json; charset=UTF-8",
        },
      });
    },

    extractMemoName,
  };
}

module.exports = {
  createApiClient,
  extractMemoName,
};
