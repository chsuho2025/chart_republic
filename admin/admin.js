const state = {
  password: sessionStorage.getItem("chartRepublicAdminPassword") || "",
  latest: null,
  snapshots: [],
  draftTracks: [],
  preview: [],
};

const weights = {
  spotifyDailyRank: 0.3,
  appleDailyRank: 0.25,
  youtubeMusicWeeklyRank: 0.15,
  youtubeShortsDailyRank: 0.2,
  reviewScore: 0.1,
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

function finalScore(track) {
  const score =
    rankScore(track.spotifyDailyRank) * weights.spotifyDailyRank +
    rankScore(track.appleDailyRank) * weights.appleDailyRank +
    rankScore(track.youtubeMusicWeeklyRank) * weights.youtubeMusicWeeklyRank +
    rankScore(track.youtubeShortsDailyRank) * weights.youtubeShortsDailyRank +
    (Number(track.reviewScore) || 0) * weights.reviewScore;
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
        <td><input class="score-input" data-review-id="${track.id}" type="number" min="0" max="100" step="0.1" value="${track.reviewScore}" /></td>
        <td>${track.finalScore.toFixed(2)}</td>
        <td>${displayRank(track.spotifyDailyRank)}</td>
        <td>${displayRank(track.appleDailyRank)}</td>
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
      "X-Admin-Password": state.password,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

async function loadData() {
  state.password = $("#password").value.trim();
  sessionStorage.setItem("chartRepublicAdminPassword", state.password);
  setStatus("데이터 불러오는 중...");
  const payload = await api("/api/admin");
  state.latest = payload.latest;
  state.snapshots = payload.snapshots || [];
  state.draftTracks = payload.latest.tracks.map((track) => ({ ...track }));
  showWorkspace(payload.mode);
  setStatus("관리자 데이터 로드 완료.", "ok");
}

async function publishLive() {
  if (!state.latest) return;
  const ok = window.confirm("현재 어드민 미리보기 순위를 라이브 차트에 반영할까요?");
  if (!ok) return;

  recalculatePreview();
  const chart = {
    ...state.latest,
    tracks: state.preview.map((track) => ({ ...track })),
  };

  setStatus("라이브 반영 중... GitHub에 차트 JSON을 커밋합니다.");
  const payload = await api("/api/admin", {
    method: "POST",
    body: JSON.stringify({ chart }),
  });
  if (payload.chart) {
    state.latest = payload.chart;
    state.draftTracks = payload.chart.tracks.map((track) => ({ ...track }));
    if (!state.snapshots.some((snapshot) => snapshot.chartDate === payload.chart.chartDate)) {
      state.snapshots.push(payload.chart);
    } else {
      state.snapshots = state.snapshots.map((snapshot) => (snapshot.chartDate === payload.chart.chartDate ? payload.chart : snapshot));
    }
    showWorkspace("github");
  }
  setStatus(`라이브 반영 완료. ${payload.chartDate} / ${payload.generatedAt}`, "ok");
}

function bindEvents() {
  $("#password").value = state.password;
  $("#loadData").addEventListener("click", () => loadData().catch((error) => setStatus(error.message, "danger")));
  $("#publishLive").addEventListener("click", () => publishLive().catch((error) => setStatus(error.message, "danger")));
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
