const http = require("http");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs-extra");
const Busboy = require("busboy");
const { importFlomo } = require("../core/importFlomo");
const { importWeixin } = require("../core/importWeixin");
const { deleteImported } = require("../core/deleteImported");
const {
  isSupportedUploadKind,
  isSupportedFileForKind,
  sanitizeRelativePath,
  resolveFlomoEntryHtml,
} = require("./uploadUtils");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3131);
const WEB_ROOT = path.resolve(__dirname, "../../web");
const UPLOAD_ROOT = path.join(os.tmpdir(), "memos-import-upload");
const UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const UPLOAD_TTL_MS = 30 * 60 * 1000;

let session = null;
let activeJobId = null;
const jobs = new Map();
const uploads = new Map();

fs.removeSync(UPLOAD_ROOT);
fs.ensureDirSync(UPLOAD_ROOT);

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendEvent(client, event) {
  client.write(`event: ${event.type}\n`);
  client.write(`data: ${JSON.stringify(event)}\n\n`);
}

function appendEvent(job, event) {
  job.events.push(event);
  for (const client of job.clients) {
    sendEvent(client, event);
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (_error) {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function createJob(type) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const job = {
    id,
    type,
    status: "running",
    createdAt: new Date().toISOString(),
    events: [],
    clients: new Set(),
    result: null,
    error: null,
    uploadId: null,
  };
  jobs.set(id, job);
  activeJobId = id;
  return job;
}

function cleanupUpload(uploadId) {
  if (!uploadId) return;
  const record = uploads.get(uploadId);
  if (!record) return;

  uploads.delete(uploadId);
  fs.remove(record.tempDir || record.tempPath).catch(() => {});
}

async function runJob(job, runner) {
  try {
    const result = await runner((event) => {
      appendEvent(job, {
        ...event,
        ts: Date.now(),
      });
    });
    job.status = "finished";
    job.result = result;
  } catch (error) {
    job.status = "failed";
    job.error = toPublicError(error);
    appendEvent(job, {
      type: "error",
      message: job.error.message,
      ts: Date.now(),
    });
  } finally {
    cleanupUpload(job.uploadId);
    activeJobId = null;
  }
}

function toPublicError(error) {
  if (!error) {
    return { message: "任务执行失败" };
  }

  if (["ENOENT", "EISDIR", "ENOTDIR", "EACCES", "EPERM"].includes(error.code)) {
    return { message: "文件读取失败，请检查导出文件或路径是否正确" };
  }

  const rawMessage = String(error.message || "任务执行失败");
  const message = rawMessage.replace(/\/[^\s]+/g, "<path>");
  return { message };
}

function requireSession(res) {
  if (!session?.openApi || !session?.accessToken) {
    sendJson(res, 400, { error: "请先调用 /api/session 保存会话" });
    return false;
  }
  return true;
}

function resolveInputPath(inputPath) {
  if (!inputPath) return null;
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
}

function parseMultipartUpload(req) {
  return new Promise((resolve, reject) => {
    const uploadToken = crypto.randomUUID();
    const tempDir = path.join(UPLOAD_ROOT, uploadToken);
    fs.ensureDirSync(tempDir);

    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 5000, fileSize: UPLOAD_LIMIT_BYTES, fields: 10 },
    });

    let kind = "";
    let fileCount = 0;
    let totalBytes = 0;
    let originalName = "";
    let hasFile = false;
    let hasError = false;
    let fileSizeExceeded = false;
    const savedRelativePaths = [];
    const pendingWrites = [];

    function fail(error) {
      if (hasError) return;
      hasError = true;
      fs.remove(tempDir).catch(() => {});
      reject(error);
    }

    busboy.on("field", (name, value) => {
      if (name === "kind") {
        kind = String(value || "").trim();
      }
    });

    busboy.on("file", (_name, file, info) => {
      hasFile = true;
      const incomingName = info?.filename || "upload.bin";
      const safeRelativePath = sanitizeRelativePath(incomingName) || path.basename(incomingName);
      const targetPath = path.join(tempDir, safeRelativePath);

      if (!targetPath.startsWith(tempDir)) {
        file.resume();
        fail(new Error("上传文件路径非法"));
        return;
      }

      fs.ensureDirSync(path.dirname(targetPath));
      const writeStream = fs.createWriteStream(targetPath);
      fileCount += 1;
      if (!originalName) {
        originalName = path.basename(safeRelativePath);
      }
      savedRelativePaths.push(safeRelativePath);

      file.on("data", (chunk) => {
        totalBytes += chunk.length;
      });

      file.on("limit", () => {
        fileSizeExceeded = true;
      });

      const writePromise = new Promise((resolveWrite, rejectWrite) => {
        file.on("error", rejectWrite);
        writeStream.on("error", rejectWrite);
        writeStream.on("finish", resolveWrite);
      });

      pendingWrites.push(writePromise);
      file.pipe(writeStream);
    });

    busboy.on("error", fail);

    busboy.on("finish", async () => {
      try {
        await Promise.all(pendingWrites);

        if (hasError) return;
        if (fileSizeExceeded) {
          fail(new Error("文件超过 20MB 限制"));
          return;
        }
        if (!hasFile || !fileCount) {
          fail(new Error("请上传文件"));
          return;
        }
        if (!isSupportedUploadKind(kind)) {
          fail(new Error("kind 仅支持 flomo 或 weixin"));
          return;
        }

        for (const relativePath of savedRelativePaths) {
          if (!isSupportedFileForKind(kind, relativePath)) {
            fail(new Error(`文件类型不支持: ${relativePath}`));
            return;
          }
        }

        if (kind === "weixin" && fileCount !== 1) {
          fail(new Error("微信读书仅支持上传一个 TXT 文件"));
          return;
        }

        let tempPath = path.join(tempDir, savedRelativePaths[0]);
        let htmlRelativePath = "";

        if (kind === "flomo") {
          htmlRelativePath = resolveFlomoEntryHtml(savedRelativePaths);
          if (!htmlRelativePath) {
            fail(new Error("未找到 Flomo HTML 入口文件（index.html）"));
            return;
          }
          tempPath = path.join(tempDir, htmlRelativePath);
        }

        resolve({
          kind,
          tempDir,
          tempPath,
          htmlRelativePath,
          originalName,
          fileCount,
          size: totalBytes,
        });
      } catch (error) {
        fail(error);
      }
    });

    req.pipe(busboy);
  });
}

