const express = require("express");
const {
  getLedgerInfo,
  getBalance,
  mintTokens,
  transferTokens,
} = require("../controllers/ledgerController");

const router = express.Router();

router.route("/").get(getLedgerInfo);
router.route("/balance/:address").get(getBalance);
router.route("/mint").post(mintTokens);
router.route("/transfer").post(transferTokens);

module.exports = router;
