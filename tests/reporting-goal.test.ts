import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { campaignReportingOutcome, totalReportingOutcome, usesTrafficGoal } from "../lib/reporting-goal.ts";

const trafficRoles = { primary: ["spend", "clicks", "cpc"], secondary: ["impressions", "frequency"] };
const leadRoles = { primary: ["leads", "cpl", "spend"], secondary: ["clicks", "cpc"] };

test("uses link clicks as the result when traffic KPIs are primary", () => {
  assert.equal(usesTrafficGoal(trafficRoles), true);
  assert.deepEqual(
    campaignReportingOutcome(
      { objective: "15-second ThruPlays", spend: 4469.15, results: 32986, cost: 0.135, clicks: 21731 },
      trafficRoles,
    ),
    { label: "Link clicks", results: 21731, cost: 4469.15 / 21731 },
  );
});

test("keeps Meta's reported result when conversion KPIs are primary", () => {
  assert.equal(usesTrafficGoal(leadRoles), false);
  assert.deepEqual(
    campaignReportingOutcome(
      { objective: "Website contacts", spend: 300, results: 30, cost: 10, clicks: 400 },
      leadRoles,
    ),
    { label: "Website contacts", results: 30, cost: 10 },
  );
});

test("uses traffic totals instead of lead totals for a traffic report", () => {
  assert.deepEqual(
    totalReportingOutcome({ clicks: 21731, cpc: 0.21, leads: 0, cpl: 0 }, trafficRoles),
    { label: "Website traffic", results: 21731, cost: 0.21, suffix: "link clicks" },
  );
});
