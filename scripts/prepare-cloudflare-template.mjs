#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "cloudflare-template");
const version = process.env.RELEASE_VERSION?.trim() || "dev";
const sourceRepo = process.env.SOURCE_REPO?.trim() || "HaradaKashiwa/ternssh";
const templateRepo =
  process.env.TEMPLATE_REPO?.trim() ||
  "haradakashiwa/ternssh-cloudflare-workers-template";

const templatePackageJson = {
  name: "ternssh-cloudflare-workers-template",
  private: true,
  license: "GPL-3.0-or-later",
  scripts: {
    postinstall: "npm install --prefix server",
    build: "node -e \"console.log('Using prebuilt ternssh artifacts')\"",
    deploy:
      "node scripts/generate-production-config.mjs --require && wrangler d1 migrations apply ternssh --remote --config wrangler.production.jsonc && wrangler deploy --config wrangler.production.jsonc",
    "db:migrate":
      "node scripts/generate-production-config.mjs --require && wrangler d1 migrations apply ternssh --remote --config wrangler.production.jsonc",
  },
  cloudflare: {
    bindings: {
      ACCESS_TEAM_DOMAIN: {
        description:
          "Cloudflare Access team domain (e.g. your-team.cloudflareaccess.com). With ACCESS_AUD, enables JWT verification.",
      },
      ACCESS_AUD: {
        description:
          "Application Audience (AUD) tag from your Access app. With ACCESS_TEAM_DOMAIN, enables JWT verification.",
      },
    },
  },
  devDependencies: {
    wrangler: "^4.24.3",
  },
};

const templateGitignore = `node_modules/
.wrangler/
wrangler.production.jsonc
.dev.vars
`;

function ensureExists(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required path: ${relativePath}`);
  }
  return absolutePath;
}

function copyInto(relativePath, targetRelativePath = relativePath) {
  const source = ensureExists(relativePath);
  const target = path.join(outDir, targetRelativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function writeTemplateReadme() {
  const deployUrl = `https://deploy.workers.cloudflare.com/?url=https://github.com/${templateRepo}`;
  const content = `# ternssh Cloudflare Workers Template

Prebuilt deploy snapshot from [${sourceRepo}](https://github.com/${sourceRepo}) **${version}**.

Use this repository for Cloudflare Workers one-click deploy and Workers Builds. Frontend assets are already built; \`npm run build\` is a no-op.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](${deployUrl})

## Workers Builds

| Step | Command |
|------|---------|
| Build | \`npm run build\` |
| Deploy | \`npm run deploy\` |

Ensure a remote D1 database named \`ternssh\` exists, or set \`D1_DATABASE_ID\` in build environment variables.

## Source

Generated automatically from \`${sourceRepo}\` tag \`${version}\`. Do not edit by hand.
`;

  fs.writeFileSync(path.join(outDir, "README.md"), content);
}

function writeWranglerJsonc() {
  let content = fs.readFileSync(
    path.join(root, "wrangler.production.jsonc.example"),
    "utf8",
  );
  content = content.replace(/^\s*"account_id": "__CLOUDFLARE_ACCOUNT_ID__",\n/m, "");
  fs.writeFileSync(path.join(outDir, "wrangler.jsonc"), content);
}

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

ensureExists("server/public/index.html");
ensureExists("server/src/index.ts");

copyInto("server/src", "server/src");
copyInto("server/migrations", "server/migrations");
copyInto("server/public", "server/public");
copyInto("server/package.json", "server/package.json");
copyInto("server/package-lock.json", "server/package-lock.json");
copyInto("scripts/generate-production-config.mjs", "scripts/generate-production-config.mjs");
copyInto("wrangler.production.jsonc.example", "wrangler.production.jsonc.example");
copyInto(".dev.vars.example", ".dev.vars.example");

writeWranglerJsonc();
writeTemplateReadme();

fs.writeFileSync(
  path.join(outDir, "package.json"),
  `${JSON.stringify(templatePackageJson, null, 2)}\n`,
);
fs.writeFileSync(path.join(outDir, ".gitignore"), templateGitignore);
fs.writeFileSync(path.join(outDir, "VERSION"), `${version}\n`);

console.log(`Prepared Cloudflare template at ${outDir} (${version})`);
