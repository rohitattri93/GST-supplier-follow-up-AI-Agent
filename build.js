/* Builds the single-file app: dist/artifact.html (for Claude) and dist/index.html (full document, for GitHub Pages and tests). */
const fs = require("fs"), path = require("path");
const P = (...a) => path.join(__dirname, ...a);
const read = f => fs.readFileSync(P(f), "utf8");
const links = fs.existsSync(P("links.json")) ? JSON.parse(read("links.json")) : {};
let app = ["app/app_core.js", "app/app_inbox.js", "app/app_supplier.js", "app/app_views.js", "app/app_events.js"].map(read).join("\n");
app = app.replace(/const LINKS = \{[^}]*\};/, "const LINKS = " + JSON.stringify(Object.assign({ submission: "", deck: "", doc: "", repo: "" }, links)) + ";");
const bundle = read("app/bundle.json");
let html = read("app/shell.html").replace("/*__CSS__*/", () => read("app/styles.css")).replace("/*__MODEL__*/", () => read("model.js")).replace("/*__APP__*/", () => app).replace("__BUNDLE__", () => bundle);
if (/<\/script>/i.test(bundle)) throw new Error("bundle contains a closing script tag");
fs.mkdirSync(P("dist"), { recursive: true });
fs.writeFileSync(P("dist/artifact.html"), html);
const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
fs.writeFileSync(P("dist/index.html"), full);
console.log("built", Math.round(Buffer.byteLength(html) / 1024), "KB");
