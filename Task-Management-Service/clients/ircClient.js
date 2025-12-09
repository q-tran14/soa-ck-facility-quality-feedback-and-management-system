// Task-Management-Service/clients/ircClient.js

const IRC_BASE_URL =
  process.env.IRC_SERVICE_BASE_URL || "https://irc-service.onrender.com";

/**
 * Gọi IRC-Service để cập nhật status Report
 * @param {string} reportId  VD: "RP-U01-01"
 * @param {string} status    VD: "COMPLETED", "IN_PROGRESS", ...
 * @param {string} note      Ghi chú (optional)
 * @param {string} role      Giá trị header X-Role, mặc định MANAGER
 */
async function updateReportStatus(reportId, status, note, role = "MANAGER") {
  if (!reportId || !status) return;

  // /api/report/reports/{report_id}/status?status=...&note=...
  const url = new URL(
    `${IRC_BASE_URL}/api/report/reports/${encodeURIComponent(
      reportId
    )}/status`
  );
  url.searchParams.set("status", status);
  if (note) url.searchParams.set("note", note);

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "X-Role": role, // theo swagger của IRC-Service
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        "[IRC] updateReportStatus FAILED",
        res.status,
        text || res.statusText
      );
      return null;
    }

    const data = await res.json().catch(() => null);
    console.log(
      "[IRC] updateReportStatus OK:",
      reportId,
      status,
      "=>",
      data?.status
    );
    return data;
  } catch (err) {
    console.error("[IRC] updateReportStatus error:", err);
    return null;
  }
}

module.exports = { updateReportStatus };
