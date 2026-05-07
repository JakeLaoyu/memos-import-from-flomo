const fs = require("fs-extra");
const path = require("path");
const mime = require("mime");
const axios = require("axios");
const { getRequestUrl, getAccessToken, openApi } = require("./utils");

const SLEEP = 1000;

const defaultHeader = {
  Authorization: `Bearer ${getAccessToken()}`,
};
const getVersion = () => {
  if (openApi.includes("/v2")) return "/v2";
  return "/v1";
};

exports.uploadAttachment = async (filePath, memoName) => {
  const readFile = fs.readFileSync(filePath);

  return axios({
    method: "post",
    url: getRequestUrl(`/api${getVersion()}/attachments`),
    data: {
      content: readFile.toString("base64"),
      filename: path.basename(filePath),
      type: mime.getType(filePath) || undefined,
      memo: memoName,
    },
    headers: defaultHeader,
  }).then((res) => res.data);
};

exports.sendMemo = async (memo) => {
  return axios({
    method: "post",
    url: getRequestUrl(`/api${getVersion()}/memos`),
    data: memo,
    headers: {
      ...defaultHeader,
      "Content-Type": "application/json; charset=UTF-8",
    },
  }).then(async (res) => {
    await new Promise((resolve) => setTimeout(resolve, SLEEP));

    return res;
  });
};

exports.updateMemo = async (memoName, createTime) => {
  return axios({
    method: "patch",
    url: getRequestUrl(`/api${getVersion()}/${memoName}`),
    data: { createTime },
    headers: {
      ...defaultHeader,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
};

exports.setMemoResources = async (memoName, resources) => {
  const options = {
    method: "PATCH",
    url: getRequestUrl(`/api${getVersion()}/${memoName}/resources`),
    data: {
      resources: resources,
    },
    headers: {
      ...defaultHeader,
      "Content-Type": "application/json; charset=UTF-8",
    },
  };

  return axios(options);
};

exports.deleteMemo = async (memoName) => {
  return axios({
    method: "delete",
    url: getRequestUrl(`/api${getVersion()}/${memoName}`),
    headers: {
      ...defaultHeader,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
};
