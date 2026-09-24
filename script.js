const newsGrid = document.getElementById("newsGrid");
const statusText = document.getElementById("status");
const locationText = document.getElementById("locationText");

const searchInput = document.getElementById("searchInput");
const categorySelect = document.getElementById("categorySelect");
const regionSelect = document.getElementById("regionSelect");

const searchBtn = document.getElementById("searchBtn");
const refreshBtn = document.getElementById("refreshBtn");

const headlinesSection = document.getElementById("headlines");
const headlinesBody = document.getElementById("headlinesBody");
const scrollStatus = document.getElementById("scrollStatus");
const backToTop = document.getElementById("backToTop");

const liveView = document.getElementById("liveView");
const savedSection = document.getElementById("savedSection");
const savedGrid = document.getElementById("savedGrid");
const savedViewBtn = document.getElementById("savedViewBtn");
const savedViewLabel = document.getElementById("savedViewLabel");
const savedCountEl = document.getElementById("savedCount");
const exportSavedBtn = document.getElementById("exportSavedBtn");

const PAGE_SIZE = 30;
const HEADLINE_COUNT = 5;      // first stories shown in the Top Headlines block
const FREE_PLAN_LIMIT = 100;   // NewsAPI free plan returns at most 100 results
const PLACEHOLDER = "https://placehold.co/600x350?text=News";
const SAVED_KEY = "newsscope_saved_articles";

let currentCountry = "in";

// Pagination / infinite-scroll state
let state = freshState();
let requestId = 0; // used to ignore responses from outdated requests

function freshState() {
  return {
    page: 0,
    totalResults: 0,
    loading: false,
    done: false,
    seen: new Set(),
    loadedCount: 0,
    fallback: false // true when India has no top-headlines and we use Indian news sites
  };
}

// ---------- Location ----------

