const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getRoyaltySigningBlocker,
  getPendingRoyaltyAcceptanceIds,
  normalizeRoyaltySplits,
  hasSplitTermsChanged,
  getRoyaltyEditBlocker,
} = require("../src/helpers/royaltyTerms");

const splits = [
  { userId: "owner", royaltyShare: 50, approvalStatus: "ACCEPTED" },
  { userId: "alice", royaltyShare: 30, approvalStatus: "ACCEPTED" },
  { userId: "bob", royaltyShare: 20, approvalStatus: "PENDING" },
  { userId: "carol", royaltyShare: 0, approvalStatus: "REJECTED" },
];

test("anyone may sign when the project has no royalties", () => {
  assert.equal(getRoyaltySigningBlocker({ splits: [], userId: "alice", ownerId: "owner" }), null);
});

test("the owner may sign without responding to royalty terms", () => {
  assert.equal(getRoyaltySigningBlocker({ splits: [], userId: "owner", ownerId: "owner" }), null);
  assert.equal(
    getRoyaltySigningBlocker({ splits: splits.slice(1), userId: "owner", ownerId: "owner" }),
    null
  );
});

test("a collaborator who accepted their split may sign", () => {
  assert.equal(getRoyaltySigningBlocker({ splits, userId: "alice", ownerId: "owner" }), null);
});

test("pending and rejected splits block signing", () => {
  assert.match(getRoyaltySigningBlocker({ splits, userId: "bob", ownerId: "owner" }), /must accept/);
  assert.match(getRoyaltySigningBlocker({ splits, userId: "carol", ownerId: "owner" }), /must accept/);
});

test("a collaborator with no split on a royalty project cannot sign", () => {
  assert.match(
    getRoyaltySigningBlocker({ splits, userId: "dave", ownerId: "owner" }),
    /no royalty share has been assigned/
  );
});

test("pending acceptance lists every signer who is blocked, excluding the owner", () => {
  const pending = getPendingRoyaltyAcceptanceIds(splits, ["owner", "alice", "bob", "carol", "dave"], "owner");
  assert.deepEqual(pending, ["bob", "carol", "dave"]);
  assert.deepEqual(getPendingRoyaltyAcceptanceIds([], ["owner", "alice"], "owner"), []);
});

test("normalises valid splits", () => {
  assert.deepEqual(
    normalizeRoyaltySplits([{ userId: "alice", royaltyShare: "40", role: "Producer" }, { userId: "bob", royaltyShare: 0 }], ["owner", "alice", "bob"]),
    [
      { userId: "alice", royaltyShare: 40, role: "Producer" },
      { userId: "bob", royaltyShare: 0, role: null },
    ]
  );
});

test("rejects invalid split payloads", () => {
  const eligible = ["owner", "alice", "bob"];
  assert.throws(() => normalizeRoyaltySplits("nope", eligible), /must be an array/);
  assert.throws(() => normalizeRoyaltySplits([{ userId: "alice" }], eligible), /numeric royaltyShare/);
  assert.throws(() => normalizeRoyaltySplits([{ userId: "alice", royaltyShare: -1 }], eligible), /between 0 and 100/);
  assert.throws(() => normalizeRoyaltySplits([{ userId: "mallory", royaltyShare: 10 }], eligible), /not an active collaborator/);
  assert.throws(
    () => normalizeRoyaltySplits([{ userId: "alice", royaltyShare: 10 }, { userId: "alice", royaltyShare: 5 }], eligible),
    /more than once/
  );
  assert.throws(
    () => normalizeRoyaltySplits([{ userId: "alice", royaltyShare: 60 }, { userId: "bob", royaltyShare: 50 }], eligible),
    /cannot exceed 100%/
  );
});

test("detects when split terms change", () => {
  const existing = { royaltyShare: "30.00", role: "Producer" };
  assert.equal(hasSplitTermsChanged(existing, { royaltyShare: 30, role: "Producer" }), false);
  assert.equal(hasSplitTermsChanged(existing, { royaltyShare: 25, role: "Producer" }), true);
  assert.equal(hasSplitTermsChanged(existing, { royaltyShare: 30, role: null }), true);
  assert.equal(hasSplitTermsChanged(undefined, { royaltyShare: 30, role: null }), true);
});

test("royalty terms are frozen while a live agreement has signatures", () => {
  assert.equal(getRoyaltyEditBlocker([]), null);
  assert.equal(getRoyaltyEditBlocker([{ status: "PENDING_SIGNATURE", signatures: [] }]), null);
  assert.equal(getRoyaltyEditBlocker([{ status: "CANCELLED", signatures: [{ id: "s1" }] }]), null);
  assert.match(getRoyaltyEditBlocker([{ status: "PENDING_SIGNATURE", signatures: [{ id: "s1" }] }]), /Cancel the agreement/);
  assert.match(getRoyaltyEditBlocker([{ status: "SIGNED", signatures: [{ id: "s1" }] }]), /Cancel the agreement/);
});
