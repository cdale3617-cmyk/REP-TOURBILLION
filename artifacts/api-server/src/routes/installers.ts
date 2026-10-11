import { Router, type IRouter } from "express";
import path from "node:path";

const router: IRouter = Router();
const installerDirectory = path.resolve(process.cwd(), "../../generated-artifacts/android");

// Only the verified build outputs are downloadable; no arbitrary file paths.
for (const build of ["1.0.5-build6", "1.0.6-build7", "1.0.7-build8", "1.0.8-build9", "1.0.9-build10"]) {
  for (const extension of ["apk", "zip"] as const) {
  const filename = `DRC-Golf-Tempo-${build}.${extension}`;
  router.get(`/downloads/${filename}`, (req, res) => {
    res.download(path.join(installerDirectory, filename), filename, {
      headers: {
        "Content-Type": extension === "apk" ? "application/vnd.android.package-archive" : "application/zip",
        "X-Content-Type-Options": "nosniff",
      },
    }, (error) => {
      if (!error) return;
      req.log.warn({ err: error }, "Installer download failed");
      if (!res.headersSent) {
        res.status(404).json({ error: "This installer is unavailable in the current project session." });
      } else {
        res.destroy();
      }
    });
  });
  }
}

export default router;
