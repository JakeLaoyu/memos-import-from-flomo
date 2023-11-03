const fs = require("fs-extra");
const path = require("path");
const mime = require("mime");
const axios = require("axios");
const FormData = require("form-data");
const { getRequestUrl, getAccessToken, openApi } = require("./utils");

const SLEEP = 1000;

('   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6InYxIiwidHlwIjoiSldUIn0.eyJuYW1lIjoibGlueHVhbiIsImlzcyI6Im1lbW9zIiwic3ViIjoiMSIsImF1ZCI6WyJ1c2VyLmFjY2Vzcy10b2tlbiJdLCJleHAiOjE2OTg5NDc1NjEsImlhdCI6MTY5ODkxODc2MX0.B2ZLB0ozSIxYcR9J_TqWnS4H94jFAuYYzROo08_Yp_M');
default_header = {
  Authorization: `Bearer ${getAccessToken()}`,
};
const getVersion = () => {
    // XXX 不清楚v1 v2的区别
  if (openApi.includes("/v2")) return "/v2";
  return "/v1";
};

exports.uploadFile = async (filePath) => {
  const readFile = fs.readFileSync(filePath);

  const formData = new FormData();
  formData.append("file", readFile, {
    filename: path.basename(filePath),
    contentType: mime.getType(filePath) || undefined,
  });

  return axios({
    method: "post",
    url: getRequestUrl(`/api${getVersion()}/resource/blob`),
    data: formData,
    headers: default_header,
  }).then((res) => res.data);
};

exports.sendMemo = async (memo) => {
  return axios({
    method: "post",
    url: getRequestUrl(`/api${getVersion()}/memo`),
    data: memo,
    headers: {
      ...default_header,
      "Content-Type": "application/json; charset=UTF-8",
    },
  }).then(async (res) => {
    await new Promise((resolve) => setTimeout(resolve, SLEEP));

    return res;
  });
};

exports.sendTag = async (tag) => {
  return axios({
    method: "post",
    url: getRequestUrl(`/api${getVersion()}/tag`),
    data: {
      name: tag,
    },
    headers: {
      ...default_header,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
};

exports.deleteMemo = async (memoId) => {
  return axios({
    method: "delete",
    url: getRequestUrl(`/api${getVersion()}/memo/${memoId}`),
    headers: {
      ...default_header,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
};
