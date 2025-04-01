const puppeteer = require("puppeteer");
const fs = require("fs");

const COOKIES_FILE = "twitter_cookies.json";

(async () => {
    const browser = await puppeteer.launch({
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        headless: false,
        defaultViewport: null
    });

    const page = await browser.newPage();

    // **Load session cookies if available**
    if (fs.existsSync(COOKIES_FILE)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
        await page.setCookie(...cookies);
        console.log("✅ Loaded session cookies.");
    }

    // **Go to Twitter**
    await page.goto("https://twitter.com/home", { waitUntil: "networkidle2" });

    if ((await page.url()).includes("login")) {
        console.log("🔑 Login required. Please log in manually.");
        await new Promise(r => setTimeout(r, 60000)); // 60 seconds for login

        // **Save session cookies after login**
        const cookies = await page.cookies();
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
        console.log("✅ Login successful. Session cookies saved.");
    } else {
        console.log("🎉 Already logged in!");
    }

    // **Go to Advanced Search**
    console.log("📌 Navigate to Twitter Advanced Search manually & set your filters.");
    await page.goto("https://twitter.com/search-advanced", { waitUntil: "networkidle2" });

    console.log("🕒 Waiting 30 seconds for you to set filters...");
    await new Promise(r => setTimeout(r, 30000));

    console.log("🚀 Starting scraping...");

    let tweets = new Set();
    let lastHeight = await page.evaluate("document.body.scrollHeight");

    while (true) {
        // **Scrape tweets from the visible page**
        const newTweets = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("article")).map(tweet => tweet.innerText);
        });

        newTweets.forEach(tweet => tweets.add(tweet));

        console.log(`✅ Scraped ${tweets.size} tweets so far...`);

        // **Scroll down to load more tweets**
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
        await new Promise(r => setTimeout(r, 3000)); // Wait for new tweets to load

        let newHeight = await page.evaluate("document.body.scrollHeight");
        if (newHeight === lastHeight) break; // Stop if no more tweets are loaded
        lastHeight = newHeight;
    }

    console.log(`🎯 Scraping complete! Total tweets collected: ${tweets.size}`);
    fs.writeFileSync("tweets.json", JSON.stringify([...tweets], null, 2));

    // **Close browser**
    await browser.close();
    console.log("🔒 Browser closed successfully.");
})();
