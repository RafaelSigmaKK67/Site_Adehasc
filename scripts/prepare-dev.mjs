import { rm } from "node:fs/promises";

await rm("dist/_redirects", { force: true });
