import express from "express";
import * as wpAuth from "wp-auth";
import debug from "debug";

import Settings from "./Settings";
import WordPressDB from "./WordPressDB";


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

  const authenticator = wpAuth.create({
    wpurl: settings.wordpressUrl,
    logged_in_key: settings.loggedInKey,
    logged_in_salt: settings.loggedInSalt,
    mysql_host: settings.dbHost,
    mysql_user: settings.dbUser,
    mysql_pass: settings.dbPassword,
    mysql_db: settings.dbName,
    mysql_port: settings.dbPort,
    wp_table_prefix: settings.tablePrefix,
  });
  log("WordPress authenticator initialized");

  app.use((req: express.Request, res, next): void => {
    authenticator
      .checkAuth(req)
      .on("auth", async (authIsValid: boolean, userId: string | undefined) => {
        log("Received authentication information from WP");
        if (authIsValid && userId) {
          const data = await db.getUserData(userId);
          if (!data) {
            log("User does not exist in user table. Redirecting to login site");
            res.redirect(
              `${settings.wordpressUrl}/wp-login.php?redirect_to=${settings.microserviceUrl}`
            );
            return;
          }
          req.user = { ...data, id: userId };

          const roles: any = await new Promise((resolve, reject) => {
            authenticator.getUserMeta(userId, "wp_capabilities", (roles) => {
              if (!roles) {
                reject();
              }
              resolve(roles);
            });
          });

          for (const role in roles) {
            if (roles[role] !== true) {
              continue;
            }
            if (db.hasCapability(role, "edit_posts")) {
              req.user.permission = "privileged";
            }
          }
          if (!req.user?.permission) {
            req.user.permission = "user";
          }
          log(
            "User is logged in with permission level %s",
            req.user.permission
          );
          next();
        } else {
          log("User is not logged in. Redirecting to login site");
          res.redirect(
            `${settings.wordpressUrl}/wp-login.php?redirect_to=${settings.microserviceUrl}`
          );
          return;
        }
      });
  });

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
  });
};

start();
