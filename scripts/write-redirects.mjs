import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await writeFile(
  "dist/_redirects",
  [
    "/admin /index.html 200",
    "/admin/* /index.html 200",
    "/adm /index.html 200",
    "/adm/* /index.html 200",
    "/noticias /index.html 200",
    "/noticias/* /index.html 200",
    "/materias /index.html 200",
    "/materias/* /index.html 200",
    "",
  ].join("\n"),
);
