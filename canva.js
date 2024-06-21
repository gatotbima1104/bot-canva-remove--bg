import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { setTimeout } from "timers/promises";
import { connect } from "puppeteer-real-browser";
import fs from "fs";

puppeteer.use(StealthPlugin());

// Function to scroll the page
async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });
}

// Function click items
async function clickItem(page, index){
  try {
    await page.evaluate((index) => {
      const gridItems = document.querySelectorAll('div[role="button"]');
      if (gridItems[index]) {
        gridItems[index].click();
      }
    }, index);
  
    await setTimeout(2000); // Wait for 3 seconds
  
    const removeBg = "div.oDHgrA";
    await page.click(removeBg);
    await setTimeout(3500); // Wait for 3 seconds after removing background
  
    const saveBtn = 'div._2Cr23Q > div.JyB_vw > div > div > button'
    // await page.waitForSelector(saveBtn)
    await page.click(saveBtn)
    await setTimeout(500)
  
    const saveToCanvaBtn = 'div > button._1QoxDw.Qkd66A.tYI0Vw.o4TrkA.Eph8Hg.NT2yCg.Qkd66A.tYI0Vw.lsXp_w.ubW6qw.fgQwew.zQlusQ.uRvRjQ.hZHAVA'
    await page.click(saveToCanvaBtn)
    await setTimeout(500)
  
    return true;
  } catch (error) {
    console.error(`Error clicking item at index ${index}:`, error);
    return false;
  }
}

// Function reading grid items
async function processGridItems(page) {
  let processedIndices = new Set(); // Track processed item indices
  let index = 0;

  while (true) {
    await scrollToBottom(page);
    await setTimeout(1000);
    let currentGridItems = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[role="button"]')).map(
        (item, i) => ({ index: i, outerHTML: item.outerHTML })
      );
    });

    // Filter out already processed items
    let unprocessedItems = currentGridItems.filter(item => !processedIndices.has(item.index));

    if (index >= unprocessedItems.length) {
      break;
    }

    if (index === 0) {
      console.log(`======= Found ${unprocessedItems.length} unprocessed items`);
    }

    const itemToProcess = unprocessedItems[index];

    const successRemoved = await clickItem(page, itemToProcess.index);
    if (successRemoved) {
      console.log(`======= Removed background for item number ${index + 1}`);
      processedIndices.add(itemToProcess.index); // Mark item as processed
      index++;
    } else {
      console.log(`======= Failed to remove background for item number ${index + 1}`);
    }
    await setTimeout(3000); // Wait for 3 seconds before processing next item
  }
}

connect({
  headless: "auto",
  turnstile: true,
}).then(async (response) => {
  const { page, browser, setTarget } = response;
  try {
    // Check cookies
    const existCookies = fs.existsSync("./cookies.json");
    if (!existCookies) {
      await page.goto("https://www.canva.com/login/");

      // const emailBtn = "div._k_QMg > button:nth-child(4)";
      // await page.click(emailBtn);
      // await setTimeout(2000);

      console.log("Waiting for authenticating ....");
      // Wait for the URL to change to "https://www.canva.com/"
      await page.waitForNavigation({
        waitUntil: "networkidle0",
        timeout: 1800000,
      });

      if (page.url() === "https://www.canva.com/") {
        const cookies = await page.cookies();
        fs.writeFileSync("./cookies.json", JSON.stringify(cookies, null, 2));
        console.log("======= Cookies saved successfully");
      }
    } else {
      const cookiesString = fs.readFileSync("./cookies.json");
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);
      console.log("======= Cookies found and setted successfully");
    }

    // Go to projects
    await page.setViewport({ width: 1050, height: 800 })
    await page.goto("https://www.canva.com/projects", {
      waitUntil: "domcontentloaded",
    });
    await setTarget({status: false})

    // Open for avoid cloudflare
    let page2 = await browser.newPage();
    await setTarget({ status: true });
    await page2.close()
    await setTimeout(5000);

    await processGridItems(page);

    console.log(`======= All Products backgrounds Removed successfully`);

    await browser.close(); // Uncomment if you want to close the browser after the task is completed
  } catch (error) {
    console.log(error);
  }
});


