import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers";

test("the landing shows the real example plot and links to real parcels", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cosa si può costruire qui?");
  // The hero card and the API sample both show the same real plot.
  await expect(page.getByText("Foglio 150B · Particella 782").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Firenze, zona B" })).toHaveAttribute("href", /\/studio\?lat=/);
});

test("the sources page lists official bodies and the limits of the data", async ({ page }) => {
  await page.goto("/fonti");
  await expect(page.getByRole("heading", { name: "Fonti e licenze" })).toBeVisible();
  await expect(page.getByText("Agenzia delle Entrate").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Limiti dei dati" })).toBeVisible();
});

test("unknown pages get the branded not-found page", async ({ page }) => {
  const response = await page.goto("/questa-pagina-non-esiste");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Questa pagina non è sulla mappa.")).toBeVisible();
});
