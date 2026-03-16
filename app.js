const REFRESH_INTERVAL_MS = 30_000;
const PROXY_BASE = "https://api.allorigins.win/raw?url=";
const PREDICTION_WINDOW_MS = 6 * 60 * 60 * 1000;

const RSS_SOURCES = [
  { name: "Google News IL", url: "https://news.google.com/rss/search?q=%D7%99%D7%A9%D7%A8%D7%90%D7%9C+%D7%90%D7%99%D7%A8%D7%90%D7%9F&hl=he&gl=IL&ceid=IL:he" },
  { name: "Ynet", url: "https://www.ynet.co.il/Integration/StoryRss3254.xml" },
  { name: "Reuters World", url: "https://news.google.com/rss/search?q=site:reuters.com+iran+israel&hl=en-US&gl=US&ceid=US:en" },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Guardian World", url: "https://www.theguardian.com/world/rss" },
  { name: "France24 Arabic", url: "https://www.france24.com/ar/rss" }
];

const OREF_ENDPOINT = "https://www.oref.org.il/warningMessages/alert/alerts.json";

const PREDICTIVE_TERMS = ["צפוי", "הערכה", "forecast", "likely", "עשוי", "עלול", "ceasefire soon", "סיום המלחמה", "הפסקת אש", "עסקה קרובה"];

const GEO_EVENT_RULES = {
  attack: ["תקיפה", "attack", "strike", "פיצוץ", "יירוט", "טיל"],
  base: ["בסיס", "base", "airbase", "מוצב", "מתקן צבאי"],
  nuclear: ["גרעין", "nuclear", "uranium", "כור", "צנטריפוג"],
  proxy: ["חיזבאללה", "חות'", "מיליצ", "proxy", "משמרות המהפכה"],
  diplomacy: ["הפסקת אש", "ceasefire", "deal", "agreement", "מו\"מ", "שיחות", "סיום המלחמה"]
};

const PLACE_COORDS = {
  "ישראל": [31.0461, 34.8516], "ירושלים": [31.7683, 35.2137], "תל אביב": [32.0853, 34.7818], "איראן": [32.4279, 53.688],
  "טהרן": [35.6892, 51.389], "לבנון": [33.8547, 35.8623], "סוריה": [34.8021, 38.9968], "עזה": [31.5017, 34.4668],
  "מצרים": [26.8206, 30.8025], "ארה\"ב": [37.0902, -95.7129], "וושינגטון": [38.9072, -77.0369], "רוסיה": [61.524, 105.3188],
  "סעודיה": [23.8859, 45.0792], "קטאר": [25.3548, 51.1839], "אירופה": [54.526, 15.2551], "האומות המאוחדות": [40.7497, -73.968],
  "לונדון": [51.5072, -0.1276], "פריז": [48.8566, 2.3522], "בגדד": [33.3152, 44.3661], "דמשק": [33.5138, 36.2765]
};

const ALERT_CITY_COORDS = {
  "תל אביב": [32.0853, 34.7818], "ירושלים": [31.7683, 35.2137], "אשקלון": [31.6688, 34.5743], "אשדוד": [31.8044, 34.6553],
  "שדרות": [31.5253, 34.5969], "באר שבע": [31.252, 34.7915], "חיפה": [32.794, 34.9896], "קריית שמונה": [33.2073, 35.5723],
  "נהריה": [33.006, 35.0981], "אילת": [29.5577, 34.9519], "נתיבות": [31.4231, 34.5891], "ראשון לציון": [31.971, 34.7894],
  "מודיעין": [31.8988, 35.0104], "רמת גן": [32.0684, 34.8248]
};

const reliabilityState = loadReliabilityState();

const israelMap = L.map("israelMap", { zoomControl: true }).setView([31.4, 34.9], 7);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(israelMap);
const orefLayer = L.layerGroup().addTo(israelMap);

const opsMap = L.map("opsMap", { zoomControl: true }).setView([30, 35], 3);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(opsMap);
const opsLayers = {
  attack: L.layerGroup().addTo(opsMap),
  base: L.layerGroup().addTo(opsMap),
  nuclear: L.layerGroup().addTo(opsMap),
  proxy: L.layerGroup().addTo(opsMap),
  diplomacy: L.layerGroup().addTo(opsMap)
};

