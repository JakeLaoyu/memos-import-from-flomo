function parseWeixinText(fileContent) {
  const contentParse = {
    bookInfo: [],
    chapterInfo: [],
  };

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

    if (!line.length && !fileContentArr[index - 1]?.length) {
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

  const bookName = (contentParse.bookInfo[0] || "").replaceAll("《", "").replaceAll("》", "");
  const tag = `#微信读书/${bookName}`;

  const notes = [];

  for (const chapter of contentParse.chapterInfo) {
    if (chapter.title.includes("◆  点评")) continue;

    const chapterTitle = chapter.title.replace("◆ ", "").trim();

    let currentLines = [];

    for (const line of chapter.content) {
      if (line.length) {
        currentLines.push(line.replaceAll(">>", ">"));
      } else {
        if (currentLines.length) {
          notes.push({
            chapterTitle,
            content: currentLines.join("\n"),
          });
        }
        currentLines = [];
      }
    }
  }

  return {
    bookName,
    tag,
    notes,
  };
}

module.exports = {
  parseWeixinText,
};
