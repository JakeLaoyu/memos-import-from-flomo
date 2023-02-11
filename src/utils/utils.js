const path = require("path");
const parse = require("url-parse");

const [, , openApi, htmlPath] = process.argv;

exports.openApi = openApi;
exports.htmlPath = htmlPath;

exports.getOpenId = () => {
  const { query } = parse(openApi);
  const parseQuery = parse.qs.parse(query);

  return parseQuery.openId;
};

exports.getRequestUrl = (path = "") => {
  const { origin } = parse(openApi);
  const url = `${origin}${path}`;
  return url;
};

exports.getFilePath = (filePath) => {
  return path.resolve(process.cwd(), path.dirname(htmlPath), filePath);
};

exports.mergePromise = async function mergePromise(arr) {
  var mergedAjax = Promise.resolve();
  var data = [];
  for (let promise of arr) {
    mergedAjax = mergedAjax.then(() => {
      return promise().then((val) => {
        data.push(val);
      });
    });
  }
  return mergedAjax.then(() => {
    return data;
  });
};
