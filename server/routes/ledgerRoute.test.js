const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const ledgerRouter = require("./ledgerRoute");
const tokenLedger = require("../services/tokenLedger");

const ALICE = "alice";
const BOB = "bob";
const CHARLIE = "charlie";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/ledger", ledgerRouter);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  });
  return app;
}

function log(lines) {
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

async function partyBoard(app) {
  const [alice, bob, charlie, info] = await Promise.all([
    request(app).get(`/api/ledger/balance/${ALICE}`),
    request(app).get(`/api/ledger/balance/${BOB}`),
    request(app).get(`/api/ledger/balance/${CHARLIE}`),
    request(app).get("/api/ledger"),
  ]);
  return {
    alice: alice.body.balance,
    bob: bob.body.balance,
    charlie: charlie.body.balance,
    supply: info.body.totalSupply,
    lines: [
      `Alice    ${alice.body.balance} RVT`,
      `Bob      ${bob.body.balance} RVT`,
      `Charlie  ${charlie.body.balance} RVT`,
      `Supply   ${info.body.totalSupply} RVT`,
    ],
  };
}

describe("Ledger API — multi-party demo flow (HTTP)", () => {
  let app;

  beforeEach(() => {
    tokenLedger.reset();
    app = createTestApp();
  });

  describe("1. On mount — header + party board", () => {
    it("GET /api/ledger returns token name, symbol, supply 0", async () => {
      log(["Step: page mounts → fetch token header"]);
      const res = await request(app).get("/api/ledger");

      log([
        `  GET /api/ledger → ${res.status}`,
        `  ${res.body.name} (${res.body.symbol}), supply ${res.body.totalSupply}`,
      ]);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.name, "RentVerse Token");
      assert.equal(res.body.symbol, "RVT");
      assert.equal(res.body.totalSupply, 0);
    });

    it("GET balances — Alice, Bob, Charlie all start at 0", async () => {
      log(["Step: page mounts → fetch party board"]);
      const board = await partyBoard(app);

      log(board.lines.map((l) => `  ${l}`));

      assert.equal(board.alice, 0);
      assert.equal(board.bob, 0);
      assert.equal(board.charlie, 0);
      assert.equal(board.supply, 0);
    });
  });

  describe("2. Select Alice → Mint 100 RVT", () => {
    it("POST /api/ledger/mint credits Alice", async () => {
      log(["Step: Mint 100 RVT → Alice"]);
      const res = await request(app)
        .post("/api/ledger/mint")
        .send({ to: ALICE, amount: 100 });

      const board = await partyBoard(app);
      log([
        `  POST /mint { to: alice, amount: 100 } → ${res.status}`,
        `  Alice balance now ${res.body.balance}`,
        "Activity: Minted 100 RVT to Alice",
        "Board:",
        ...board.lines.map((l) => `  ${l}`),
      ]);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.to, ALICE);
      assert.equal(res.body.amount, 100);
      assert.equal(res.body.balance, 100);
      assert.equal(board.alice, 100);
      assert.equal(board.supply, 100);
    });

    it("rejects mint amount 0 with 400 (inline error)", async () => {
      log(["Step: Mint 0 RVT → Alice (invalid)"]);
      const res = await request(app)
        .post("/api/ledger/mint")
        .send({ to: ALICE, amount: 0 });

      log([
        `  POST /mint { amount: 0 } → ${res.status}`,
        `  message: ${res.body.message}`,
      ]);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe("3. Select Alice → Transfer 40 to Bob", () => {
    it("POST /api/ledger/transfer moves value; supply stays 100", async () => {
      await request(app).post("/api/ledger/mint").send({ to: ALICE, amount: 100 });
      log([
        "Step: Transfer 40 RVT  Alice → Bob",
        "Board before:",
        ...(await partyBoard(app)).lines.map((l) => `  ${l}`),
      ]);

      const res = await request(app)
        .post("/api/ledger/transfer")
        .send({ from: ALICE, to: BOB, amount: 40 });

      const board = await partyBoard(app);
      log([
        `  POST /transfer { from: alice, to: bob, amount: 40 } → ${res.status}`,
        `  Alice ${res.body.fromBalance} · Bob ${res.body.toBalance}`,
        "Activity: Alice → Bob: 40",
        "Board after:",
        ...board.lines.map((l) => `  ${l}`),
      ]);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.from, ALICE);
      assert.equal(res.body.to, BOB);
      assert.equal(res.body.amount, 40);
      assert.equal(res.body.fromBalance, 60);
      assert.equal(res.body.toBalance, 40);
      assert.equal(board.alice, 60);
      assert.equal(board.bob, 40);
      assert.equal(board.charlie, 0);
      assert.equal(board.supply, 100);
    });

    it("rejects transfer when sender has no funds (inline error)", async () => {
      log(["Step: Alice (0 RVT) tries to send 10 → Bob"]);
      const res = await request(app)
        .post("/api/ledger/transfer")
        .send({ from: ALICE, to: BOB, amount: 10 });

      log([
        `  POST /transfer → ${res.status}`,
        `  message: ${res.body.message}`,
      ]);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  describe("4. Full playground walkthrough", () => {
    it("Alice mint → Bob transfer → Charlie hop (end-to-end board)", async () => {
      log(["=== Demo walkthrough ==="]);

      log(["1. Mint 100 → Alice"]);
      await request(app).post("/api/ledger/mint").send({ to: ALICE, amount: 100 });
      log((await partyBoard(app)).lines.map((l) => `   ${l}`));

      log(["2. Transfer 40  Alice → Bob"]);
      await request(app)
        .post("/api/ledger/transfer")
        .send({ from: ALICE, to: BOB, amount: 40 });
      log((await partyBoard(app)).lines.map((l) => `   ${l}`));

      log(["3. Transfer 15  Bob → Charlie"]);
      await request(app)
        .post("/api/ledger/transfer")
        .send({ from: BOB, to: CHARLIE, amount: 15 });

      const board = await partyBoard(app);
      log([
        "4. Final party board:",
        ...board.lines.map((l) => `   ${l}`),
        "Activity:",
        "   Minted 100 RVT to Alice",
        "   Alice → Bob: 40",
        "   Bob → Charlie: 15",
      ]);

      assert.equal(board.alice, 60);
      assert.equal(board.bob, 25);
      assert.equal(board.charlie, 15);
      assert.equal(board.supply, 100);
    });
  });
});
