const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { createTokenLedger } = require("./tokenLedger");

const ALICE = "alice";
const BOB = "bob";
const CHARLIE = "charlie";

function log(lines) {
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

function board(ledger) {
  return [
    `Alice    ${ledger.balanceOf(ALICE)} RVT`,
    `Bob      ${ledger.balanceOf(BOB)} RVT`,
    `Charlie  ${ledger.balanceOf(CHARLIE)} RVT`,
    `Supply   ${ledger.getInfo().totalSupply} RVT`,
  ];
}

describe("TokenLedger — multi-party contract simulation", () => {
  let ledger;

  beforeEach(() => {
    ledger = createTokenLedger();
  });

  describe("1. Fresh ledger (page mount)", () => {
    it("shows RentVerse Token / RVT with empty supply", () => {
      const info = ledger.getInfo();

      log([
        "Step: load token header",
        `  name:   ${info.name}`,
        `  symbol: ${info.symbol}`,
        `  supply: ${info.totalSupply}`,
      ]);

      assert.deepEqual(info, {
        name: "RentVerse Token",
        symbol: "RVT",
        totalSupply: 0,
      });
    });

    it("party board starts at zero for Alice, Bob, Charlie", () => {
      log(["Step: load party balances", ...board(ledger).map((l) => `  ${l}`)]);

      assert.equal(ledger.balanceOf(ALICE), 0);
      assert.equal(ledger.balanceOf(BOB), 0);
      assert.equal(ledger.balanceOf(CHARLIE), 0);
    });
  });

  describe("2. Select Alice → Mint", () => {
    it("mints 100 RVT to Alice and bumps total supply", () => {
      log(["Step: Mint 100 RVT → Alice"]);
      const result = ledger.mint(ALICE, 100);

      log([
        `  result: +${result.amount} to ${result.to} (balance ${result.balance})`,
        "Board after mint:",
        ...board(ledger).map((l) => `  ${l}`),
      ]);

      assert.deepEqual(result, { to: ALICE, amount: 100, balance: 100 });
      assert.equal(ledger.balanceOf(ALICE), 100);
      assert.equal(ledger.getInfo().totalSupply, 100);
    });

    it("second mint to Alice accumulates (50 + 25 = 75)", () => {
      log(["Step: Mint 50, then 25 → Alice"]);
      ledger.mint(ALICE, 50);
      ledger.mint(ALICE, 25);

      log(["Board after both mints:", ...board(ledger).map((l) => `  ${l}`)]);

      assert.equal(ledger.balanceOf(ALICE), 75);
      assert.equal(ledger.getInfo().totalSupply, 75);
    });
  });

  describe("3. Select Alice → Transfer to Bob", () => {
    it("moves 40 RVT Alice → Bob; supply unchanged", () => {
      ledger.mint(ALICE, 100);
      log([
        "Step: Transfer 40 RVT  Alice → Bob",
        "Board before:",
        ...board(ledger).map((l) => `  ${l}`),
      ]);

      const result = ledger.transfer(ALICE, BOB, 40);

      log([
        `  result: ${result.from} → ${result.to}: ${result.amount}`,
        `  Alice now ${result.fromBalance}, Bob now ${result.toBalance}`,
        "Board after:",
        ...board(ledger).map((l) => `  ${l}`),
      ]);

      assert.deepEqual(result, {
        from: ALICE,
        to: BOB,
        amount: 40,
        fromBalance: 60,
        toBalance: 40,
      });
      assert.equal(ledger.balanceOf(ALICE), 60);
      assert.equal(ledger.balanceOf(BOB), 40);
      assert.equal(ledger.getInfo().totalSupply, 100);
    });

    it("can then send Bob → Charlie (multi-party hop)", () => {
      ledger.mint(ALICE, 100);
      ledger.transfer(ALICE, BOB, 40);
      log(["Step: Transfer 15 RVT  Bob → Charlie"]);

      ledger.transfer(BOB, CHARLIE, 15);

      log(["Board after hop:", ...board(ledger).map((l) => `  ${l}`)]);

      assert.equal(ledger.balanceOf(ALICE), 60);
      assert.equal(ledger.balanceOf(BOB), 25);
      assert.equal(ledger.balanceOf(CHARLIE), 15);
      assert.equal(ledger.getInfo().totalSupply, 100);
    });
  });

  describe("4. Guards (inline error cases)", () => {
    it("rejects mint with empty address or non-positive amount", () => {
      log(["Step: bad mint inputs → expect errors"]);
      assert.throws(() => ledger.mint("", 10), /address/i);
      assert.throws(() => ledger.mint(null, 10), /address/i);
      assert.throws(() => ledger.mint(ALICE, 0), /amount/i);
      assert.throws(() => ledger.mint(ALICE, -5), /amount/i);
      log(["  ok — invalid mint blocked"]);
    });

    it("rejects transfer when Alice has insufficient balance", () => {
      ledger.mint(ALICE, 10);
      log([
        "Step: Alice has 10, tries to send 11 → Bob",
        "  expect: insufficient balance",
      ]);
      assert.throws(() => ledger.transfer(ALICE, BOB, 11), /insufficient/i);
      log(["  ok — transfer blocked; board unchanged:", ...board(ledger).map((l) => `  ${l}`)]);
    });

    it("rejects transfer with missing parties or zero amount", () => {
      ledger.mint(ALICE, 10);
      assert.throws(() => ledger.transfer("", BOB, 5), /address/i);
      assert.throws(() => ledger.transfer(ALICE, "", 5), /address/i);
      assert.throws(() => ledger.transfer(ALICE, BOB, 0), /amount/i);
      log(["  ok — malformed transfer blocked"]);
    });

    it("treats Alice / ALICE as the same party", () => {
      log(["Step: mint to 'Alice', read as 'ALICE' / 'alice'"]);
      ledger.mint("Alice", 10);
      assert.equal(ledger.balanceOf("ALICE"), 10);
      assert.equal(ledger.balanceOf(ALICE), 10);
      log(["  ok — address casing normalized"]);
    });
  });
});
