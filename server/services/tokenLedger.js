function normalizeAddress(address) {
  if (address == null || String(address).trim() === "") {
    throw new Error("Invalid address");
  }
  return String(address).trim().toLowerCase();
}

function normalizeAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid amount");
  }
  return value;
}

function createTokenLedger() {
  const balances = new Map();
  let totalSupply = 0;

  return {
    name: "RentVerse Token",
    symbol: "RVT",

    getInfo() {
      return {
        name: this.name,
        symbol: this.symbol,
        totalSupply,
      };
    },

    balanceOf(address) {
      const key = normalizeAddress(address);
      return balances.get(key) || 0;
    },

    mint(to, amount) {
      const recipient = normalizeAddress(to);
      const value = normalizeAmount(amount);
      const nextBalance = (balances.get(recipient) || 0) + value;
      balances.set(recipient, nextBalance);
      totalSupply += value;
      return { to: recipient, amount: value, balance: nextBalance };
    },

    transfer(from, to, amount) {
      const sender = normalizeAddress(from);
      const recipient = normalizeAddress(to);
      const value = normalizeAmount(amount);
      const senderBalance = balances.get(sender) || 0;

      if (senderBalance < value) {
        throw new Error("Insufficient balance");
      }

      const fromBalance = senderBalance - value;
      const toBalance = (balances.get(recipient) || 0) + value;
      balances.set(sender, fromBalance);
      balances.set(recipient, toBalance);

      return { from: sender, to: recipient, amount: value, fromBalance, toBalance };
    },

    reset() {
      balances.clear();
      totalSupply = 0;
    },
  };
}

const tokenLedger = createTokenLedger();

module.exports = tokenLedger;
module.exports.createTokenLedger = createTokenLedger;