let globe = null;
let globeReady = false;

function initGlobe() {
  const fallback = document.getElementById("globeFallback");
  const root = document.getElementById("globeViz");
  if (!window.Globe || !root) {
    fallback.classList.remove("hidden");
    return;
  }
  try {
    globe = Globe()(root)
      .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-dark.jpg")
      .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
      .backgroundColor("rgba(0,0,0,0)")
      .pointAltitude("size")
      .pointColor("color")
      .pointRadius("radius")
      .pointLabel("label");

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.width(root.clientWidth);
    globe.height(root.clientHeight);
    window.addEventListener("resize", () => {
      globe.width(root.clientWidth);
      globe.height(root.clientHeight);
    });

    globeReady = true;
  } catch (error) {
    console.warn("3D globe init failed", error);
    fallback.classList.remove("hidden");
    globeReady = false;
  }
}

const newsListEl = document.getElementById("newsList");
const alertsListEl = document.getElementById("alertsList");
const lastUpdateEl = document.getElementById("lastUpdate");
const newsTickerEl = document.getElementById("newsTicker");
const newsCountEl = document.getElementById("newsCount");
const alertsCountEl = document.getElementById("alertsCount");
const sourceCountEl = document.getElementById("sourceCount");
const systemStatusEl = document.getElementById("systemStatus");
const sourceScoreBodyEl = document.getElementById("sourceScoreBody");
const opsFiltersEl = document.getElementById("opsFilters");

function loadReliabilityState() {
  try {
    const raw = localStorage.getItem("wm_il_reliability_v3_geo");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.sources && parsed.pending ? parsed : { sources: {}, pending: [] };
  } catch {
    return { sources: {}, pending: [] };
  }
}
function saveReliabilityState() { localStorage.setItem("wm_il_reliability_v3_geo", JSON.stringify(reliabilityState)); }

async function fetchText(url, options = {}) {
  const response = await fetch(`${PROXY_BASE}${encodeURIComponent(url)}`, options);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function parseRssItems(xmlText, sourceName) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  return [...doc.querySelectorAll("item")].map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() || "ללא כותרת",
    link: item.querySelector("link")?.textContent?.trim() || "#",
    pubDate: item.querySelector("pubDate")?.textContent?.trim() || "",
    source: sourceName
  }));
}

function detectPlaceFromHeadline(headline) {
  return Object.keys(PLACE_COORDS).find((key) => headline.includes(key)) || null;
}

function classifyHeadline(title) {
  const text = title.toLowerCase();
  const tags = Object.entries(GEO_EVENT_RULES)
    .filter(([, words]) => words.some((w) => text.includes(w.toLowerCase())))
    .map(([tag]) => tag);
  return tags.length ? tags : ["diplomacy"];
}

function findAlertCoordinates(cityName) {
  if (ALERT_CITY_COORDS[cityName]) return ALERT_CITY_COORDS[cityName];
  const fuzzy = Object.keys(ALERT_CITY_COORDS).find((known) => cityName.includes(known));
  return fuzzy ? ALERT_CITY_COORDS[fuzzy] : null;
}

function isPredictiveHeadline(title) {
  const normalized = title.toLowerCase();
  return PREDICTIVE_TERMS.some((term) => normalized.includes(term.toLowerCase()));
}

function stablePredictionId(item) {
  return `${item.source}::${item.link || item.title}`;
}

function registerPendingPredictions(items, nowTs) {
  items.forEach((item) => {
    if (!isPredictiveHeadline(item.title)) return;

    const tags = classifyHeadline(item.title);
    const id = stablePredictionId(item);
    if (reliabilityState.pending.some((p) => p.id === id)) return;

    reliabilityState.pending.push({
      id,
      source: item.source,
      expectedTags: tags,
      openedAt: nowTs,
      expiresAt: nowTs + PREDICTION_WINDOW_MS
    });

    if (!reliabilityState.sources[item.source]) {
      reliabilityState.sources[item.source] = { predictions: 0, success: 0, fail: 0 };
    }
    reliabilityState.sources[item.source].predictions += 1;
  });
}

