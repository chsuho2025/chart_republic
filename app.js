const state = {
  lang: localStorage.getItem("chartRepublicLang") || "ko",
  data: null,
  tracks: [],
  filter: "all",
  query: "",
  limit: 20,
};

const translations = {
  ko: {
    title: "Chart Republic 오늘의 HOT 50",
    subtitle: "한국 10·20대 스트리밍과 숏폼 바이럴 반응을 반영한 글로벌 K-pop 트렌드 차트",
    language: "English",
    chartIntro: "한국 10·20대에게 가장 인기 있는 음악. 매일 업데이트됩니다.",
    scoreModel: "점수 모델",
    filterAll: "전체",
    filterGen3: "3세대",
    filterGen4: "4세대",
    search: "곡 또는 아티스트 검색",
    asOf: "업데이트",
    entries: "곡",
    rank: "순위",
    track: "곡",
    signals: "플랫폼",
    score: "점수",
    finalScore: "최종 점수",
    previous: "전일 순위",
    peak: "최고 순위",
    days: "차트인",
    details: "상세",
    share: "X에 공유",
    copy: "링크 복사",
    copied: "복사됨",
    empty: "검색 결과가 없습니다.",
    loadMore: "더 보기",
    out: "-",
  },
  en: {
    title: "Chart Republic Today's Hot 50",
    subtitle: "A global K-pop trend chart tracking Korea's youth streaming and short-form viral signals.",
    language: "Korean",
    chartIntro: "The most popular music among Korean teens and twenties. Updated daily.",
    scoreModel: "Score model",
    filterAll: "All",
    filterGen3: "3rd gen",
    filterGen4: "4th gen",
    search: "Search track or artist",
    asOf: "Updated",
    entries: "Songs",
    rank: "Rank",
    track: "Track",
    signals: "Signals",
    score: "Score",
    finalScore: "Final score",
    previous: "Previous rank",
    peak: "Peak rank",
    days: "Days",
    details: "Details",
    share: "Share on X",
    copy: "Copy link",
    copied: "Copied",
    empty: "No matching tracks.",
    loadMore: "Show more",
    out: "-",
  },
};

const videoUrlMap = {
  "magnetic-illit": "https://www.youtube.com/embed/Vk5-c_v4gMU",
  "supernova-aespa": "https://www.youtube.com/embed/phuiiNCxRMg",
  "perfect-night-lesserafim": "https://www.youtube.com/embed/hLvWy2b857I",
  "seven-jungkook": "https://www.youtube.com/embed/QU9c0053UAU",
  "plot-twist-tws": "https://www.youtube.com/embed/hVAc1Vf2ITU",
};

const coverPalettes = [
  ["#111315", "#e83f6f"],
  ["#2f6fed", "#00a884"],
  ["#6b4eff", "#f0a202"],
  ["#1e293b", "#38bdf8"],
  ["#be123c", "#f97316"],
  ["#0f766e", "#84cc16"],
  ["#7c2d12", "#facc15"],
  ["#312e81", "#fb7185"],
];

const generationMap = {
  "gapjagi-ioi": "gen3",
  "seven-jungkook": "gen3",
  "somun-akmu": "gen3",
  "sarang-hanroro": "gen35",
  "zero-zero-hanroro": "gen35",
  "catch-catch-yena": "gen35",
  "fake-love-juns": "gen35",
  "i-like-you-choi": "gen35",
  "lemonade-aespa": "gen4",
  "boompala-lesserafim": "gen4",
  "redred-cortis": "gen45",
  "its-me-illit": "gen45",
  "love-attack-rescene": "gen45",
  "rude-hearts2hearts": "gen45",
  "lemon-tang-hearts2hearts": "gen45",
  "youngcreatorcrew-cortis": "gen45",
  "magnetic-illit": "gen45",
  "supernova-aespa": "gen4",
  "perfect-night-lesserafim": "gen4",
  "plot-twist-tws": "gen45",
};

function t(key) {
  return translations[state.lang][key] || translations.ko[key] || key;
}

