const puppeteer = require("puppeteer");
const fs = require("fs");
const readline = require("readline");

// **Set up user input**
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// **Prompt user for search inputs**
rl.question("Enter keywords (comma-separated, e.g., #eth, #bitcoin, #aiagents): ", (keywordsInput) => {
    rl.question("Enter 'from' date (YYYY-MM-DD) or leave empty for latest: ", (fromDate) => {
        rl.question("Enter 'to' date (YYYY-MM-DD) or leave empty for latest: ", (toDate) => {
            rl.close();

            // **Format user inputs**
            let keywords = keywordsInput.split(",").map(k => k.trim()).join(" OR ");
            let searchQuery = `(${keywords})`;
            if (fromDate) searchQuery += ` since:${fromDate}`;
            if (toDate) searchQuery += ` until:${toDate}`;

            // **Encode query for Twitter URL**
            const encodedQuery = encodeURIComponent(searchQuery);
            const searchURL = `https://twitter.com/search?q=${encodedQuery}&f=live`;

            (async () => {
                const browser = await puppeteer.launch({
                    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                    headless: false,
                    defaultViewport: null
                });

                const page = await browser.newPage();

                // **Load session cookies if available**
                const COOKIES_FILE = "twitter_cookies.json";
                if (fs.existsSync(COOKIES_FILE)) {
                    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
                    await page.setCookie(...cookies);
                    console.log("✅ Loaded session cookies.");
                }

                // **Go to Twitter & check login**
                await page.goto("https://twitter.com/home", { waitUntil: "networkidle2" });

                if ((await page.url()).includes("login")) {
                    console.log("🔑 Login required. Please log in manually.");
                    await new Promise(r => setTimeout(r, 60000)); // 60 seconds for login

                    // **Save session cookies**
                    const cookies = await page.cookies();
                    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
                    console.log("✅ Login successful. Session cookies saved.");
                } else {
                    console.log("🎉 Already logged in!");
                }

                // **Go to dynamic search URL**
                console.log(`🔍 Searching for: ${searchQuery}`);
                await page.goto(searchURL, { waitUntil: "networkidle2" });

                console.log("🚀 Starting scraping...");

                let tweets = new Set();
                let lastHeight = await page.evaluate("document.body.scrollHeight");

                while (true) {
                    // **Scrape tweets**
                    const newTweets = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll("article")).map(tweet => tweet.innerText);
                    });

                    newTweets.forEach(tweet => tweets.add(tweet));

                    console.log(`✅ Scraped ${tweets.size} tweets so far...`);

                    // **Scroll down for more tweets**
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
                    await new Promise(r => setTimeout(r, 3000));

                    let newHeight = await page.evaluate("document.body.scrollHeight");
                    if (newHeight === lastHeight) break;
                    lastHeight = newHeight;
                }

                console.log(`🎯 Scraping complete! Total tweets collected: ${tweets.size}`);
                fs.writeFileSync("tweets.json", JSON.stringify([...tweets], null, 2));

                // **Close browser**
                await browser.close();
                console.log("🔒 Browser closed successfully.");
            })();
        });
    });
});