function resolvePredictions(observedTags, nowTs) {
  const pendingNext = [];
  reliabilityState.pending.forEach((prediction) => {
    const stat = reliabilityState.sources[prediction.source] || { predictions: 0, success: 0, fail: 0 };
    reliabilityState.sources[prediction.source] = stat;

    const matched = prediction.expectedTags.some((tag) => observedTags.has(tag));
    if (matched) {
      stat.success += 1;
      return;
    }

    if (nowTs >= prediction.expiresAt) {
      stat.fail += 1;
      return;
    }
    pendingNext.push(prediction);
  });
  reliabilityState.pending = pendingNext;
}

function renderSourceScores() {
  const rows = Object.entries(reliabilityState.sources)
    .map(([source, stat]) => {
      const resolved = stat.success + stat.fail;
      const accuracy = resolved ? (stat.success / resolved) * 100 : 0;
      const confidence = Math.min(1, resolved / 15);
      const reliability = Math.round((accuracy * 0.8 + Math.min(resolved, 25)) * (0.5 + confidence * 0.5));
      return { source, ...stat, accuracy, reliability };
    })
    .sort((a, b) => b.reliability - a.reliability)
    .slice(0, 15);

  sourceScoreBodyEl.innerHTML = rows.length
    ? rows.map((row) => `<tr><td>${row.source}</td><td>${row.predictions}</td><td>${row.success}</td><td>${row.fail}</td><td>${row.accuracy.toFixed(0)}%</td><td><strong>${row.reliability}</strong></td></tr>`).join("")
    : '<tr><td colspan="6" class="placeholder">אין מספיק נתונים עדיין.</td></tr>';
}

function renderTicker(items) {
  const headlines = items.slice(0, 10).map((item) => item.title).join("  •  ");
  newsTickerEl.textContent = headlines || "אין כותרות כרגע.";
}

function clearOpsLayers() {
  Object.values(opsLayers).forEach((layer) => layer.clearLayers());
}

function renderOpsMap(items) {
  clearOpsLayers();
  const markers = [];

  items.slice(0, 70).forEach((item) => {
    const place = detectPlaceFromHeadline(item.title);
    if (!place) return;
    const tags = classifyHeadline(item.title);
    const [lat, lng] = PLACE_COORDS[place];

    tags.forEach((tag) => {
      const color = {
        attack: "#ef4444",
        base: "#f59e0b",
        nuclear: "#a855f7",
        proxy: "#22d3ee",
        diplomacy: "#10b981"
      }[tag] || "#60a5fa";

      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.8
      });
      marker.bindPopup(`<strong>${place}</strong><br>${item.title}<br><small>${item.source} • ${tag}</small>`);
      opsLayers[tag].addLayer(marker);
      markers.push(marker);
    });
  });

  if (markers.length) {
    const group = L.featureGroup(markers);
    opsMap.fitBounds(group.getBounds().pad(0.25));
  }
}

function renderGlobeNews(items) {
  if (!globeReady || !globe) return;

  const points = items.slice(0, 70)
    .map((item) => {
      const place = detectPlaceFromHeadline(item.title);
      if (!place) return null;
      const tags = classifyHeadline(item.title);
      const [lat, lng] = PLACE_COORDS[place];
      const primary = tags[0];
      const color = {
        attack: "#ef4444",
        base: "#f59e0b",
        nuclear: "#a855f7",
        proxy: "#22d3ee",
        diplomacy: "#10b981"
      }[primary] || "#60a5fa";
      return {
        lat,
        lng,
        size: 0.13,
        radius: 0.38,
        color,
        label: `<b>${place}</b><br/>${item.title}<br/><small>${item.source}</small>`
      };
    })
    .filter(Boolean);

  globe.pointsData(points);
}

