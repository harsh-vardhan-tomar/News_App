# 📰 NewsPulse - Dynamic News Web Application

A modern and responsive news web application built with **Vanilla JavaScript** and **NewsAPI**. It allows users to browse top headlines, search for specific topics, filter by categories, and automatically detects location for regional news.

---

## 🚀 Features

* **Real-time News:** Fetches live top headlines and articles using NewsAPI.
* **Search Functionality:** Search for any topic, keyword, or event worldwide.
* **Category Filtering:** Filter news by categories (Business, Technology, Sports, Entertainment, etc.).
* **Geolocation Detection:** Automatically detects the user's location to display relevant news context.
* **Responsive Design:** Works seamlessly across desktops, tablets, and mobile devices.
* **Secure Configuration:** Uses a configuration template to keep API keys hidden from public version control.

---

## 🛠️ Built With

* **HTML5 & CSS3** (Responsive Layout & Styling)
* **JavaScript (ES6+)** (Async/Await, DOM Manipulation, Geolocation API)
* **NewsAPI** (External REST API for news data)

---

## ⚙️ Setup & Installation

To run this project locally on your machine, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/harsh-vardhan-tomar/News_App.git](https://github.com/harsh-vardhan-tomar/News_App.git)
   cd News_App
2. **Generate your own NewsAPI Key:**

   Open your browser and go to NewsAPI: https://newsapi.org <br>
   Click on "Get API Key" or sign up for a free account. <br>
   After logging in, copy your unique API key from your account dashboard.

3. **Configure your API Key locally:**

   Create a new file named config.js in the root directory of your project.
4. **Paste your API key inside config.js like this:**

   JavaScript
   const API_KEY = "YOUR_ACTUAL_API_KEY";
