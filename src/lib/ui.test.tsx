// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BriefStudio from "../pages/BriefStudio";
import Studio from "../pages/Studio";
import Contact from "../components/sections/Contact";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/auth/status")) {
        return jsonResponse({ authenticated: false, demoMode: true, hint: "klyro-studio", studioName: "KLYRO Creative Studio" });
      }
      if (url.includes("/api/enquiries")) {
        return jsonResponse({
          ok: true, reference: "KLY-TEST-001", grade: "hot", score: 82,
          analysis: { summary: "Enquiry reads as launch campaign, budget signalled." },
        }, 201);
      }
      return jsonResponse({});
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("public UI smoke tests", () => {
  it("renders the AI Brief Studio wizard and advances between steps", () => {
    render(<MemoryRouter><BriefStudio onNavigate={() => undefined} /></MemoryRouter>);
    expect(screen.getByText(/Turn a vague idea into a clear creative brief/i)).toBeTruthy();
    const brand = screen.getByPlaceholderText("e.g. Lumière Café");
    fireEvent.change(brand, { target: { value: "Test Café" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(screen.getByText(/What should this work achieve/i)).toBeTruthy();
  });

  it("shows the Studio login with the demo hint", async () => {
    render(<MemoryRouter><Studio theme="light" onToggleTheme={() => undefined} /></MemoryRouter>);
    expect(await screen.findByText("Your client pipeline.")).toBeTruthy();
    expect(screen.getByText("klyro-studio")).toBeTruthy();
    expect(screen.getByLabelText("Studio passphrase")).toBeTruthy();
  });

  it("submits the contact form to the API and shows the confirmation", async () => {
    render(<MemoryRouter><Contact /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Test Client" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "test@brand.co.in" } });
    fireEvent.change(screen.getByLabelText("Tell us about your project"), { target: { value: "Need a brand identity and Instagram plan." } });
    fireEvent.click(screen.getByRole("button", { name: /Send Project Enquiry/i }));
    expect(await screen.findByText(/Thank you, Test/i)).toBeTruthy();
    expect(screen.getByText("KLY-TEST-001")).toBeTruthy();
    expect(screen.getByText(/Enquiry reads as launch campaign/i)).toBeTruthy();
  });
});
