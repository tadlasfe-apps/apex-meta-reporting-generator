export type ReportingRoles = { primary: string[]; secondary: string[] };

export type ReportingCampaign = {
  objective: string;
  spend: number;
  results: number;
  cost: number;
  clicks: number;
};

export type ReportingMetrics = {
  clicks: number;
  cpc: number;
  leads: number;
  cpl: number;
};

export function usesTrafficGoal(roles: ReportingRoles) {
  const trafficIsPrimary = roles.primary.includes("clicks") || roles.primary.includes("cpc");
  const conversionIsPrimary = roles.primary.includes("leads") || roles.primary.includes("cpl");
  return trafficIsPrimary && !conversionIsPrimary;
}

export function campaignReportingOutcome(campaign: ReportingCampaign, roles: ReportingRoles) {
  if (usesTrafficGoal(roles)) {
    return {
      label: "Link clicks",
      results: campaign.clicks,
      cost: campaign.clicks ? campaign.spend / campaign.clicks : 0,
    };
  }

  return { label: campaign.objective, results: campaign.results, cost: campaign.cost };
}

export function totalReportingOutcome(metrics: ReportingMetrics, roles: ReportingRoles) {
  if (usesTrafficGoal(roles)) {
    return { label: "Website traffic", results: metrics.clicks, cost: metrics.cpc, suffix: "link clicks" };
  }

  const leadsAreVisible = [...roles.primary, ...roles.secondary].includes("leads");
  return leadsAreVisible
    ? { label: "Lead generation", results: metrics.leads, cost: metrics.cpl, suffix: "leads" }
    : { label: "Mixed results", results: 0, cost: 0, suffix: "" };
}
