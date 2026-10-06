import { expect, test } from "@playwright/test";
import { geocode, layers, mockApi, plot } from "./helpers";

const plotUrl = `/studio?plot=${encodeURIComponent(plot.id)}&at=${plot.centroid.lat.toFixed(6)},${plot.centroid.lon.toFixed(6)}`;

test("address search suggests places from the API and opens the Studio on the chosen one", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/studio");
  const search = page.getByRole("combobox");
  await search.fill("Piazza della Signoria Firenze");
  const option = page.getByRole("option").first();
  await expect(option).toContainText(geocode[0].label);
  await option.click();
  await expect(page).toHaveURL(/plot=it%3AA564/);
});

test("a cadastral reference is not autocompleted and is searched on Enter", async ({ page }) => {
  const calls = await mockApi(page);
  await page.goto("/studio");
  const search = page.getByRole("combobox");
  await search.fill("Bagno a Ripoli foglio 60 particella 110");
  await expect(page.getByText("Premi Invio per cercare questo riferimento catastale.")).toBeVisible();
  await page.waitForTimeout(500);
  expect(calls.filter((c) => c.startsWith("/api/v1/geocode"))).toHaveLength(0);
  await search.press("Enter");
  await expect.poll(() => calls.filter((c) => c.startsWith("/api/v1/geocode")).length).toBe(1);
});

test("a shared plot link opens the parcel, loads every layer and shows the overview", async ({ page }) => {
  await mockApi(page);
  await page.goto(plotUrl);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Foglio 60");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("110");
  await expect(page.getByText("Quadro del terreno")).toBeVisible();
  await expect(page.getByText(/Fonti lette/)).toHaveCount(0);
});

test("opening a layer shows its sources and keeps it in the URL", async ({ page }) => {
  await mockApi(page);
  await page.goto(plotUrl);
  // The overview also links to the layer; target the row itself.
  const row = page.locator('button[aria-controls="layer-landslide"]');
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Fonti", { exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(/layer=landslide/);
});

test("the comparison page renders one column per plot from the report API", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ plot, layers: Object.values(layers), generatedAt: new Date().toISOString() }),
    });
  });
  await page.goto(
    `/confronta?p=${encodeURIComponent(`${plot.id}@${plot.centroid.lat},${plot.centroid.lon}`)}`,
  );
  await expect(page.getByRole("columnheader", { name: /Foglio 60/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /Frane/ })).toBeVisible();
});
