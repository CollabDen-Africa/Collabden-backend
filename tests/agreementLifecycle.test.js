const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getAgreementPartyIds,
  getPendingCancellationPartyIds,
  isCancellationPending,
  getAgreementDeletionBlocker,
  buildCancellationSummary,
} = require("../src/helpers/agreementLifecycle");

const agreement = (overrides = {}) => ({
  status: "SIGNED",
  project: { ownerId: "owner" },
  signatures: [{ userId: "owner" }, { userId: "alice" }],
  escrows: [],
  cancellationRequestedAt: null,
  cancellationRequestedById: null,
  cancellationReason: null,
  cancellationApprovals: [],
  cancelledAt: null,
  ...overrides,
});

test("parties are the owner plus every signer, without duplicates", () => {
  const parties = getAgreementPartyIds(agreement({
    signatures: [{ userId: "owner" }, { userId: "alice" }, { userId: "bob" }],
  }));
  assert.deepEqual(parties.sort(), ["alice", "bob", "owner"]);
});

test("an unsigned agreement has the owner as its only party", () => {
  assert.deepEqual(getAgreementPartyIds(agreement({ signatures: [] })), ["owner"]);
});

test("pending cancellation parties exclude those who already consented", () => {
  assert.deepEqual(getPendingCancellationPartyIds(["owner", "alice", "bob"], ["alice"]), ["owner", "bob"]);
  assert.deepEqual(getPendingCancellationPartyIds(["owner", "alice"], ["alice", "owner"]), []);
});

test("cancellation is pending only while requested and not yet cancelled", () => {
  assert.equal(isCancellationPending(agreement()), false);
  assert.equal(isCancellationPending(agreement({ cancellationRequestedAt: new Date() })), true);
  assert.equal(isCancellationPending(agreement({ status: "CANCELLED", cancellationRequestedAt: new Date() })), false);
});

test("unsigned drafts and pending agreements can be deleted", () => {
  assert.equal(getAgreementDeletionBlocker(agreement({ status: "DRAFT", signatures: [] })), null);
  assert.equal(getAgreementDeletionBlocker(agreement({ status: "PENDING_SIGNATURE", signatures: [] })), null);
});

test("cancelled and expired agreements can be deleted even when signed", () => {
  assert.equal(getAgreementDeletionBlocker(agreement({ status: "CANCELLED" })), null);
  assert.equal(getAgreementDeletionBlocker(agreement({ status: "EXPIRED" })), null);
});

test("signed or partially signed agreements must be cancelled before deletion", () => {
  assert.match(getAgreementDeletionBlocker(agreement({ status: "SIGNED" })), /must be cancelled/);
  assert.match(
    getAgreementDeletionBlocker(agreement({ status: "PENDING_SIGNATURE", signatures: [{ userId: "alice" }] })),
    /must be cancelled/
  );
});

test("agreements backing an escrow can never be deleted", () => {
  assert.match(
    getAgreementDeletionBlocker(agreement({ status: "CANCELLED", escrows: [{ id: "e1" }] })),
    /backs the project's escrow/
  );
});

test("cancellation summary reports who still needs to consent", () => {
  const requestedAt = new Date("2026-11-07T10:00:00Z");
  const summary = buildCancellationSummary(
    agreement({ cancellationRequestedAt: requestedAt, cancellationRequestedById: "alice", cancellationApprovals: ["alice"] }),
    ["owner", "alice"]
  );
  assert.equal(summary.requestedById, "alice");
  assert.deepEqual(summary.pendingFrom, ["owner"]);
});

test("cancellation summary is null without a request and empty once cancelled", () => {
  assert.equal(buildCancellationSummary(agreement(), ["owner"]), null);
  const summary = buildCancellationSummary(
    agreement({ status: "CANCELLED", cancellationRequestedAt: new Date(), cancellationApprovals: ["owner"] }),
    ["owner", "alice"]
  );
  assert.deepEqual(summary.pendingFrom, []);
});
