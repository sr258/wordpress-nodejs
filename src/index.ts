import express from "express";
import * as wpAuth from "wp-auth";
import { promisify } from "util";

import { getUserData, hasCap, loadRoles } from "./wp-sql";

const start = async () => {
  await loadRoles();

  const app = express();
  const port = 3000;

  const authenticator = wpAuth.create({
    wpurl: "http://localhost:7000",
    logged_in_key: "d86935b67dd417fa2347bfa7972763be3c1a845d",
    logged_in_salt: "80564189220e440ff813ca05883cb8f220881034",
    mysql_host: "localhost",
    mysql_user: "wordpress",
    mysql_pass: "wordpress",
    mysql_port: "3306",
    mysql_db: "wordpress",
    wp_table_prefix: "wp_",
  });

  app.use((req: express.Request, res, next): void => {
    authenticator
      .checkAuth(req)
      .on("auth", async (authIsValid: boolean, userId: string | undefined) => {
        console.log("Received authentication information from WP");
        if (authIsValid && userId) {
          const data = await getUserData(userId);
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
            if (hasCap(role, "edit_posts")) {
              req.user.permission = "privileged";
            }
          }
          if (!req.user?.permission) {
            req.user.permission = "user";
          }
          next();
        } else {
          next();
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

  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
  });
};

start();
