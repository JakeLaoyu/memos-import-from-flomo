const fs = require("fs-extra");
const path = require("path");
const mime = require("mime");
const axios = require("axios");
const FormData = require("form-data");
const { getRequestUrl, getOpenId, openApi } = require("./utils");

const SLEEP = 1000;

exports.uploadFile = async (filePath) => {
  const readFile = fs.readFileSync(filePath);

  const formData = new FormData();
  formData.append("file", readFile, {
    filename: path.basename(filePath),
    contentType: mime.getType(filePath) || undefined,
  });

  return axios({
    method: "post",
    url: getRequestUrl(`/api/v1/resource/blob?openId=${getOpenId()}`),
    data: formData,
  }).then((res) => res.data);
};

exports.sendMemo = async (memo) => {
  return axios({
    method: "post",
    url: openApi,
    data: memo,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  }).then(async (res) => {
    await new Promise((resolve) => setTimeout(resolve, SLEEP));

    return res;
  });
};

exports.deleteMemo = async (memoId) => {
  return axios({
    method: "delete",
    url: getRequestUrl(`/api/v1/memo/${memoId}?openId=${getOpenId()}`),
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
};
