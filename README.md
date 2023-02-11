# Memos 导入 flomo 数据

## 导出 flomo 数据

在 flomo 的设置页面，点击导出 HTML 数据

![](assets/SCR-20230211-tbm.png)

## 导入到 Memos

1. 下载本项目

```bash
git clone https://github.com/JakeLaoyu/memos-import-from-flomo.git
cd memos-import-from-flomo
pnpm install
```

2. 将 flomo 导出的 HTML 文件放到本项目的目录下。如: 

![](assets/SCR-20230211-tdr.png)

3. 运行脚本

为了保证数据的顺序，上传间隔 1s。如果你的 flomo 数据量很大，可以修改 `src/utils/api.js` 中的 `SLEEP` 的值。

```bash
node ./src/main.js [openApi] ./flomo/index.html
```

同步完可以打开网站查看是否符合预期。如不符合预期请看下面删除数据的方法。

## 删除同步数据

执行完同步数据后如果不符合预期，可以执行下面的命令删除同步的数据。删除会读取同步完成写入到 `sendedIds.json` 文件数据，所以需要保证这个文件存在。

```bash
node ./src/delete.js [openApi]
```