const cheerio = require("cheerio");
const TurndownService = require("turndown");

function parseFlomoHtml(html) {
  const $ = cheerio.load(html);
  const memoArr = [];

  const memos = $(".memo");

  for (const memo of memos) {
    const time = $(memo).find(".time").text();
    let content = "";
    let tags = [];
    const files = [];

    $(memo)
      .find(".content")
      .each((_, contentHtml) => {
        const turndownService = new TurndownService();
        const text = turndownService.turndown($(contentHtml).html());
        content += `${content ? "\n" : ""}${text}`;
      });

    const tagReg = /#(\S*)/g;
    const tagMatch = content.match(tagReg);
    if (tagMatch) {
      tags = tagMatch.map((item) => item.replace("#", "")).filter(Boolean);
    }

    $(memo)
      .find(".files img")
      .each((_, img) => {
        files.push($(img).attr("src"));
      });

    memoArr.push({
      time,
      content,
      files,
      tags,
    });
  }

  memoArr.sort((a, b) => new Date(b.time) - new Date(a.time));
  return memoArr;
}

module.exports = {
  parseFlomoHtml,
};
