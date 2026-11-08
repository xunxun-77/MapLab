import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const executablePath =
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = process.env.VERIFY_URL ?? 'http://127.0.0.1:5173/'
const outputDirectory = path.resolve('qa')

await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({
  executablePath,
  headless: true,
})

const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

const cases = [
  { name: 'lab', url: `${baseUrl}?view=lab&projection=albers&region=chinaFull` },
  { name: 'compare', url: `${baseUrl}?view=compare&projection=mercator&region=world` },
  { name: 'coordinate', url: `${baseUrl}?view=coordinate&projection=albers&region=chinaFull&pointLon=113.6254&pointLat=34.7466` },
  { name: 'thematic', url: `${baseUrl}?view=thematic&projection=albers&region=chinaFull` },
  { name: 'guide', url: `${baseUrl}?view=guide&projection=albers&region=chinaFull` },
]

for (const testCase of cases) {
  await page.goto(testCase.url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const summary = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    svgCount: document.querySelectorAll('.world-map__svg').length,
    countryPathCount: document.querySelectorAll('.map-country').length,
    provincePathCount: document.querySelectorAll('.map-province').length,
    tenDashLength: document.querySelector('.map-ten-dash')?.getAttribute('d')?.length ?? 0,
    bodyTextLength: document.body.innerText.length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  console.log(`${testCase.name}: ${JSON.stringify(summary)}`)
  await page.screenshot({
    path: path.join(outputDirectory, `${testCase.name}.png`),
    fullPage: true,
  })
}

const boundaryAudit = await page.evaluate(async () => {
  const geo = await import('/src/data/geography.js')
  return {
    provinces: geo.chinaProvinces.features.length,
    tenDashSegments: geo.tenDashBoundary.geometry.coordinates.length,
    hasHainan: geo.chinaProvinces.features.some((item) => item.properties.full_name === '海南省'),
    hasTaiwan: geo.chinaProvinces.features.some((item) => item.properties.full_name === '台湾省'),
  }
})
console.log(`boundary-audit: ${JSON.stringify(boundaryAudit)}`)

await page.goto(cases[0].url, { waitUntil: 'networkidle' })
await page
  .getByRole('button', { name: '兰伯特等角圆锥' })
  .first()
  .evaluate((element) => element.click())
await page.waitForTimeout(250)
const selectedTitle = await page.locator('.studio-title h2').first().textContent()
console.log(`projection-switch: ${selectedTitle?.trim()}`)

const projectionButtons = page.locator('.projection-option')
const projectionResults = []
for (let index = 0; index < (await projectionButtons.count()); index += 1) {
  await projectionButtons.nth(index).evaluate((element) => element.click())
  await page.waitForTimeout(90)
  projectionResults.push(
    await page.evaluate(() => ({
      title: document.querySelector('.studio-title h2')?.textContent?.trim() ?? '',
      paths:
        document.querySelectorAll('.map-country').length +
        document.querySelectorAll('.map-province').length,
      tenDash: document.querySelector('.map-ten-dash')?.getAttribute('d')?.length ?? 0,
    })),
  )
}
const brokenProjections = projectionResults.filter((item) => item.paths < 20 || item.tenDash < 20)
console.log(`projection-renders: ${projectionResults.length}, broken: ${brokenProjections.length}`)
if (brokenProjections.length) console.log(JSON.stringify(brokenProjections))

await page.locator('.segmented-control').filter({ hasText: '读点' }).getByRole('button', { name: '读点' }).click()
const map = page.locator('.world-map__svg').first()
const mapBox = await map.boundingBox()
if (mapBox) {
  await map.click({ position: { x: mapBox.width * 0.62, y: mapBox.height * 0.52 } })
  await page.waitForTimeout(150)
  const readout = await page.locator('.map-statusbar button').first().textContent()
  console.log(`map-point: ${readout?.trim() ?? 'none'}`)
}

await page.locator('.segmented-control').filter({ hasText: '框选' }).getByRole('button', { name: '框选' }).click()
if (mapBox) {
  await page.mouse.move(mapBox.x + mapBox.width * 0.55, mapBox.y + mapBox.height * 0.35)
  await page.mouse.down()
  await page.mouse.move(mapBox.x + mapBox.width * 0.74, mapBox.y + mapBox.height * 0.68, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  console.log(`extent-selection: ${(await page.locator('.extent-readout').innerText()).trim()}`)
}

await page.mouse.move(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * 0.5)
await page.mouse.wheel(0, -250)
await page.waitForTimeout(100)
console.log(`wheel-zoom: ${(await page.locator('.world-map__tools span').first().innerText()).trim()}`)

await page.locator('.sidebar-rail').getByRole('button', { name: '推荐' }).click()
await page.getByRole('button', { name: '获取投影推荐' }).click()
await page.waitForTimeout(150)
console.log(`recommendation-count: ${await page.locator('.recommendation-item').count()}`)

await page.locator('.sidebar-rail').getByRole('button', { name: '指令' }).click()
await page.locator('.command-panel textarea').fill('对比阿尔伯斯和墨卡托在中国的变形')
await page.locator('.command-panel').getByRole('button', { name: '解析并应用' }).click()
await page.waitForTimeout(150)
console.log(`natural-language-compare: ${await page.locator('.map-deck.is-compare').count()}`)

await page.goto(cases[2].url, { waitUntil: 'networkidle' })
await page.waitForTimeout(200)
const coordinateResult = await page.locator('.result-primary').first().innerText()
console.log(`coordinate-result: ${coordinateResult.replace(/\s+/g, ' ').trim()}`)

const coordinateSelect = page.locator('.coordinate-method select')
const coordinateValues = await coordinateSelect.locator('option').evaluateAll((options) =>
  options.map((option) => option.value),
)
const brokenCoordinates = []
for (const value of coordinateValues) {
  await coordinateSelect.selectOption(value)
  await page.waitForTimeout(70)
  const error = await page.locator('.coordinate-inputs .error-message').count()
  if (error) brokenCoordinates.push(value)
}
console.log(`coordinate-renders: ${coordinateValues.length}, errors: ${brokenCoordinates.join(',') || 'none'}`)

await page.getByRole('tab', { name: '平面坐标 → 经纬度' }).click()
await page.getByRole('button', { name: '开始反算' }).click()
await page.waitForTimeout(120)
console.log(`inverse-result: ${(await page.locator('.result-primary').first().innerText()).replace(/\s+/g, ' ').trim()}`)

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(cases[0].url, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const mobile = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  projectionColumns: getComputedStyle(document.querySelector('.projection-groups')).gridTemplateColumns,
}))
console.log(`mobile: ${JSON.stringify(mobile)}`)
await page.screenshot({ path: path.join(outputDirectory, 'mobile.png'), fullPage: true })

if (errors.length) {
  console.error(errors.join('\n'))
  await browser.close()
  process.exitCode = 1
} else {
  console.log('runtime-errors: none')
  await browser.close()
}
