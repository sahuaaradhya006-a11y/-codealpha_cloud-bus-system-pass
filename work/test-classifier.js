const fs = require("fs");

const html = fs.readFileSync("outputs/chatbot-prototype.html", "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1]
  .replace(/renderTrainingSummary\(\);\s*runQualityTests\(\);\s*initializeChat\(\);/, "");

global.document = {
  querySelectorAll: () => [],
  querySelector: () => ({
    addEventListener() {},
    innerHTML: "",
    textContent: "",
    appendChild() {},
    focus() {}
  }),
  createElement: () => ({
    className: "",
    textContent: "",
    appendChild() {},
    addEventListener() {},
    style: {}
  })
};

eval(`${script}
const __results = tests.map((test) => {
  const actual = classify(test.query).id;
  return { query: test.query, expected: test.expected, actual, pass: actual === test.expected };
});
console.table(__results);
if (__results.some((result) => !result.pass)) {
  throw new Error("classifier tests failed");
}
`);
