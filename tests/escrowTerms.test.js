const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateEffectiveTotalCost,
  buildEscrowTerms,
  planCollaboratorRemoval,
} = require("../src/helpers/escrowTerms");
const { configureEscrowSchema, updateEscrowSchema } = require("../src/schemas/escrow.schema");

const milestones = [
  { title: "Demo", amount: 50000, collaboratorIds: ["alice", "bob"] },
  { title: "Master", amount: 100000, collaboratorIds: ["alice"] },
];

test("effective cost pays every collaborator the full milestone amount", () => {
  assert.equal(calculateEffectiveTotalCost(milestones), 200000);
});

test("builds per-collaborator allocations from milestones", () => {
  const { allocationByUser, effectiveTotalCost } = buildEscrowTerms({
    milestones,
    totalAmount: 200000,
    eligibleCollaboratorIds: ["alice", "bob"],
  });
  assert.equal(effectiveTotalCost, 200000);
  assert.deepEqual(allocationByUser, { alice: 150000, bob: 50000 });
});

test("rejects collaborators who are not active on the project", () => {
  assert.throws(
    () => buildEscrowTerms({ milestones, totalAmount: 200000, eligibleCollaboratorIds: ["alice"] }),
    /User bob is not an active collaborator on this project\./
  );
});

test("rejects a total that does not match the effective milestone cost", () => {
  assert.throws(
    () => buildEscrowTerms({ milestones, totalAmount: 150000, eligibleCollaboratorIds: ["alice", "bob"] }),
    /must equal the effective milestone cost/
  );
});

test("removing a shared collaborator keeps the milestone and lowers the total", () => {
  const plan = planCollaboratorRemoval(
    [
      { id: "m1", amount: "50000.00", collaborators: [{ userId: "alice" }, { userId: "bob" }] },
      { id: "m2", amount: "100000.00", collaborators: [{ userId: "alice" }] },
    ],
    "bob"
  );
  assert.deepEqual(plan.emptiedMilestoneIds, []);
  assert.equal(plan.newTotalAmount, 150000);
});

test("removing a milestone's only collaborator empties that milestone", () => {
  const plan = planCollaboratorRemoval(
    [
      { id: "m1", amount: 50000, collaborators: [{ userId: "alice" }, { userId: "bob" }] },
      { id: "m2", amount: 100000, collaborators: [{ userId: "alice" }] },
    ],
    "alice"
  );
  assert.deepEqual(plan.emptiedMilestoneIds, ["m2"]);
  assert.equal(plan.newTotalAmount, 50000);
});

test("update schema keeps agreementId and reviewPeriodDays optional with no default", () => {
  const result = updateEscrowSchema.safeParse({ totalAmount: 200000, milestones });
  assert.equal(result.success, true);
  assert.equal(result.data.reviewPeriodDays, undefined);
  assert.equal(result.data.agreementId, undefined);
});

test("update schema still enforces milestone and amount rules", () => {
  assert.equal(updateEscrowSchema.safeParse({ totalAmount: 500, milestones }).success, false);
  assert.equal(updateEscrowSchema.safeParse({ totalAmount: 200000, milestones: [] }).success, false);
  assert.equal(updateEscrowSchema.safeParse({ totalAmount: 200000, milestones, reviewPeriodDays: 31 }).success, false);
});

test("configure schema is unchanged: agreementId required, review period defaults to 7", () => {
  assert.equal(configureEscrowSchema.safeParse({ totalAmount: 200000, milestones }).success, false);
  const result = configureEscrowSchema.safeParse({ totalAmount: 200000, milestones, agreementId: "a1" });
  assert.equal(result.success, true);
  assert.equal(result.data.reviewPeriodDays, 7);
});
