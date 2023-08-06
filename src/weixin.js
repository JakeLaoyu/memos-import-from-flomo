const fs = require("fs-extra");
const { htmlPath, getFilePath, mergePromise } = require("./utils/utils");
const { sendMemo, sendTag } = require("./utils/api");

const contentParse = {
  bookInfo: [],
  chapterInfo: [],
};

const fullPath = getFilePath(htmlPath);

const fileContent = fs.readFileSync(fullPath, "utf8");

const fileContentArr = fileContent.split("\n");

let curContent = [];
let curChapterTitle = "";
for (const index in fileContentArr) {
  const line = fileContentArr[index];

  if (line.length && line.startsWith("◆ ")) {
    curChapterTitle = line;
  } else {
    curContent.push(line);
  }

  if (!line.length && !fileContentArr[index - 1].length) {
    if (!contentParse.bookInfo.length) {
      contentParse.bookInfo = curContent;
    } else {
      contentParse.chapterInfo.push({
        title: curChapterTitle,
        content: curContent,
      });
    }

    curContent = [];
  }
}

// fs.writeJsonSync("./content.json", contentParse);

const bookname = contentParse.bookInfo[0].replaceAll("《", "").replaceAll("》", "");
const tag = `#微信读书/${bookname}`;

const sendMemoPromiseArr = [];

for (const chapter of contentParse.chapterInfo) {
  if (chapter.title.includes("◆  点评")) continue;

  const chapterTitle = chapter.title.replace("◆ ", "").trim();

  let curContent = [];
  for (const index in chapter.content) {
    const line = chapter.content[index];

    if (line.length) {
      curContent.push(line.replaceAll(">>", ">"));
    } else {
      if (curContent.length) {
        const content = curContent.join("\n");
        sendMemoPromiseArr.push(() => {
          return sendMemo({
            content: `${content}\n\n章节: ${chapterTitle}\n\n${tag}`,
          }).then((res) => {
            console.log("success", res.data.data.content);
            return res;
          });
        });

        sendMemoPromiseArr.push(() => {
          return sendTag(tag.replace("#", ""))
        })
      }

      curContent = [];
    }
  }
}

let sendedMemoIds = [];
mergePromise(sendMemoPromiseArr).then((res) => {
  sendedMemoIds = res.map((item) => item.data.data.id);

  fs.writeJSONSync("./sendedIds.json", sendedMemoIds);
});
