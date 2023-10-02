require("dotenv/config")

/** @type {import('kanel').Config} */
module.exports = {
  connection: {
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl: true
  },

  preDeleteOutputFolder: true,
  outputPath: "./src/schemas",

  customTypeMap: {
    "pg_catalog.json": {
      name: "JSONValue",
      typeImports: [
        {
          name: "JSONValue",
          path: "./src/lib/types",
          isAbsolute: false,
          isDefault: false
        }
      ]
    },

    "pg_catalog.jsonb": {
      name: "JSONValue",
      typeImports: [
        {
          name: "JSONValue",
          path: "./src/lib/types",
          isAbsolute: false,
          isDefault: false
        }
      ]
    }
  }
}
