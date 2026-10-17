const test = require("node:test");
const assert = require("node:assert/strict");

const { resolvePaymentRedirectUrl } = require("../src/modules/payments/services/flutterwave.service");
const { initializeFundingSchema } = require("../src/schemas/payment.schema");

const ENV_KEYS = [
  "FLW_REDIRECT_URL",
  "FRONTEND_URL",
];

const withEnvironment = (values, callback) => {
  const previousValues = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);

  try {
    callback();
  } finally {
    for (const key of ENV_KEYS) {
      if (previousValues[key] === undefined) delete process.env[key];
      else process.env[key] = previousValues[key];
    }
  }
};

test("uses FLW_REDIRECT_URL when no redirect URL is provided", () => {
  withEnvironment(
    { FLW_REDIRECT_URL: "https://app.collabden.africa/payment/wallet" },
    () => {
      assert.equal(
        resolvePaymentRedirectUrl(),
        "https://app.collabden.africa/payment/wallet"
      );
    }
  );
});

test("uses the exact provided redirect URL when its origin is trusted", () => {
  withEnvironment(
    {
      FLW_REDIRECT_URL: "https://app.collabden.africa/payment/wallet",
      FRONTEND_URL: "https://app.collabden.africa",
    },
    () => {
      const requestedUrl =
        "https://app.collabden.africa/workspace/payment?projectId=project-123";
      assert.equal(resolvePaymentRedirectUrl(requestedUrl), requestedUrl);
    }
  );
});

test("accepts the current Vercel frontend origin", () => {
  withEnvironment({}, () => {
    const requestedUrl =
      "https://collabden-frontend-nine.vercel.app/workspace/payment";
    assert.equal(resolvePaymentRedirectUrl(requestedUrl), requestedUrl);
  });
});

test("accepts localhost port 3000 for local development", () => {
  withEnvironment({}, () => {
    const requestedUrl = "http://localhost:3000/workspace/payment";
    assert.equal(resolvePaymentRedirectUrl(requestedUrl), requestedUrl);
  });
});

test("rejects a provided redirect URL from an untrusted origin", () => {
  withEnvironment(
    { FLW_REDIRECT_URL: "https://app.collabden.africa/payment/wallet" },
    () => {
      assert.throws(
        () => resolvePaymentRedirectUrl("https://malicious.example/payment-complete"),
        /Redirect URL origin is not allowed/
      );
    }
  );
});

test("requires a configured default when no redirect URL is provided", () => {
  withEnvironment({}, () => {
    assert.throws(
      () => resolvePaymentRedirectUrl(),
      /Payment redirect URL is not configured/
    );
  });
});

test("funding schema preserves an optional HTTP redirect URL", () => {
  const redirectUrl = "https://app.collabden.africa/workspace/payment";
  const result = initializeFundingSchema.parse({
    amount: 5000,
    paymentMethod: "card",
    redirectUrl,
  });

  assert.equal(result.redirectUrl, redirectUrl);
});

test("funding schema rejects non-HTTP redirect URLs", () => {
  const result = initializeFundingSchema.safeParse({
    amount: 5000,
    paymentMethod: "card",
    redirectUrl: "javascript:alert(1)",
  });

  assert.equal(result.success, false);
});
