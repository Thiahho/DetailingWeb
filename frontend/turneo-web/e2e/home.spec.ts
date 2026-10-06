import { test, expect } from "@playwright/test";
import { seedConsent } from "./consent";

// Home comercial de Turneo ("/"): página estática, no depende del tenant ni de
// los datos sembrados en global-setup. Se preseedea la decisión de cookies para
// que la barra de consentimiento no tape la barra fija de contacto en mobile.

// Un bloque por problema del dueño — ids de las secciones en
// src/components/landing/content.ts (PROBLEMAS).
const PROBLEM_SECTION_IDS = ["ausencias", "reservas", "caja", "insumos", "equipo"];

test.describe("Home comercial de Turneo", () => {
  test.beforeEach(async ({ page }) => {
    await seedConsent(page);
  });

  test("muestra un único h1 y el CTA principal lleva a WhatsApp", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const cta = page.getByTestId("home-hero-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
    await expect(cta).toHaveAttribute("target", "_blank");
  });

  test("nombra los dolores y tiene un bloque con título por cada problema", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 2, name: /te suena/i })).toBeVisible();
    await expect(page.getByTestId("home-pain")).toHaveCount(4);

    for (const id of PROBLEM_SECTION_IDS) {
      const heading = page.locator(`section#${id}`).getByRole("heading", { level: 2 });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading, `título del bloque #${id}`).toBeVisible();
    }
  });

  test("las preguntas frecuentes se abren y cierran", async ({ page }) => {
    await page.goto("/");

    const questions = page.getByTestId("home-faq-question");
    expect(await questions.count()).toBeGreaterThan(2);

    // La primera viene abierta; se abre la segunda y la primera se cierra.
    const first = questions.nth(0);
    const second = questions.nth(1);
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(second).toHaveAttribute("aria-expanded", "false");

    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    const panelId = await second.getAttribute("aria-controls");
    await expect(page.locator(`#${panelId} p`)).toBeVisible();
  });

  test("no hay scroll horizontal a 390 px y la barra fija de contacto queda a mano", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Lejos del cierre, la barra fija ofrece el contacto por WhatsApp.
    await page.locator("section#caja").scrollIntoViewIfNeeded();
    const bar = page.getByTestId("home-mobile-cta");
    await expect(bar).toBeInViewport();
    await expect(bar).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  });
});
