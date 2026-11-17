// One-off generator for PWA icons. Run: node scripts/generate-icons.mjs
// Uses next/og (satori + resvg) so no extra dependencies are needed.
import { writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og.js";
import React from "react";

const h = React.createElement;

function Icon({ size, padding }) {
  const inner = size - padding * 2;
  const stroke = Math.round(inner * 0.075);
  // A simple "person + plus" glyph on a dark rounded field.
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#18181b",
      },
    },
    h(
      "svg",
      {
        width: inner * 0.62,
        height: inner * 0.62,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "#fafafa",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { strokeWidth: stroke / (inner * 0.62 / 24) },
      },
      h("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }),
      h("circle", { cx: 9, cy: 7, r: 4 }),
      h("line", { x1: 19, x2: 19, y1: 8, y2: 14 }),
      h("line", { x1: 22, x2: 16, y1: 11, y2: 11 }),
    ),
  );
}

async function render(file, size, padding = 0) {
  const res = new ImageResponse(h(Icon, { size, padding }), { width: size, height: size });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log("wrote", file);
}

await render("public/icons/icon-192.png", 192);
await render("public/icons/icon-512.png", 512);
// Maskable: keep the glyph inside the 80% safe zone.
await render("public/icons/icon-maskable-512.png", 512, 52);
await render("public/apple-touch-icon.png", 180);
await render("src/app/icon.png", 64);
