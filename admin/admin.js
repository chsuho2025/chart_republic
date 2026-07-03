const state = {
  latest: null,
  snapshots: [],
  draftTracks: [],
  preview: [],
};

const weights = {
  appleDailyRank: 0.1,
  appleSeoulRank: 0.2,
  spotifyDailyRank: 0.1,
  spotifyViralRank: 0.2,
  youtubeMusicWeeklyRank: 0.05,
  youtubeShortsDailyRank: 0.15,
  reviewScore: 0.2,
};

const $ = (selector) => document.querySelector(selector);

function setStatus(message, tone = "muted") {
  const status = $("#status");
  status.textContent = message;
  status.style.color = tone === "danger" ? "#ff9ca6" : tone === "ok" ? "#72efad" : "rgba(244,244,244,0.58)";
}

function rankScore(rank) {
  return Number.isInteger(rank) && rank > 0 ? Math.max(0, 101 - rank) : 0;
}

function normalizedReviewScore(score) {
  const value = Number(score) || 0;
  return value > 5 ? value : (value / 5) * 100;
}

function finalScore(track) {
  const score =
    rankScore(track.spotifyDailyRank) * weights.spotifyDailyRank +
    rankScore(track.spotifyViralRank) * weights.spotifyViralRank +
    rankScore(track.appleDailyRank) * weights.appleDailyRank +
    rankScore(track.appleSeoulRank) * weights.appleSeoulRank +
    rankScore(track.youtubeMusicWeeklyRank) * weights.youtubeMusicWeeklyRank +
    rankScore(track.youtubeShortsDailyRank) * weights.youtubeShortsDailyRank +
    normalizedReviewScore(track.reviewScore) * weights.reviewScore;
  return Math.round(score * 100) / 100;
}

function recalculatePreview() {
  state.preview = state.draftTracks
    .map((track) => ({
      ...track,
      reviewScore: Number(track.reviewScore) || 0,
      finalScore: finalScore(track),
    }))
    .sort((a, b) => b.finalScore - a.finalScore || a.title.localeCompare(b.title));
}

function displayRank(value) {
  return value || "-";
}

function artist(track) {
  return track.artistKo || track.artist;
}

function renderMetrics(mode = "") {
  $("#metrics").hidden = false;
  $("#metrics").innerHTML = `
    <div class="metric"><span>라이브 차트 날짜</span><strong>${state.latest.chartDate}</strong></div>
    <div class="metric"><span>공개 순위 범위</span><strong>TOP 25</strong></div>
    <div class="metric"><span>후보 데이터</span><strong>${state.preview.length}곡</strong></div>
    <div class="metric"><span>과거 스냅샷</span><strong>${state.snapshots.length}개</strong></div>
    ${mode ? `<div class="metric"><span>데이터 모드</span><strong>${mode}</strong></div>` : ""}
  `;
}

function renderPreview() {
  recalculatePreview();
  $("#previewList").innerHTML = state.preview
    .map((track, index) => `<li><strong>${index + 1}. ${track.title}</strong> <span>${artist(track)}</span></li>`)
    .join("");
}

function renderScoreRows() {
  $("#scoreRows").innerHTML = state.preview
    .map((track, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${track.title}</strong><span>${artist(track)}</span></td>
        <td><input class="score-input" data-review-id="${track.id}" type="number" min="0" max="5" step="0.5" value="${track.reviewScore}" /></td>
        <td>${track.finalScore.toFixed(2)}</td>
        <td>${displayRank(track.spotifyDailyRank)}</td>
        <td>${displayRank(track.spotifyViralRank)}</td>
        <td>${displayRank(track.appleDailyRank)}</td>
        <td>${displayRank(track.appleSeoulRank)}</td>
        <td>${displayRank(track.youtubeMusicWeeklyRank)}</td>
        <td>${displayRank(track.youtubeShortsDailyRank)}</td>
      </tr>
    `)
    .join("");
}

function renderSnapshots() {
  const select = $("#snapshotSelect");
  select.innerHTML = state.snapshots
    .slice()
    .sort((a, b) => b.chartDate.localeCompare(a.chartDate))
    .map((snapshot) => `<option value="${snapshot.chartDate}">${snapshot.chartDate}</option>`)
    .join("");
  renderSnapshotRows(select.value || state.latest.chartDate);
}

function renderSnapshotRows(chartDate) {
  const snapshot = state.snapshots.find((item) => item.chartDate === chartDate) || state.latest;
  $("#snapshotRows").innerHTML = snapshot.tracks
    .map((track, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${track.title}</strong><span>${artist(track)}</span></td>
        <td>${Number(track.finalScore).toFixed(2)}</td>
        <td>${track.reviewScore}</td>
        <td>${displayRank(track.previousRank)}</td>
        <td>${displayRank(track.peakRank)}</td>
        <td>${track.status}</td>
      </tr>
    `)
    .join("");
}

function renderRawData() {
  const raw = {
    latest: state.latest,
    snapshots: state.snapshots.map((snapshot) => ({
      chartDate: snapshot.chartDate,
      generatedAt: snapshot.generatedAt,
      trackCount: snapshot.tracks.length,
      tracks: snapshot.tracks,
    })),
  };
  $("#rawData").textContent = JSON.stringify(raw, null, 2);
}

function showWorkspace(mode) {
  $("#workspace").hidden = false;
  $("#historyPanel").hidden = false;
  $("#rawPanel").hidden = false;
  renderMetrics(mode);
  renderPreview();
  renderScoreRows();
  renderSnapshots();
  renderRawData();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

async function loadData() {
  setStatus("데이터 불러오는 중...");
  const payload = await api("/api/admin");
  state.latest = payload.latest;
  state.snapshots = payload.snapshots || [];
  state.draftTracks = payload.latest.tracks.map((track) => ({ ...track }));
  showWorkspace(payload.mode);
  setStatus("정적 JSON 데이터를 로드했습니다. 수정 후 JSON을 내보내고 재배포하세요.", "ok");
}

function exportJson() {
  if (!state.latest) return;
  recalculatePreview();
  const chart = {
    ...state.latest,
    generatedAt: new Date().toISOString(),
    tracks: state.preview.map((track) => ({ ...track })),
  };

  const blob = new Blob([`${JSON.stringify(chart, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chart-${chart.chartDate}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("수정된 차트 JSON을 내보냈습니다. data/latest.json, data/chart.json, snapshots에 반영 후 배포하세요.", "ok");
}

function bindEvents() {
  $("#loadData").addEventListener("click", () => loadData().catch((error) => setStatus(error.message, "danger")));
  $("#exportJson").addEventListener("click", exportJson);
  $("#snapshotSelect").addEventListener("change", (event) => renderSnapshotRows(event.target.value));
  $("#scoreRows").addEventListener("input", (event) => {
    const input = event.target.closest("[data-review-id]");
    if (!input) return;
    const track = state.draftTracks.find((item) => item.id === input.dataset.reviewId);
    if (!track) return;
    track.reviewScore = Number(input.value) || 0;
    renderPreview();
  });
  $("#scoreRows").addEventListener("change", () => {
    renderPreview();
    renderScoreRows();
    renderRawData();
  });
}

bindEvents();
