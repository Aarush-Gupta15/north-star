/*
 * North Star — compliance detection test suite.
 * 30 synthetic cases (fictional data): 10 GDPR-oriented, 10 DPDP-oriented,
 * 10 mixed. Each case lists expected data types; a case PASSES when every
 * expected item is detected (each expected item may accept any-of a type set).
 * Run:  node tests/compliance.test.js
 */
const fs = require("fs");
const path = require("path");

const g = {};
new Function("self", fs.readFileSync(path.join(__dirname, "../src/engine.js"), "utf8"))(g);
const NS = g.NorthStarEngine;
NS.setCustomRules({});

// each `expect` entry is an array of acceptable types (any-of must be present)
const CASES = {
  "GDPR (EU / UK)": [
    { t: "Emma Williams, born on 14 August 1992, email emma.w@example.test, phone +44 7700 900123.",
      expect: [["DOB"], ["EMAIL_ADDRESS"], ["PHONE_NUMBER"]] },
    { t: "Please process the refund to IBAN DE89370400440532013000; contact hans@example.test.",
      expect: [["IBAN"], ["EMAIL_ADDRESS"]] },
    { t: "The patient was diagnosed with asthma and has blood type O+.",
      expect: [["MEDICAL"]] },
    { t: "Last login came from IP 203.0.113.42 on device MAC 00:1A:2B:3C:4D:5E.",
      expect: [["IP_ADDRESS"], ["MAC_ADDRESS"]] },
    { t: "Payment card 4111 1111 1111 1111, CVV 123, Expiry: 09/30.",
      expect: [["CREDIT_CARD"], ["CVV"], ["CARD_EXPIRY"]] },
    { t: "Employee ID is EMP-88412, reachable at j.doe@example.test or +44 20 7946 0018.",
      expect: [["EMPLOYEE_ID"], ["EMAIL_ADDRESS"], ["PHONE_NUMBER"]] },
    { t: "Home address: Flat 12, Riverside Towers, postcode M1 1AA.",
      expect: [["ADDRESS"], ["POSTAL_CODE"]] },
    { t: "Login password is Tr0ub4dour&3 and the api key is sk-abc123DEF456ghi789xyz.",
      expect: [["PASSWORD"], ["SECRET", "API_SECRET_KEY"]] },
    { t: "Customer ID is CUST-100245, date of birth 12/08/1990.",
      expect: [["CUSTOMER_ID"], ["DOB"]] },
    { t: "US national with SSN 123-45-6789, email traveler@example.test.",
      expect: [["US_SSN"], ["EMAIL_ADDRESS"]] },
  ],

  "DPDP (India)": [
    { t: "His Aadhaar number is 234123456783.",
      expect: [["IN_AADHAAR"]] },
    { t: "PAN for tax filing: ABCDE1234F.",
      expect: [["IN_PAN"]] },
    { t: "Company GSTIN is 22ABCDE1234F1Z5.",
      expect: [["IN_GSTIN"]] },
    { t: "Bank Account Number: 9876543210123456, IFSC: HDFC0001234.",
      expect: [["BANK_ACCOUNT", "CREDIT_CARD"], ["IN_IFSC"]] },
    { t: "Send it to my UPI ID rohan@okhdfcbank please.",
      expect: [["UPI_ID"]] },
    { t: "Call me on +91 90123 45678 or email rohan@example.test.",
      expect: [["PHONE_NUMBER"], ["EMAIL_ADDRESS"]] },
    { t: "Voter ID card number ABC1234567 submitted.",
      expect: [["IN_VOTER_ID"]] },
    { t: "Residence: Flat 1204, Lotus Heights, Sector 62.",
      expect: [["ADDRESS"]] },
    { t: "aadhaar card 2341 2345 6783 and pan ABCDE1234F on record.",
      expect: [["IN_AADHAAR"], ["IN_PAN"]] },
    { t: "Employee EMP-55012 has declared a peanut allergy.",
      expect: [["EMPLOYEE_ID"], ["MEDICAL"]] },
  ],

  "BOTH (mixed)": [
    { t: "Priya Sharma, Aadhaar 234123456783, lives at postcode M1 1AA, phone +44 7700 900123.",
      expect: [["IN_AADHAAR"], ["POSTAL_CODE"], ["PHONE_NUMBER"]] },
    { t: "Card 4111 1111 1111 1111 linked to Aadhaar 234123456783, email a@example.test.",
      expect: [["CREDIT_CARD"], ["IN_AADHAAR"], ["EMAIL_ADDRESS"]] },
    { t: "Refund via IBAN DE89370400440532013000 or IFSC HDFC0001234.",
      expect: [["IBAN"], ["IN_IFSC"]] },
    { t: "PAN ABCDE1234F for India, SSN 123-45-6789 for the US branch.",
      expect: [["IN_PAN"], ["US_SSN"]] },
    { t: "Patient diagnosed with diabetes; card 4111 1111 1111 1111; call +91 90123 45678.",
      expect: [["MEDICAL"], ["CREDIT_CARD"], ["PHONE_NUMBER"]] },
    { t: "Crypto wallet 0x1234567890abcdef1234567890abcdef12345678, email crypto@example.test.",
      expect: [["CRYPTO_ETH"], ["EMAIL_ADDRESS"]] },
    { t: "Employee ID EMP-88412, PAN ABCDE1234F, password is P@ssw0rd!2024.",
      expect: [["EMPLOYEE_ID"], ["IN_PAN"], ["PASSWORD"]] },
    { t: "Customer ID CUST-100245, Aadhaar 234123456783, address Flat 1204, Lotus Heights.",
      expect: [["CUSTOMER_ID"], ["IN_AADHAAR"], ["ADDRESS"]] },
    { t: "GSTIN 22ABCDE1234F1Z5, IBAN DE89370400440532013000, phone +44 7700 900123.",
      expect: [["IN_GSTIN"], ["IBAN"], ["PHONE_NUMBER"]] },
    { t: "Emma Williams born on 14 August 1992, Aadhaar 234123456783, card 4111 1111 1111 1111, CVV 123, Expiry 09/30, email emma@example.test, phone +91 90123 45678, blood type O+.",
      expect: [["DOB"], ["IN_AADHAAR"], ["CREDIT_CARD"], ["CVV"], ["CARD_EXPIRY"], ["EMAIL_ADDRESS"], ["PHONE_NUMBER"], ["MEDICAL"]] },
  ],
};

let total = 0, passed = 0;
const groupStats = {};
for (const [group, cases] of Object.entries(CASES)) {
  console.log("\n=== " + group + " (" + cases.length + ") ===");
  let gp = 0;
  cases.forEach((c, i) => {
    total++;
    const found = NS.detect(c.t).map((e) => e.type);
    const missing = c.expect.filter((set) => !set.some((ty) => found.includes(ty)));
    const ok = missing.length === 0;
    if (ok) { passed++; gp++; }
    const n = String(i + 1).padStart(2, " ");
    console.log(`  ${ok ? "PASS" : "FAIL"}  #${n}  detected: ${[...new Set(found)].join(", ") || "—"}`);
    if (!ok) console.log(`         MISSING: ${missing.map((s) => s.join("/")).join(", ")}`);
  });
  groupStats[group] = gp + "/" + cases.length;
}

console.log("\n──────── SUMMARY ────────");
for (const [g2, s] of Object.entries(groupStats)) console.log("  " + g2.padEnd(18) + s);
console.log("  " + "TOTAL".padEnd(18) + passed + "/" + total);
process.exit(passed === total ? 0 : 1);
