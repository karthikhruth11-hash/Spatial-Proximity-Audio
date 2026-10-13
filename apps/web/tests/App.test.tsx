import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/app/App.js";

// Mock fetch for health checks in LandingPage
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    json: () => Promise.resolve({ ok: true, data: { status: "live" } }),
  }),
);

describe("ProxiSpeak Web Client Shell", () => {
  it("renders Landing Page heading and navigation CTAs", async () => {
    render(<App />);

    expect(screen.getByText(/Spatial Proximity Audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter Virtual Office/i)).toBeInTheDocument();
    expect(await screen.findByText(/Online & Ready/i)).toBeInTheDocument();
  });
});
