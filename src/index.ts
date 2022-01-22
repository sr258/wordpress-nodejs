import express from "express";
import debug from "debug";

import Settings from "./Settings";
import WordPressDB from "./WordPressDB";
import wpAuthMiddleware from "./wpAuthMiddleware";

const log = debug("wp-microservice");
let db: WordPressDB;
let settings: Settings;

const start = async () => {
  // Get settings (from environment variables)
  settings = Settings.load();
  log("Settings loaded");

  // Set up database repository
  db = new WordPressDB(
    settings.dbHost,
    settings.dbUser,
    settings.dbPassword,
    settings.dbName
  );
  // Load roles from WordPress database to allow checks
  try {
    await db.init();
  } catch (error) {
    console.error(error);
    // Terminate with non-zero error code
    process.exit(1);
  }
  log("Initialized database");

  const app = express();

  app.use(wpAuthMiddleware(settings, db));

  app.get("/", (req, res) => {
    const output = `Hello ${
      req.user?.displayName ?? "not logged in user"
    }!\nI have this information about you: ${JSON.stringify(
      req.user,
      undefined,
      2
    )}`.replace("\n", "<br/>");
    res.send(output);
  });

  app.listen(settings.port, () => {
    console.log(`Microservice listening at http://localhost:${settings.port}`);
    console.log(`Microservice public URL is ${settings.microserviceUrl}`);
  });
};

start();
