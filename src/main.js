const fs = require("fs-extra");
const cheerio = require("cheerio");
var TurndownService = require("turndown");
const chalk = require("chalk");

const { htmlPath, getFilePath, mergePromise, errorTip } = require("./utils/utils");
const { uploadFile, sendMemo, setMemoResources } = require("./utils/api");

fs.removeSync("./memo.json");
fs.removeSync("./sendedIds.json");

const sendedMemoNames = [];
const memoArr = [];

const $ = cheerio.load(fs.readFileSync(htmlPath, "utf8"));

const memos = $(".memo");

for (const memo of memos) {
  const time = $(memo).find(".time").text();
  let content = "";
  let tags = [];
  let files = [];

  $(memo)
    .find(".content")
    .each((index, html) => {
      let text = $(html).html();

      var turndownService = new TurndownService();
      text = turndownService.turndown(text);

      content += `${content ? "\n" : ""}${text}`;
    }, "");

  // 正则通过 #xxx 获取标签
  const tagReg = /#(\S*)/g;
  const tagMatch = content.match(tagReg);
  if (tagMatch) {
    tags = tagMatch.map((item) => item.replace("#", "")).filter(tag => !!tag);
  }

  $(memo)
    .find(".files img")
    .each((index, img) => {
      const src = $(img).attr("src");
      files.push(src);
    });

  memoArr.push({
    time,
    content,
    files,
    tags,
  });
}

memoArr.sort((a, b) => {
  return new Date(b.time) - new Date(a.time);
});

async function uploadFileHandler() {
  console.log(chalk.green("======================= 上传资源 ======================="));
  for (const memo of memoArr) {
    memoArr.resourceList = memoArr.resourceList || [];
    const uploadFilePromiseArr = [];
    if (memo.files.length) {
      for (const filePath of memo.files) {
        const fullPath = getFilePath(filePath);
        uploadFilePromiseArr.push(() => {
          console.log(chalk.green("开始上传"), filePath);
          return uploadFile(fullPath);
        });
      }
    }

    await mergePromise(uploadFilePromiseArr).then((res) => {
      memo.resources = [...memo.resources || [], ...res];
    });
  }

  console.log(chalk.green("======================= 上传资源 end ======================="));
}

async function sendMemoHandler() {
  const sendMemoPromiseArr = [];

  fs.writeJSONSync("./memo.json", memoArr);

  
  for (const memo of memoArr) {
    let content = memo.content;

    memo.tags.forEach((tag) => {
      content += ` #${tag}`;
    })


    sendMemoPromiseArr.unshift(async () => {
      try {
        return await sendMemo({
          content: memo.content,
          createdTs: new Date(memo.time).getTime() / 1000,
        }).then(async (res) => {
          sendedMemoNames.push(res?.data?.name || res?.data?.data?.name);

          await setMemoResources(res?.data?.name, memo.resources);

          fs.writeJSONSync("./sendedIds.json", sendedMemoNames);
        });
      } catch (error) {
        errorTip(error);
      }
    });
  }

  await mergePromise(sendMemoPromiseArr);
}

uploadFileHandler().then(sendMemoHandler);