function getLocation() {
  if (!navigator.geolocation) {
    locationText.textContent = "Location unavailable • India news";
    loadNews();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      locationText.textContent =
        `Location detected • ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;

      currentCountry = "in";
      loadNews();
    },
    () => {
      locationText.textContent = "Location denied • India news";
      loadNews();
    }
  );
}

// ---------- Helpers ----------

// Prevent HTML injection in text fields
function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Only allow http(s) links / images
function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function timeAgo(dateString) {
  const time = new Date(dateString).getTime();
  if (!time) return "";

  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function isValidArticle(article) {
  return (
    article &&
    article.title &&
    article.title !== "[Removed]" &&
    safeUrl(article.url)
  );
}

// NewsAPI's `content` field is a longer excerpt than `description`, but on
// the free/developer plan it's cut short with a trailing marker like
// "... [+1234 chars]". Strip that marker and merge it with the description
// to build the fullest summary paragraph the API actually gives us.
function cleanContent(content) {
  if (!content) return "";
  return content.replace(/\s*\[\+\d+\s*chars\]\s*$/i, "").trim();
}

function buildSummary(article) {
  const description = (article.description || "").trim();
  const content = cleanContent(article.content);

  if (!description) {
    return content || "Read the complete story from the original source.";
  }
  if (!content || content === description) return description;

  // Don't duplicate text when one is just a prefix of the other
  if (content.startsWith(description)) return content;
  if (description.startsWith(content)) return description;

  return `${description} ${content}`;
}

function attachImageFallback(root) {
  root.querySelectorAll("img").forEach((img) => {
    img.addEventListener(
      "error",
      () => { img.src = PLACEHOLDER; },
      { once: true } // avoid an endless loop if the placeholder fails too
    );
  });
}

// ---------- Save for offline reading ----------
// NewsAPI only returns a title, summary and thumbnail — not the full article
// body — so "offline reading" means caching that same data locally (not
// scraping the full text). It works two ways:
//   1. Saved articles are kept in localStorage and shown in the "Saved" view,
//      which needs no network connection at all.
//   2. "Export as file" writes them to a plain-text file the user can keep
//      and reopen anywhere, even outside the browser.

let savedArticles = loadSaved();

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // corrupted or unavailable storage: start fresh instead of crashing
  }
}

function persistSaved() {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedArticles));
  } catch (error) {
    console.warn("Could not save article (storage full or unavailable).", error);
  }
}

function isSaved(url) {
  return savedArticles.some((a) => a.url === url);
}

function toggleSave(article) {
  const url = safeUrl(article.url);
  if (!url) return;

  if (isSaved(url)) {
    savedArticles = savedArticles.filter((a) => a.url !== url);
  } else {
    savedArticles.push({
      title: article.title,
      description: article.description || "",
      summary: buildSummary(article),
      url,
      urlToImage: safeUrl(article.urlToImage) || "",
      source: article.source?.name || "Unknown source",
      publishedAt: article.publishedAt || "",
      savedAt: new Date().toISOString(),
    });
  }

  persistSaved();
  updateSavedCount();
}

function updateSavedCount() {
  savedCountEl.textContent = `(${savedArticles.length})`;
  exportSavedBtn.disabled = savedArticles.length === 0;
}

function setupSaveButton(button, article) {
  const url = safeUrl(article.url);
  updateSaveButton(button, isSaved(url));

  button.addEventListener("click", () => {
    toggleSave(article);
    updateSaveButton(button, isSaved(url));
  });
}

function updateSaveButton(button, saved) {
  button.textContent = saved ? "★ Saved" : "☆ Save";
  button.classList.toggle("saved", saved);
  button.setAttribute("aria-pressed", String(saved));
}

function renderSavedView() {
  savedGrid.innerHTML = "";

  if (savedArticles.length === 0) {
    savedGrid.innerHTML =
      '<div class="empty">No saved articles yet. Tap ☆ Save on any story to read it offline.</div>';
    return;
  }

  [...savedArticles].reverse().forEach((article) => {
    const card = document.createElement("article");
    card.className = "news-card";

    const image = article.urlToImage || PLACEHOLDER;
    const description =
      article.summary || article.description || "Read the complete story from the original source.";
    const ago = timeAgo(article.publishedAt);

    card.innerHTML = `
      <img src="${escapeHTML(image)}" alt="" loading="lazy">

      <div class="news-content">
        <div class="source">
          ${escapeHTML(article.source)}${ago ? ` <span class="time">• ${ago}</span>` : ""}
        </div>

        <h3>${escapeHTML(article.title)}</h3>

        <p>${escapeHTML(description)}</p>

        <div class="card-actions">
          <a
            class="read-more"
            href="${escapeHTML(article.url)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read full article →
          </a>
          <button class="save-btn saved" aria-label="Remove from saved">✕ Remove</button>
        </div>
      </div>
    `;

    attachImageFallback(card);

    card.querySelector(".save-btn").addEventListener("click", () => {
      savedArticles = savedArticles.filter((a) => a.url !== article.url);
      persistSaved();
      updateSavedCount();
      renderSavedView();
    });

    savedGrid.appendChild(card);
  });
}

function exportSavedArticles() {
  if (savedArticles.length === 0) return;

  const entries = savedArticles.map((article, index) => {
    const date = article.publishedAt ? new Date(article.publishedAt).toLocaleString() : "";
    return (
      `${index + 1}. ${article.title}\n` +
      `${article.source}${date ? " • " + date : ""}\n` +
      `${article.summary || article.description}\n` +
      `Read online: ${article.url}`
    );
  });

  const text =
    `NewsScope — Saved Articles (exported ${new Date().toLocaleString()})\n` +
    `${entries.length} article${entries.length === 1 ? "" : "s"}\n\n` +
    entries.join("\n\n---\n\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `newsscope-saved-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function toggleSavedView() {
  const showingSaved = savedSection.hidden; // about to switch to saved view
  liveView.hidden = showingSaved;
  savedSection.hidden = !showingSaved;
  savedViewLabel.textContent = showingSaved ? "← Back to news" : "📥 Saved";
  savedCountEl.hidden = showingSaved;

  if (showingSaved) renderSavedView();
}

savedViewBtn.addEventListener("click", toggleSavedView);
exportSavedBtn.addEventListener("click", exportSavedArticles);

// ---------- Rendering ----------

function renderCards(articles) {
  articles.forEach((article) => {
    const card = document.createElement("article");
    card.className = "news-card";

    const image = safeUrl(article.urlToImage) || PLACEHOLDER;
    const description =
      article.description || "Read the complete story from the original source.";
    const source = article.source?.name || "Unknown source";
    const ago = timeAgo(article.publishedAt);

    card.innerHTML = `
      <img src="${escapeHTML(image)}" alt="" loading="lazy">

      <div class="news-content">
        <div class="source">
          ${escapeHTML(source)}${ago ? ` <span class="time">• ${ago}</span>` : ""}
        </div>

        <h3>${escapeHTML(article.title)}</h3>

        <p>${escapeHTML(description)}</p>

        <div class="card-actions">
          <a
            class="read-more"
            href="${escapeHTML(safeUrl(article.url))}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read full article →
          </a>
          <button class="save-btn" aria-label="Save for offline reading">☆ Save</button>
        </div>
      </div>
    `;

    attachImageFallback(card);
    setupSaveButton(card.querySelector(".save-btn"), article);
    newsGrid.appendChild(card);
  });
}

function renderHeadlines(articles) {
  if (articles.length === 0) {
    headlinesSection.hidden = true;
    return;
  }

  const [lead, ...rest] = articles;
  const leadImage = safeUrl(lead.urlToImage) || PLACEHOLDER;

  const listItems = rest
    .map((article, index) => {
      const ago = timeAgo(article.publishedAt);
      return `
        <li>
          <span class="num">${index + 2}</span>
          <a href="${escapeHTML(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer">
            ${escapeHTML(article.title)}
            <small>${escapeHTML(article.source?.name || "Unknown source")}${ago ? " • " + ago : ""}</small>
          </a>
        </li>`;
    })
    .join("");

  headlinesBody.innerHTML = `
    <a class="lead-story" href="${escapeHTML(safeUrl(lead.url))}" target="_blank" rel="noopener noreferrer">
      <img src="${escapeHTML(leadImage)}" alt="">
      <div class="lead-overlay">
        <span class="lead-source">${escapeHTML(lead.source?.name || "Unknown source")}</span>
        <h3>${escapeHTML(lead.title)}</h3>
      </div>
    </a>
    <ol class="headline-list">${listItems}</ol>
  `;

  attachImageFallback(headlinesBody);
  headlinesSection.hidden = false;
}

function setScrollStatus(message, retry = false) {
  scrollStatus.innerHTML = "";
  scrollStatus.textContent = message;

  if (retry) {
    const button = document.createElement("button");
    button.textContent = "Retry";
    button.className = "retry-btn";
    button.addEventListener("click", () => loadNews({ reset: false }));
    scrollStatus.appendChild(button);
  }
}

// ---------- Data ----------

// Indian news sites, used to keep results India-focused
const INDIA_DOMAINS = [
  "timesofindia.indiatimes.com", "thehindu.com", "ndtv.com",
  "hindustantimes.com", "indianexpress.com", "indiatoday.in",
  "news18.com", "livemint.com", "economictimes.indiatimes.com",
  "business-standard.com", "firstpost.com", "deccanherald.com"
].join(",");

// Keywords used when NewsAPI has no India top-headlines for a category
const CATEGORY_KEYWORDS = {
  general: "India",
  business: "business OR economy OR market OR sensex",
  technology: "technology OR tech OR AI OR startup",
  sports: "cricket OR IPL OR sports OR football",
  science: "science OR research OR ISRO",
  health: "health OR medical OR hospital",
  entertainment: "Bollywood OR film OR movie OR entertainment"
};

function isIndia() {
  return regionSelect.value === "in";
}

function buildUrl(page) {
  const searchTerm = searchInput.value.trim();
  const category = categorySelect.value;
  const paging = `pageSize=${PAGE_SIZE}&page=${page}&apiKey=${API_KEY}`;

  // Search: limited to Indian news sites when the region is India
  if (searchTerm) {
    const domains = isIndia() ? `&domains=${INDIA_DOMAINS}` : "";
    return `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchTerm)}&language=en&sortBy=publishedAt${domains}&${paging}`;
  }

  // India has no top-headlines for this category: use Indian news sites instead
  if (isIndia() && state.fallback) {
    const q = encodeURIComponent(CATEGORY_KEYWORDS[category] || "India");
    return `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&domains=${INDIA_DOMAINS}&${paging}`;
  }

  // Worldwide has no country filter; India uses country=in
  const country = isIndia() ? `country=${currentCountry}&` : "";

  return `https://newsapi.org/v2/top-headlines?${country}category=${category}&${paging}`;
}

// Fetch one page; if India has no top-headlines for the category, retry
// with Indian news sites (instead of falling back to US-heavy worldwide news)
async function fetchPage(page) {
  let response = await fetch(buildUrl(page));
  let data = await response.json();

  const noResults = response.ok && (data.articles || []).length === 0;

  if (
    page === 1 && noResults && isIndia() &&
    !state.fallback && !searchInput.value.trim()
  ) {
    state.fallback = true;
    response = await fetch(buildUrl(page));
    data = await response.json();
  }

  return { response, data };
}

// Label shown in the status line, e.g. `Sports • India`, `Search "ai" • Worldwide`
function currentLabel() {
  const region = regionSelect.options[regionSelect.selectedIndex].textContent;
  const term = searchInput.value.trim();
  if (term) return `Search "${term}" • ${region}`;

  const option = categorySelect.options[categorySelect.selectedIndex];
  return `${option.textContent} • ${region}`;
}

// reset = true  -> start a fresh search/category/refresh
// reset = false -> load the next page (infinite scroll)
async function loadNews({ reset = true } = {}) {
  if (typeof API_KEY === "undefined" || API_KEY === "YOUR_NEWSAPI_KEY") {
    statusText.textContent = "Add your NewsAPI key in config.js.";
    newsGrid.innerHTML = '<div class="empty">API key required.</div>';
    headlinesSection.hidden = true;
    return;
  }

  if (reset) {
    state = freshState();
    newsGrid.innerHTML = "";
    headlinesBody.innerHTML = "";
    headlinesSection.hidden = true;
    scrollStatus.textContent = "";
    statusText.textContent = "Loading news...";
  } else if (state.loading || state.done) {
    return;
  }

  const myRequest = ++requestId;
  const page = state.page + 1;
  state.loading = true;

  if (!reset) setScrollStatus("Loading more stories...");

  try {
    const { response, data } = await fetchPage(page);

    if (myRequest !== requestId) return; // a newer request replaced this one

    // Free plan cap reached: not a real failure, just the end of the list
    if (data.code === "maximumResultsReached") {
      state.done = true;
      state.loading = false;
      setScrollStatus("You've reached the end of the available stories.");
      return;
    }

    if (!response.ok) {
      throw new Error(data.message || "Unable to fetch news");
    }

    state.page = page;
    state.totalResults = data.totalResults || 0;

    // Drop removed/invalid articles and duplicates
    const fresh = (data.articles || []).filter((article) => {
      if (!isValidArticle(article) || state.seen.has(article.url)) return false;
      state.seen.add(article.url);
      return true;
    });

    let gridArticles = fresh;

    // Page 1 of top headlines: the first few become the Top Headlines block
    const isSearch = searchInput.value.trim() !== "";
    if (page === 1 && !isSearch) {
      renderHeadlines(fresh.slice(0, HEADLINE_COUNT));
      gridArticles = fresh.slice(HEADLINE_COUNT);
    }

    state.loadedCount += fresh.length;

    if (page === 1 && fresh.length === 0) {
      newsGrid.innerHTML = '<div class="empty">No news found.</div>';
    } else {
      renderCards(gridArticles);
    }

    const reachable = Math.min(state.totalResults, FREE_PLAN_LIMIT);
    state.done =
      (data.articles || []).length === 0 || page * PAGE_SIZE >= reachable;

    statusText.textContent = `${currentLabel()} • ${state.totalResults} results found`;
    setScrollStatus(state.done && state.loadedCount > 0 ? "You've reached the end." : "");
    state.loading = false;

    // If the page is still too short to scroll, keep filling it
    requestAnimationFrame(loadMoreIfSentinelVisible);
  } catch (error) {
    if (myRequest !== requestId) return;

    state.loading = false;

    if (reset) {
      statusText.textContent = "Could not load news.";
      newsGrid.innerHTML = `<div class="empty">${escapeHTML(error.message)}</div>`;
    } else {
      setScrollStatus("Could not load more stories.", true);
    }
  }
}

// ---------- Infinite scroll ----------

function loadMoreIfSentinelVisible() {
  if (state.loading || state.done || state.page === 0) return;

  const top = scrollStatus.getBoundingClientRect().top;
  if (top < window.innerHeight + 400) {
    loadNews({ reset: false });
  }
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadMoreIfSentinelVisible();
    },
    { rootMargin: "400px 0px" }
  );
  observer.observe(scrollStatus);
}

// Fallback for very old browsers
window.addEventListener("scroll", () => {
  if (!("IntersectionObserver" in window)) loadMoreIfSentinelVisible();
  backToTop.hidden = window.scrollY < 600;
}, { passive: true });

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- Event listeners ----------

searchBtn.addEventListener("click", () => loadNews());
refreshBtn.addEventListener("click", () => loadNews());

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadNews();
});

// Choosing a category leaves search mode. Otherwise the search text keeps
// overriding the category and the news would appear not to change.
// Switching region keeps the current search/category and reloads
regionSelect.addEventListener("change", () => loadNews());

categorySelect.addEventListener("change", () => {
  searchInput.value = "";
  loadNews();
});

// Start application
updateSavedCount();
getLocation();