function movement(track, rank) {
  if (track.status === "new" || !track.previousRank) return { icon: "", label: "NEW", cls: "new" };
  const diff = track.previousRank - rank;
  if (diff > 0) return { icon: "↑", label: String(diff), cls: "up" };
  if (diff < 0) return { icon: "↓", label: String(Math.abs(diff)), cls: "down" };
  return { icon: "", label: "-", cls: "steady" };
}

function initials(track) {
  return track.title
    .replace(/\([^)]*\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function coverStyle(seed) {
  let total = 0;
  for (const char of seed) total += char.charCodeAt(0);
  const [a, b] = coverPalettes[total % coverPalettes.length];
  return `radial-gradient(circle at 30% 20%, ${b}, transparent 38%), linear-gradient(135deg, ${a}, ${b})`;
}

function coverMarkup(track, className = "cover") {
  if (track.artworkUrl) {
    return `<img class="${className}" src="${track.artworkUrl}" alt="" loading="lazy" />`;
  }
  return `<span class="${className}" style="--cover:${coverStyle(track.coverSeed)}">${initials(track)}</span>`;
}

function formatDate(date) {
  const value = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat(state.lang === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function rankLabel(rank) {
  return rank ? `#${rank}` : t("out");
}

function applyTranslations() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
}

function renderHeroRank() {
  const hero = document.getElementById("heroRank");
  if (!hero) return;
  hero.innerHTML = `
    <div class="hero-image" aria-hidden="true"></div>
    <div class="hero-shade"></div>
    <div class="hero-copy">
      <h1>${state.lang === "ko" ? "오늘의 HOT 50" : "Today's Hot 50"}</h1>
      <button class="subtitle" type="button" data-chart-info>${state.lang === "ko" ? "Chart Republic 제공" : "Presented by Chart Republic"}</button>
    </div>
  `;
}

function trackGeneration(track) {
  const generation = generationMap[track.id] || "gen45";
  if (generation === "gen35") return "gen3";
  if (generation === "gen45") return "gen4";
  return generation;
}

function filteredTracks() {
  const query = state.query.trim().toLowerCase();
  return state.tracks
    .map((track, index) => ({ ...track, rank: index + 1 }))
    .slice(0, state.limit)
    .filter((track) => {
      if (state.filter !== "all" && trackGeneration(track) !== state.filter) return false;
      if (!query) return true;
      return `${track.title} ${track.artist} ${track.artistKo}`.toLowerCase().includes(query);
    });
}

function renderChart() {
  const list = document.getElementById("chartList");
  const tracks = filteredTracks();
  const loadMore = document.getElementById("loadMore");

  if (!tracks.length) {
    list.innerHTML = `<div class="empty-state">${t("empty")}</div>`;
    loadMore.hidden = true;
    return;
  }

  list.innerHTML = tracks
    .map((track) => {
      const move = movement(track, track.rank);
      const artist = state.lang === "ko" ? track.artistKo || track.artist : track.artist;
      return `
        <button class="chart-row" type="button" data-track-id="${track.id}" aria-label="${track.rank}. ${track.title}">
          <span class="rank-cell">
            <span class="rank-number">${track.rank}</span>
            <span class="movement ${move.cls}">${move.icon ? `<i>${move.icon}</i>` : ""}<b>${move.label}</b></span>
          </span>
          <span class="track-cell">
            ${coverMarkup(track)}
            <span>
              <p class="track-title">${track.title}</p>
              <span class="track-artist">${artist}</span>
            </span>
          </span>
          <span class="row-actions" aria-hidden="true">
            <span class="more-dot">•••</span>
          </span>
        </button>
      `;
    })
    .join("");
  loadMore.hidden = state.limit >= 50 || state.tracks.length <= state.limit || state.filter !== "all" || Boolean(state.query);
}

function detailMetric(label, value) {
  return `
    <div class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function rankHistory(track, rank) {
  const history = Array.isArray(track.rankHistory) ? track.rankHistory : [];
  const normalized = history
    .filter((entry) => entry && entry.chartDate && Number.isInteger(entry.rank))
    .map((entry) => ({ chartDate: entry.chartDate, rank: entry.rank }))
    .sort((a, b) => a.chartDate.localeCompare(b.chartDate));

  if (!normalized.some((entry) => entry.chartDate === state.data.chartDate)) {
    normalized.push({ chartDate: state.data.chartDate, rank });
  }

  return normalized.slice(-7);
}

function rankHistoryLabel(entry, index, total) {
  if (entry.chartDate === state.data.chartDate || index === total - 1) {
    return state.lang === "ko" ? "오늘" : "Today";
  }
  const [, month, day] = entry.chartDate.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function renderRankGraph(track, rank) {
  const history = rankHistory(track, rank);
  if (history.length < 2) {
    const current = history[0] || { chartDate: state.data.chartDate, rank };
    return `
      <section class="rank-graph">
        <h3>${state.lang === "ko" ? "최근 7일 순위 변화" : "7-day rank trend"}</h3>
        <div class="graph-empty">
          <span>${rankHistoryLabel(current, 0, 1)}</span>
          <strong>#${current.rank}</strong>
          <p>${state.lang === "ko" ? "7일 순위 데이터는 오늘부터 누적됩니다." : "7-day rank history starts from today's chart."}</p>
        </div>
      </section>
    `;
  }
  const width = 300;
  const height = 126;
  const padX = 18;
  const padY = 16;
  const maxRank = Math.max(20, ...history.map((entry) => entry.rank));
  const points = history.map((entry, index) => {
    const x = padX + (index / (history.length - 1)) * (width - padX * 2);
    const y = padY + ((entry.rank - 1) / (maxRank - 1)) * (height - 48);
    return { x, y, value: entry.rank, label: rankHistoryLabel(entry, index, history.length) };
  });
  const path = points.reduce((d, point, index, list) => {
    if (index === 0) return `M${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    const previous = list[index - 1];
    const handle = (point.x - previous.x) * 0.38;
    const cp1 = { x: previous.x + handle, y: previous.y };
    const cp2 = { x: point.x - handle, y: point.y };
    return `${d} C${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
  return `
    <section class="rank-graph">
      <h3>${state.lang === "ko" ? "최근 7일 순위 변화" : "7-day rank trend"}</h3>
      <div class="graph-frame">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="7-day rank trend">
          <path class="graph-grid" d="M${padX} ${padY}H${width - padX}M${padX} 56H${width - padX}M${padX} ${height - 32}H${width - padX}"></path>
          <path class="graph-line" d="${path}"></path>
          ${points
            .map((point, index) => {
              return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${index === points.length - 1 ? "4.2" : "3.4"}"></circle>`;
            })
            .join("")}
        </svg>
        ${points
          .map((point) => {
            const left = (point.x / width) * 100;
            const top = (point.y / height) * 100;
            return `
              <button class="graph-hit" type="button" style="--x:${left.toFixed(2)}%;--y:${top.toFixed(2)}%">
                <span class="graph-tooltip">${point.label}<strong>#${point.value}</strong></span>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="graph-labels">
        ${points.map((point) => `<span>${point.label}</span>`).join("")}
      </div>
    </section>
  `;
}

function videoQuery(track, artist) {
  return encodeURIComponent(`${track.title} ${artist} official music video`);
}

function videoEmbedUrl(track, artist) {
  return track.videoUrl || videoUrlMap[track.id] || `https://www.youtube.com/embed?listType=search&list=${videoQuery(track, artist)}`;
}

function openDetail(trackId) {
  const index = state.tracks.findIndex((track) => track.id === trackId);
  const track = state.tracks[index];
  if (!track) return;
  const rank = index + 1;
  const artist = state.lang === "ko" ? track.artistKo || track.artist : track.artist;
  const move = movement(track, rank);

  document.getElementById("detailContent").innerHTML = `
    <div class="detail-hero">
      ${coverMarkup(track)}
      <div>
        <h2>${track.title}</h2>
        <div class="track-artist">${artist}</div>
      </div>
    </div>
    <div class="detail-score">
      ${detailMetric(t("rank"), `#${rank}`)}
      ${detailMetric(t("finalScore"), track.finalScore.toFixed(2))}
      ${detailMetric(state.lang === "ko" ? "전일 대비" : "Daily change", `${move.icon}${move.label}`)}
      ${detailMetric(t("peak"), `#${track.peakRank}`)}
    </div>
    ${renderRankGraph(track, rank)}
    <section class="video-panel">
      <h3>${state.lang === "ko" ? "뮤직비디오" : "Music video"}</h3>
      <iframe title="${track.title} music video" src="${videoEmbedUrl(track, artist)}" allowfullscreen></iframe>
    </section>
  `;

  document.getElementById("detailPanel").classList.add("open");
  document.getElementById("scrim").classList.add("open");
  document.getElementById("detailPanel").setAttribute("aria-hidden", "false");
  history.replaceState(null, "", `#${track.id}`);
}

function closeDetail() {
  document.getElementById("detailPanel").classList.remove("open");
  document.getElementById("scrim").classList.remove("open");
  document.getElementById("detailPanel").setAttribute("aria-hidden", "true");
  if (location.hash) history.replaceState(null, "", location.pathname);
}

function openChartInfo() {
  document.getElementById("chartInfoPopup").classList.add("open");
  document.getElementById("chartInfoPopup").setAttribute("aria-hidden", "false");
  document.getElementById("scrim").classList.add("open");
}

function closeChartInfo() {
  document.getElementById("chartInfoPopup").classList.remove("open");
  document.getElementById("chartInfoPopup").setAttribute("aria-hidden", "true");
  if (!document.getElementById("detailPanel").classList.contains("open")) {
    document.getElementById("scrim").classList.remove("open");
  }
}

function bindEvents() {
  document.getElementById("settingsToggle").addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = document.getElementById("settingsMenu");
    const open = menu.classList.toggle("open");
    menu.setAttribute("aria-hidden", open ? "false" : "true");
  });

  document.getElementById("languageToggle").addEventListener("click", () => {
    state.lang = state.lang === "ko" ? "en" : "ko";
    localStorage.setItem("chartRepublicLang", state.lang);
    applyTranslations();
    renderHeroRank();
    renderChart();
    document.getElementById("settingsMenu").classList.remove("open");
    document.getElementById("settingsMenu").setAttribute("aria-hidden", "true");
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      state.filter = tab.dataset.filter;
      state.limit = 20;
      renderChart();
    });
  });

  document.getElementById("searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderChart();
  });

  document.getElementById("chartList").addEventListener("click", (event) => {
    const row = event.target.closest("[data-track-id]");
    if (!row) return;
    openDetail(row.dataset.trackId);
  });

  document.getElementById("loadMore").addEventListener("click", () => {
    state.limit = 50;
    renderChart();
  });

  document.getElementById("heroRank").addEventListener("click", (event) => {
    if (event.target.closest("[data-chart-info]")) {
      openChartInfo();
      return;
    }
    const row = event.target.closest("[data-track-id]");
    if (row) openDetail(row.dataset.trackId);
  });

  document.getElementById("chartInfoClose").addEventListener("click", closeChartInfo);
  document.getElementById("closeDetail").addEventListener("click", closeDetail);
  document.getElementById("scrim").addEventListener("click", () => {
    closeChartInfo();
    closeDetail();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeChartInfo();
      closeDetail();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".top-actions") && !event.target.closest("#settingsMenu")) {
      document.getElementById("settingsMenu").classList.remove("open");
      document.getElementById("settingsMenu").setAttribute("aria-hidden", "true");
    }
  });
}

async function init() {
  bindEvents();
  applyTranslations();
  const cacheKey = Date.now();
  const response = await fetch(`./data/latest.json?v=${cacheKey}`, { cache: "no-store" }).then((result) => {
    if (!result.ok) return fetch(`./data/chart.json?v=${cacheKey}`, { cache: "no-store" });
    return result;
  });
  state.data = await response.json();
  state.tracks = state.data.tracks
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 50);
  renderHeroRank();
  renderChart();

  if (location.hash) {
    const id = decodeURIComponent(location.hash.slice(1));
    setTimeout(() => openDetail(id), 100);
  }
}

init().catch((error) => {
  document.getElementById("chartList").innerHTML = `<div class="empty-state">${error.message}</div>`;
});
