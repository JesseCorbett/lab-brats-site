import { chromium } from 'playwright'
import * as cheerio from 'cheerio'
import fs from 'node:fs'
import people from './people.json' with { type: 'json' }

const updates = []

const randomizedKeys = Object.keys(people).sort(() => 0.5 - Math.random())

for (const person of randomizedKeys) {
  const accounts = people[person]
  console.log(`Processing ${person}`)

  const browser = await chromium.launch()
  const page = await browser.newPage()

  if (accounts.instagram) {
    console.log(`Fetching Instagram ${accounts.instagram}`)
    try {
      const response = await fetch(`https://social-media-users-data-api-production.lightricks.org/instagram?username=${accounts.instagram}`)
      const data = await response.json()
      const followers = data.followersCount
      updates.push({ key: `${person}-instagram`, value: followers })
    } catch (e) {
      console.error(`Error fetching Instagram followers for ${accounts.instagram}:`, e)
      console.info('Falling back to manual scraping.')
      try {
        await page.goto(`https://www.instagram.com/${accounts.instagram}`)
        const container = await page.getByText('followers')
        const count = await container.locator('span').first()
        const followers = await count.innerText()
        updates.push({ key: `${person}-instagram`, value: followers })
      } catch (e) {
        console.error(`Error scraping Instagram followers for ${person}:`, e)
      } finally {
        await page.screenshot({ path: `screenshots/${person} Instagram.png` })
      }
    }
  }
  if (accounts.tiktok) {
    console.log(`Fetching Tiktok ${accounts.tiktok}`)
    try {
      await page.goto(`https://tiktok.com/@${accounts.tiktok}`)
      try {
        const refreshButton = await page.getByText('Refresh')
        await refreshButton.click()
      } catch (e) {
        // Skip if the button is not found
      }
      const count = await page.locator('strong[data-e2e="followers-count"]')
      const followers = await count.innerText()
      updates.push({ key: `${person}-tiktok`, value: followers })
    } catch (e) {
      console.error(`Error fetching Tiktok followers for ${person}:`, e)
    } finally {
      await page.screenshot({ path: `screenshots/${person} Tiktok.png` })
    }
  }
  if (accounts.x) {
    console.log(`Fetching X ${accounts.x}`)
    try {
      await page.goto(`https://x.com/${accounts.x}`)
      const count = await page.locator(`a[href="/${accounts.x}/verified_followers"] > span:first-child`)
      const followers = await count.innerText()
      updates.push({ key: `${person}-x`, value: followers })
    } catch (e) {
      console.error(`Error fetching X followers for ${person}:`, e)
    } finally {
      await page.screenshot({ path: `screenshots/${person} X.png` })
    }
    if (accounts.twitch) {
      console.log(`Fetching Twitch ${accounts.twitch}`)
      try {
        await page.goto(`https://www.twitch.tv/${accounts.twitch}`)
        const count = await page.getByText(/\d+K followers/)
        const followers = await count.innerText()
        updates.push({ key: `${person}-twitch`, value: followers.split(' ')[0] })
      } catch (e) {
        console.error(`Error fetching Twitch followers for ${person}:`, e)
      } finally {
        await page.screenshot({ path: `screenshots/${person} Twitch.png` })
      }
    }
    if (accounts.youtube) {
      // TODO
    }
    if (accounts.spotify) {
      // TODO
    }
  }

  await browser.close()
}

const now = new Date().toISOString()
const html = fs.readFileSync('index.html', 'utf8')
const $ = cheerio.load(html)

for (const update of updates) {
  console.log(`Updating ${update.key} to ${update.value}`)

  let displayValue = update.value
  const numericValue = Number(update.value?.toString()?.replace(',', ''))

  if (update.value !== null && update.value !== '' && !isNaN(numericValue)) {
    if (numericValue >= 1000) {
      displayValue = `${Math.round(numericValue / 100) / 10}K`
    } else {
      continue
    }
  }

  const elements = $(`[data-${update.key}]`)
  elements.text(displayValue).attr('data-updated-at', now)
}

fs.writeFileSync('index.html', $.html())
