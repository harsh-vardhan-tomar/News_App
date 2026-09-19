const newsGrid = document.getElementById("newsGrid");
const statusText = document.getElementById("status");
const locationText = document.getElementById("locationText");

const searchInput = document.getElementById("searchInput");
const categorySelect = document.getElementById("categorySelect");

const searchBtn = document.getElementById("searchBtn");
const refreshBtn = document.getElementById("refreshBtn");

let currentCountry = "in";

// Detect browser location
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
      locationText.textContent =
        "Location denied • India news";

      loadNews();
    }
  );
}

// Render news cards
function renderNews(articles) {
  newsGrid.innerHTML = "";

  if (!articles || articles.length === 0) {
    newsGrid.innerHTML =
      '<div class="empty">No news found.</div>';
    return;
  }

  articles.forEach((article) => {
    const card = document.createElement("article");

    card.className = "news-card";

    const image = article.urlToImage ||
      "https://placehold.co/600x350?text=News";

    const title = article.title || "Untitled article";

    const description = article.description ||
      "Read the complete story from the original source.";

    const source = article.source?.name ||
      "Unknown source";

    card.innerHTML = `
      <img
        src="${image}"
        alt="News image"
        onerror="this.src='https://placehold.co/600x350?text=News';"
      >

      <div class="news-content">
        <div class="source">${escapeHTML(source)}</div>

        <h3>${escapeHTML(title)}</h3>

        <p>${escapeHTML(description)}</p>

        <a
          class="read-more"
          href="${article.url}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read full article →
        </a>
      </div>
    `;

    newsGrid.appendChild(card);
  });
}

// Prevent HTML injection in text fields
function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Fetch news from API
async function loadNews() {
  if (API_KEY === "YOUR_NEWSAPI_KEY") {
    statusText.textContent =
      "Add your NewsAPI key in script.js.";

    newsGrid.innerHTML =
      '<div class="empty">API key required.</div>';

    return;
  }

  const searchTerm = searchInput.value.trim();
  const category = categorySelect.value;

  let url =
    `https://newsapi.org/v2/top-headlines?country=${currentCountry}&category=${category}&pageSize=30&apiKey=${API_KEY}`;

  if (searchTerm) {
    url =
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchTerm)}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${API_KEY}`;
  }

  statusText.textContent = "Loading news...";

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to fetch news");
    }

    renderNews(data.articles);

    statusText.textContent =
      `${data.totalResults || data.articles.length} results found`;

  } catch (error) {
    statusText.textContent = "Could not load news.";

    newsGrid.innerHTML =
      `<div class="empty">${escapeHTML(error.message)}</div>`;
  }
}

// Event listeners
searchBtn.addEventListener("click", loadNews);

refreshBtn.addEventListener("click", loadNews);

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadNews();
  }
});

categorySelect.addEventListener("change", loadNews);

// Start application
getLocation();