function gcExpiredUploads() {
  const now = Date.now();
  for (const [uploadId, record] of uploads.entries()) {
    if (now - record.createdAt > UPLOAD_TTL_MS) {
      cleanupUpload(uploadId);
    }
  }
}

setInterval(gcExpiredUploads, 5 * 60 * 1000).unref();

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && reqUrl.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, activeJobId });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/session") {
      const body = await parseBody(req);
      if (!body.openApi || !body.accessToken) {
        sendJson(res, 400, { error: "openApi 和 accessToken 不能为空" });
        return;
      }
      session = {
        openApi: body.openApi,
        accessToken: body.accessToken,
      };
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname === "/api/uploads") {
      const parsed = await parseMultipartUpload(req);
      const uploadId = crypto.randomUUID();
      uploads.set(uploadId, {
        ...parsed,
        createdAt: Date.now(),
      });

      sendJson(res, 201, {
        uploadId,
        kind: parsed.kind,
        originalName: parsed.originalName,
        fileCount: parsed.fileCount || 1,
        size: parsed.size,
      });
      return;
    }

    if (req.method === "POST" && reqUrl.pathname.startsWith("/api/jobs/")) {
      if (activeJobId) {
        sendJson(res, 409, { error: "已有任务正在执行", activeJobId });
        return;
      }

      if (!requireSession(res)) return;

      const body = await parseBody(req);
      const type = reqUrl.pathname.split("/").pop();
      const job = createJob(type);

      if (type === "flomo") {
        let htmlPath = null;

        if (body.uploadId) {
          const upload = uploads.get(body.uploadId);
          if (!upload || upload.kind !== "flomo") {
            jobs.delete(job.id);
            activeJobId = null;
            sendJson(res, 400, { error: "uploadId 无效或已过期" });
            return;
          }
          job.uploadId = body.uploadId;
          htmlPath = upload.tempPath;
        } else {
          htmlPath = resolveInputPath(body.htmlPath);
          if (!htmlPath || !fs.existsSync(htmlPath)) {
            jobs.delete(job.id);
            activeJobId = null;
            sendJson(res, 400, { error: "htmlPath 不存在" });
            return;
          }
        }

        runJob(job, (onEvent) => importFlomo({ ...session, htmlPath, onEvent }));
      } else if (type === "weixin") {
        let txtPath = null;

        if (body.uploadId) {
          const upload = uploads.get(body.uploadId);
          if (!upload || upload.kind !== "weixin") {
            jobs.delete(job.id);
            activeJobId = null;
            sendJson(res, 400, { error: "uploadId 无效或已过期" });
            return;
          }
          job.uploadId = body.uploadId;
          txtPath = upload.tempPath;
        } else {
          txtPath = resolveInputPath(body.txtPath);
          if (!txtPath || !fs.existsSync(txtPath)) {
            jobs.delete(job.id);
            activeJobId = null;
            sendJson(res, 400, { error: "txtPath 不存在" });
            return;
          }
        }

        runJob(job, (onEvent) => importWeixin({ ...session, txtPath, onEvent }));
      } else if (type === "delete") {
        runJob(job, (onEvent) => deleteImported({ ...session, onEvent }));
      } else {
        jobs.delete(job.id);
        activeJobId = null;
        sendJson(res, 404, { error: "未知任务类型" });
        return;
      }

      sendJson(res, 202, { jobId: job.id, status: job.status });
      return;
    }

    if (req.method === "GET" && /^\/api\/jobs\/[^/]+\/events$/.test(reqUrl.pathname)) {
      const parts = reqUrl.pathname.split("/");
      const jobId = parts[3];
      const job = jobs.get(jobId);
      if (!job) {
        sendJson(res, 404, { error: "任务不存在" });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      for (const event of job.events) {
        sendEvent(res, event);
      }

      job.clients.add(res);
      req.on("close", () => {
        job.clients.delete(res);
      });
      return;
    }

    if (req.method === "GET" && /^\/api\/jobs\/[^/]+\/result$/.test(reqUrl.pathname)) {
      const parts = reqUrl.pathname.split("/");
      const jobId = parts[3];
      const job = jobs.get(jobId);
      if (!job) {
        sendJson(res, 404, { error: "任务不存在" });
        return;
      }

      sendJson(res, 200, {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        result: job.result,
        error: job.error,
      });
      return;
    }

    if (req.method === "GET") {
      const pathname = reqUrl.pathname === "/" ? "/index.html" : reqUrl.pathname;
      const filePath = path.resolve(WEB_ROOT, `.${pathname}`);

      if (!filePath.startsWith(WEB_ROOT)) {
        sendJson(res, 403, { error: "禁止访问" });
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { "Content-Type": getContentType(filePath) });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Web console is running at http://${HOST}:${PORT}`);
});
