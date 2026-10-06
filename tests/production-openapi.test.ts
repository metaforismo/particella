import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { apiExamples, apiOperations, apiSchemas, openApiDocument } from "#server/http/openapi.ts";
import { GET } from "../src/app/api/v1/openapi.json/route.ts";

async function routes(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? routes(join(root, entry.name))
          : entry.name === "route.ts"
            ? [join(root, entry.name)]
            : [],
      ),
    )
  ).flat();
}
test("OpenAPI covers every filesystem route and every exported HTTP method, including itself", async () => {
  const files = await routes("src/app/api/v1");
  const declared = new Set<string>();
  for (const file of files) {
    const path =
      "/" +
      file
        .replace(/^src\/app\//, "")
        .replace(/\/route.ts$/, "")
        .replace(/\[([^\]]+)\]/g, "{$1}");
    const text = await readFile(file, "utf8");
    for (const match of text.matchAll(
      /export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
    ))
      declared.add(`${match[1].toLowerCase()} ${path}`);
  }
  assert.deepEqual(new Set(apiOperations.map((op) => `${op.method} ${op.path}`)), declared);
});
test("all OpenAPI examples validate with executable zod and generated JSON Schema 2020-12", () => {
  const doc = openApiDocument();
  assert.equal(doc.openapi, "3.1.0");
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const components = doc.components as { schemas: Record<string, object> };
  for (const [name, example] of Object.entries(apiExamples)) {
    apiSchemas[name].parse(example);
    const validate = ajv.compile({ components, $ref: `#/components/schemas/${name}` });
    assert.ok(validate(example), `${name}: ${JSON.stringify(validate.errors)}`);
  }
  const paths = doc.paths as Record<
    string,
    Record<
      string,
      {
        responses: Record<
          string,
          { content: Record<string, { schema: object; example?: unknown }>; headers: Record<string, object> }
        >;
        parameters: { schema: object }[];
      }
    >
  >;
  for (const [name, path] of Object.entries(paths))
    for (const op of Object.values(path)) {
      for (const response of Object.values(op.responses))
        for (const media of Object.values(response.content)) {
          if (media.example !== undefined)
            assert.ok(ajv.compile({ components, ...media.schema })(media.example));
        }
      if (name === "/api/v1/health") assert.equal(op.responses["429"], undefined);
      else assert.ok(op.responses["429"].headers["Retry-After"]);
      if (name !== "/api/v1/status") assert.equal(op.responses["401"], undefined);
      assert.ok(op.responses["200"].headers["Server-Timing"]);
      for (const parameter of op.parameters) ajv.compile(parameter.schema);
    }
  assert.equal(ajv.compile(components.schemas.LotInput)({ parcels: [] }), false);
});
test("OpenAPI route serves validated JSON, timing and long public caching", async () => {
  const response = await GET(new Request("http://localhost/api/v1/openapi.json"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /s-maxage=86400/);
  assert.match(response.headers.get("server-timing")!, /total;dur=/);
  assert.equal((await response.json()).openapi, "3.1.0");
});
