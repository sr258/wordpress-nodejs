import mysql from "mysql2/promise";
import serialize from "wp-auth/serialize";

let caps: {
  [name: string]: {
    name: string;
    capabilities: {
      [name: string]: boolean;
    };
  };
} = {};

export function hasCap(role: string, capability: string): boolean {
  return caps[role]?.capabilities[capability] ?? false;
}

export async function loadRoles() {
  console.log("Loading roles from WP database ...");
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "wordpress",
    password: "wordpress",
    database: "wordpress",
  });

  caps = serialize.unserialize(
    (
      await connection.query(
        "SELECT option_value FROM wp_options WHERE `option_name` = 'wp_user_roles'"
      )
    )[0][0].option_value
  );
  if (caps) {
    console.log(Object.keys(caps).length, "roles loaded.");
  }
}

export async function getUserData(
  id: string
): Promise<{ username: string; displayName: string; email: string }> {
  console.log("Getting user information from WP database...");
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "wordpress",
    password: "wordpress",
    database: "wordpress",
  });

  const res = await connection.query(
    "SELECT display_name, user_email, user_nicename FROM wp_users WHERE `ID` = ?",
    [id]
  );
  return {
    displayName: res[0][0].display_name,
    email: res[0][0].user_email,
    username: res[0][0].user_nicename,
  };
}
