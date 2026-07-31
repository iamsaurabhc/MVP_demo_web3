const asyncErrorHandler = require("../middlewares/helpers/asyncErrorHandler");
const ErrorHandler = require("../utils/errorHandler");
const tokenLedger = require("../services/tokenLedger");

function runLedger(fn) {
  try {
    return fn();
  } catch (err) {
    throw new ErrorHandler(err.message, 400);
  }
}

exports.getLedgerInfo = asyncErrorHandler(async (req, res) => {
  const info = tokenLedger.getInfo();
  res.status(200).json({
    success: true,
    ...info,
  });
});

exports.getBalance = asyncErrorHandler(async (req, res) => {
  const address = String(req.params.address || "").toLowerCase();
  const balance = runLedger(() => tokenLedger.balanceOf(address));
  res.status(200).json({
    success: true,
    address,
    balance,
  });
});

exports.mintTokens = asyncErrorHandler(async (req, res) => {
  const { to, amount } = req.body;
  const result = runLedger(() => tokenLedger.mint(to, amount));
  res.status(200).json({
    success: true,
    ...result,
  });
});

exports.transferTokens = asyncErrorHandler(async (req, res) => {
  const { from, to, amount } = req.body;
  const result = runLedger(() => tokenLedger.transfer(from, to, amount));
  res.status(200).json({
    success: true,
    ...result,
  });
});
