const test = require("node:test");
const assert = require("node:assert/strict");

const { updatePreferencesSchema } = require("../src/schemas/profile.schema");

test("accepts each theme and normalises case", () => {
  for (const theme of ["LIGHT", "dark", "System"]) {
    const result = updatePreferencesSchema.safeParse({ theme });
    assert.equal(result.success, true);
    assert.equal(result.data.theme, theme.toUpperCase());
  }
});

test("rejects unknown or missing themes", () => {
  assert.equal(updatePreferencesSchema.safeParse({ theme: "purple" }).success, false);
  assert.equal(updatePreferencesSchema.safeParse({}).success, false);
  assert.equal(updatePreferencesSchema.safeParse({ theme: 1 }).success, false);
});

test("strips fields other than theme", () => {
  const result = updatePreferencesSchema.safeParse({ theme: "dark", tier: "ELITE" });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { theme: "DARK" });
});
