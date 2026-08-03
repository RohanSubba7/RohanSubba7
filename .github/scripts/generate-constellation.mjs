import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const login = process.env.GITHUB_LOGIN || "RohanSubba7";

if (!token) {
  throw new Error("GITHUB_TOKEN is required");
}

const query = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
              weekday
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "activity-constellation-generator",
  },
  body: JSON.stringify({ query, variables: { login } }),
});

if (!response.ok) {
  throw new Error(`GitHub API returned ${response.status}`);
}

const payload = await response.json();
if (payload.errors?.length) {
  throw new Error(payload.errors.map((error) => error.message).join("; "));
}

const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
if (!calendar) {
  throw new Error(`No contribution calendar found for ${login}`);
}

const weeks = calendar.weeks.slice(-53);
const width = 940;
const height = 240;
const left = 46;
const top = 58;
const stepX = 16.2;
const stepY = 20;
const colours = {
  NONE: "#302c29",
  FIRST_QUARTILE: "#8a6b3f",
  SECOND_QUARTILE: "#b99355",
  THIRD_QUARTILE: "#d6b16d",
  FOURTH_QUARTILE: "#fff2bf",
};

const active = [];
const stars = [];

weeks.forEach((week, weekIndex) => {
  week.contributionDays.forEach((day) => {
    const x = left + weekIndex * stepX;
    const y = top + day.weekday * stepY;
    const isActive = day.contributionCount > 0;
    const radius = isActive ? Math.min(5.4, 2.8 + Math.log2(day.contributionCount + 1) * 0.65) : 1.7;
    const colour = colours[day.contributionLevel] || colours.NONE;
    if (isActive) active.push({ x, y });
    stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${colour}" class="${isActive ? "star active" : "star"}"><title>${day.date}: ${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"}</title></circle>`);
  });
});

const path = active.length > 1
  ? `M ${active.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")}`
  : "";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${login}'s GitHub activity constellation</title>
  <desc id="desc">An animated constellation created from ${calendar.totalContributions} contributions during the last year.</desc>
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#141210"/><stop offset=".55" stop-color="#24201c"/><stop offset="1" stop-color="#181512"/></linearGradient>
    <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#8a6b3f"/><stop offset=".5" stop-color="#fff2bf"/><stop offset="1" stop-color="#b99355"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <style>
    .label{font:600 17px system-ui,sans-serif;fill:#f4f1eb}.meta{font:12px system-ui,sans-serif;fill:#a99e91}.star{opacity:.48}.active{filter:url(#glow);animation:twinkle 3.8s ease-in-out infinite alternate}.trail{stroke-dasharray:9 18;animation:travel 7s linear infinite}@keyframes travel{to{stroke-dashoffset:-270}}@keyframes twinkle{to{opacity:.72;transform:scale(.84);transform-origin:center}}@media(prefers-reduced-motion:reduce){.active,.trail{animation:none}}
  </style>
  <rect width="100%" height="100%" rx="18" fill="url(#sky)"/>
  <circle cx="820" cy="25" r="120" fill="#d6b16d" opacity=".035"/>
  <text x="32" y="32" class="label">Activity constellation</text>
  <text x="908" y="32" text-anchor="end" class="meta">${calendar.totalContributions} contributions · last 12 months</text>
  ${path ? `<path d="${path}" fill="none" stroke="#8a6b3f" stroke-width="1" opacity=".2"/><path class="trail" d="${path}" fill="none" stroke="url(#trail)" stroke-width="2.2" stroke-linecap="round" filter="url(#glow)"/>` : ""}
  <g>${stars.join("")}</g>
  <text x="32" y="222" class="meta">Every active day adds another star.</text>
</svg>`;

await mkdir("assets", { recursive: true });
await writeFile("assets/activity-constellation.svg", svg, "utf8");
console.log(`Generated constellation with ${calendar.totalContributions} contributions.`);