function renderNews(items) {
  newsListEl.innerHTML = "";
  newsCountEl.textContent = String(items.length);
  sourceCountEl.textContent = String(new Set(items.map((item) => item.source)).size);

  if (!items.length) {
    newsListEl.innerHTML = '<li class="placeholder">לא נמצאו ידיעות כרגע.</li>';
    renderTicker([]);
    renderOpsMap([]);
    renderGlobeNews([]);
    return new Set();
  }

  renderTicker(items);
  renderOpsMap(items);
  renderGlobeNews(items);

  const observedTags = new Set();

  items.slice(0, 35).forEach((item) => {
    classifyHeadline(item.title).forEach((tag) => observedTags.add(tag));
    const li = document.createElement("li");
    li.innerHTML = `<a href="${item.link}" target="_blank" rel="noopener noreferrer">${item.title}</a><div class="subline">${item.source} • ${item.pubDate || "ללא תאריך"}</div>`;
    newsListEl.appendChild(li);
  });

  return observedTags;
}

function renderAlerts(payload) {
  orefLayer.clearLayers();
  alertsListEl.innerHTML = "";
  const alertCities = Array.isArray(payload?.data) ? payload.data : [];
  alertsCountEl.textContent = String(alertCities.length);

  if (!alertCities.length) {
    alertsListEl.innerHTML = '<li class="placeholder">אין התראות פעילות כרגע.</li>';
    return;
  }

  alertCities.forEach((city) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="alert-badge">התראה</span>${city}`;
    alertsListEl.appendChild(li);

    const coords = findAlertCoordinates(city);
    if (!coords) return;
    const marker = L.circleMarker(coords, { radius: 9, color: "#f87171", fillColor: "#f87171", fillOpacity: 0.75 });
    marker.bindPopup(`<strong>${city}</strong><br>${payload.title || "התראת חירום"}`);
    orefLayer.addLayer(marker);
  });

  const layers = orefLayer.getLayers();
  if (layers.length) israelMap.fitBounds(L.featureGroup(layers).getBounds().pad(0.3));
}

function applyOpsFilter(filter) {
  Object.entries(opsLayers).forEach(([key, layer]) => {
    const shouldShow = filter === "all" || filter === key;
    if (shouldShow && !opsMap.hasLayer(layer)) layer.addTo(opsMap);
    if (!shouldShow && opsMap.hasLayer(layer)) opsMap.removeLayer(layer);
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
}

opsFiltersEl.addEventListener("click", (event) => {
  const btn = event.target.closest(".filter-btn");
  if (!btn) return;
  applyOpsFilter(btn.dataset.filter);
});

async function loadNews() {
  const settled = await Promise.allSettled(RSS_SOURCES.map((source) => fetchText(source.url)));
  const items = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(...parseRssItems(result.value, RSS_SOURCES[index].name));
    else console.warn("RSS source failed", RSS_SOURCES[index].name, result.reason);
  });
  return items.filter((item) => item.link && item.title).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
}

async function loadAlerts() {
  const text = await fetchText(OREF_ENDPOINT, { headers: { "X-Requested-With": "XMLHttpRequest" } });
  const parsed = text.startsWith("[") ? JSON.parse(text)[0] : JSON.parse(text);
  return parsed || {};
}

async function refreshAll() {
  systemStatusEl.textContent = "מתעדכן...";
  const now = Date.now();
  const [newsResult, alertsResult] = await Promise.allSettled([loadNews(), loadAlerts()]);

  if (alertsResult.status === "fulfilled") {
    renderAlerts(alertsResult.value);
  } else {
    alertsCountEl.textContent = "0";
    alertsListEl.innerHTML = '<li class="placeholder">שגיאה בטעינת התראות בזמן אמת.</li>';
    orefLayer.clearLayers();
  }

  let observedTags = new Set();
  if (newsResult.status === "fulfilled") {
    observedTags = renderNews(newsResult.value);
    registerPendingPredictions(newsResult.value, now);
  } else {
    newsListEl.innerHTML = '<li class="placeholder">שגיאה בטעינת חדשות.</li>';
  }

  resolvePredictions(observedTags, now);
  renderSourceScores();
  saveReliabilityState();

  systemStatusEl.textContent = (newsResult.status === "fulfilled" && alertsResult.status === "fulfilled") ? "פעיל" : "שגיאת מקור";
  lastUpdateEl.textContent = `עדכון אחרון: ${new Date().toLocaleTimeString("he-IL")}`;
}

initGlobe();
applyOpsFilter("all");
refreshAll();
setInterval(refreshAll, REFRESH_INTERVAL_MS);
