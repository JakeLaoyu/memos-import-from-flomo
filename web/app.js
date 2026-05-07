const statusEl = document.getElementById("status");
const logsEl = document.getElementById("logs");

function setStatus(text) {
  statusEl.textContent = text;
}

function appendLog(message) {
  logsEl.textContent += `${message}\n`;
  logsEl.scrollTop = logsEl.scrollHeight;
}

async function requestJson(url, options) {
  const response = await fetch(url, options || {});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `请求失败: ${response.status}`);
  }
  return payload;
}

async function requestJsonWithBody(url, body) {
  return requestJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

async function uploadFile(kind, file) {
  const formData = new FormData();
  formData.append("kind", kind);
  formData.append("file", file);

  const result = await requestJson("/api/uploads", {
    method: "POST",
    body: formData,
  });

  appendLog(`[上传] ${result.originalName} (${result.size} bytes)`);
  return result.uploadId;
}

async function uploadFolder(kind, files) {
  const formData = new FormData();
  formData.append("kind", kind);

  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    formData.append("file", file, relativePath);
  }

  const result = await requestJson("/api/uploads", {
    method: "POST",
    body: formData,
  });

  appendLog(`[上传] 已上传目录，共 ${result.fileCount} 个文件`);
  return result.uploadId;
}

async function saveSession() {
  const openApi = document.getElementById("openApi").value.trim();
  const accessToken = document.getElementById("accessToken").value.trim();

  await requestJsonWithBody("/api/session", { openApi, accessToken });

  setStatus("会话已保存");
  appendLog("[会话] 已保存");
}

function attachSse(jobId) {
  const events = new EventSource(`/api/jobs/${jobId}/events`);

  const relay = (type) => {
    events.addEventListener(type, (event) => {
      const data = JSON.parse(event.data);
      appendLog(`[${data.type}] ${data.message || ""}`);
      if (data.type === "finished") {
        setStatus("已完成");
      }
      if (data.type === "error") {
        setStatus("失败");
      }
    });
  };

  ["started", "progress", "log", "success", "error", "finished"].forEach(relay);

  return events;
}

async function runJob(type, body) {
  logsEl.textContent = "";
  const jobLabelMap = {
    flomo: "Flomo 导入",
    weixin: "微信读书导入",
    delete: "删除任务",
  };
  setStatus(`运行中: ${jobLabelMap[type] || type}`);

  const result = await requestJsonWithBody(`/api/jobs/${type}`, body || {});

  appendLog(`[任务] 已启动: ${result.jobId}`);
  const sse = attachSse(result.jobId);

  const poll = setInterval(async () => {
    try {
      const job = await requestJson(`/api/jobs/${result.jobId}/result`, { method: "GET" });
      if (job.status !== "running") {
        clearInterval(poll);
        sse.close();
        appendLog(`[任务] 状态=${job.status}`);
        appendLog(`[任务] 结果=${JSON.stringify(job.result || job.error || {})}`);
      }
    } catch (error) {
      clearInterval(poll);
      sse.close();
      appendLog(`[错误] ${error.message}`);
      setStatus("失败");
    }
  }, 1000);
}

document.getElementById("saveSession").addEventListener("click", async () => {
  try {
    await saveSession();
  } catch (error) {
    appendLog(`[错误] ${error.message}`);
    setStatus("失败");
  }
});

document.getElementById("runFlomo").addEventListener("click", async () => {
  const htmlPath = document.getElementById("htmlPath").value.trim();
  const flomoFolderFiles = Array.from(document.getElementById("flomoFolder").files || []);

  try {
    if (flomoFolderFiles.length) {
      const uploadId = await uploadFolder("flomo", flomoFolderFiles);
      await runJob("flomo", { uploadId });
      return;
    }

    if (!htmlPath) {
      throw new Error("请先选择 Flomo 导出文件夹，或填写 Flomo 文件路径");
    }

    await runJob("flomo", { htmlPath });
  } catch (error) {
    appendLog(`[错误] ${error.message}`);
    setStatus("失败");
  }
});

document.getElementById("runWeixin").addEventListener("click", async () => {
  const txtPath = document.getElementById("txtPath").value.trim();
  const weixinFile = document.getElementById("weixinFile").files[0];

  try {
    if (weixinFile) {
      const uploadId = await uploadFile("weixin", weixinFile);
      await runJob("weixin", { uploadId });
      return;
    }

    if (!txtPath) {
      throw new Error("请先选择微信读书 TXT 文件，或填写文件路径");
    }

    await runJob("weixin", { txtPath });
  } catch (error) {
    appendLog(`[错误] ${error.message}`);
    setStatus("失败");
  }
});

document.getElementById("runDelete").addEventListener("click", async () => {
  try {
    await runJob("delete", {});
  } catch (error) {
    appendLog(`[错误] ${error.message}`);
    setStatus("失败");
  }
});
