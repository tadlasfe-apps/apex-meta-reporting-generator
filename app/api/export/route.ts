import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageBreak,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

export const runtime = "nodejs";

// Explicit DXA widths keep Word, LibreOffice, and Quick Look table layouts consistent.

type Campaign = { name: string; objective: string; spend: number; results: number; cost: number; clicks: number; impressions: number; ctr: number; frequency: number; status: string };
type Draft = { summary: string; changes: string[]; spotlightTitle: string; spotlight: string[]; recommendations: { priority: string; title: string; body: string }[]; plan: { action: string; priority: string; impact: string }[]; internal: { title: string; items: string[] }[] };
type Payload = { account: { name: string; location: string; reportMonth: string; dateRange: string; logoDataUrl: string; campaigns: Campaign[]; draft: Draft }; metrics: { spend: number; impressions: number; clicks: number; leads: number; cpl: number; videoViews: number; cpc: number; linkRate: number; frequency: number }; agencyLogo: string; view: string };

const GREEN = "58BD3B";
const DEEP_GREEN = "2F7628";
const PALE = "EDF7E9";
const GRAY = "727272";
const INK = "171717";
const PAGE_WIDTH = 9360;
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

const money = (value: number, digits = 2) =>
  value ? "$" + value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "-";
const num = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });

function imageData(dataUrl: string) {
  if (!dataUrl?.startsWith("data:")) return null;
  const [head, encoded] = dataUrl.split(",", 2);
  const raw = atob(encoded);
  const data = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) data[index] = raw.charCodeAt(index);
  return { data, type: (head.includes("jpeg") ? "jpg" : "png") as "png" | "jpg" };
}

function textParagraph(text: string, options: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) {
  return new Paragraph({
    alignment: options.align,
    spacing: { before: options.before ?? 0, after: options.after ?? 0, line: 240 },
    children: [new TextRun({ text, bold: options.bold, size: options.size ?? 18, color: options.color ?? INK, font: "Arial" })],
  });
}

function tableCell(
  lines: { text: string; bold?: boolean; size?: number; color?: string }[],
  width: number,
  fill?: string,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 110, bottom: 110, left: 120, right: 120 },
    children: lines.map((line, index) =>
      textParagraph(line.text, {
        bold: line.bold,
        size: line.size,
        color: line.color ?? (fill === GREEN ? "FFFFFF" : INK),
        align,
        after: index === lines.length - 1 ? 0 : 40,
      }),
    ),
  });
}

function fixedTable(widths: number[], rows: TableRow[], borders: typeof noBorders | undefined = undefined) {
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows,
  });
}

const label = (text: string) =>
  new Paragraph({
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: GRAY, characterSpacing: 25, size: 18, font: "Arial" })],
  });

const bullet = (text: string) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 90, line: 270 },
    children: [new TextRun({ text, size: 20, font: "Arial" })],
  });

const pageTitle = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 60, after: 160 },
    border: { bottom: { color: GREEN, style: BorderStyle.SINGLE, size: 18, space: 8 } },
    children: [new TextRun({ text, bold: true, color: INK, size: 34, font: "Arial" })],
  });

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const rawPayload = form.get("payload");
    if (!rawPayload) return Response.json({ error: "Missing report payload" }, { status: 400 });

    const payload = JSON.parse(String(rawPayload)) as Payload;
    const account = payload.account;
    const draft = account.draft;
    const metrics = payload.metrics;
    const clientLogo = imageData(account.logoDataUrl);
    const agencyLogo = imageData(payload.agencyLogo);

    const children: (Paragraph | Table)[] = [
      fixedTable(
        [4680, 4680],
        [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4680, type: WidthType.DXA },
                borders: noBorders,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  new Paragraph({
                    children: clientLogo
                      ? [new ImageRun({ data: clientLogo.data, type: clientLogo.type, transformation: { width: 175, height: 52 } })]
                      : [new TextRun({ text: account.name, bold: true, size: 21, font: "Arial" })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 4680, type: WidthType.DXA },
                borders: noBorders,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                  textParagraph("META ADS REPORT", { bold: true, color: GRAY, size: 22, align: AlignmentType.RIGHT, after: 45 }),
                  textParagraph(account.dateRange.toUpperCase(), { color: "999999", size: 16, align: AlignmentType.RIGHT }),
                ],
              }),
            ],
          }),
        ],
        noBorders,
      ),
      textParagraph(account.name, { bold: true, size: 38, before: 150, after: 35 }),
      textParagraph("Monthly performance report · " + account.location, { color: GRAY, size: 18, after: 110 }),
      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [PAGE_WIDTH],
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: PAGE_WIDTH, type: WidthType.DXA },
                shading: { fill: PALE, type: ShadingType.CLEAR },
                borders: { ...noBorders, left: { color: GREEN, style: BorderStyle.SINGLE, size: 22, space: 0 } },
                margins: { top: 150, bottom: 150, left: 180, right: 180 },
                children: [textParagraph(draft.summary, { size: 20 })],
              }),
            ],
          }),
        ],
      }),
      label("Primary KPIs"),
      fixedTable(
        [3120, 3120, 3120],
        [
          new TableRow({
            cantSplit: true,
            children: [
              tableCell([{ text: "LEADS / CONTACTS", bold: true, size: 17 }, { text: num(metrics.leads), bold: true, size: 30 }, { text: "Tracked by Meta", size: 16, color: GRAY }], 3120, PALE),
              tableCell([{ text: "COST PER LEAD", bold: true, size: 17 }, { text: money(metrics.cpl), bold: true, size: 30 }, { text: "Lead-producing campaigns", size: 16, color: GRAY }], 3120, PALE),
              tableCell([{ text: "TOTAL SPEND", bold: true, size: 17 }, { text: money(metrics.spend), bold: true, size: 30 }, { text: account.campaigns.length + " campaign rows", size: 16, color: GRAY }], 3120, PALE),
            ],
          }),
        ],
      ),
      label("Secondary KPIs"),
      fixedTable(
        [1872, 1872, 1872, 1872, 1872],
        [
          new TableRow({
            cantSplit: true,
            children: [
              tableCell([{ text: "IMPRESSIONS", bold: true, size: 15 }, { text: num(metrics.impressions), bold: true, size: 22 }], 1872),
              tableCell([{ text: "LINK CLICKS", bold: true, size: 15 }, { text: num(metrics.clicks), bold: true, size: 22 }], 1872),
              tableCell([{ text: "COST / LINK CLICK", bold: true, size: 15 }, { text: money(metrics.cpc), bold: true, size: 22 }], 1872),
              tableCell([{ text: "VIDEO RESULTS", bold: true, size: 15 }, { text: num(metrics.videoViews), bold: true, size: 22 }], 1872),
              tableCell([{ text: "FREQUENCY", bold: true, size: 15 }, { text: metrics.frequency.toFixed(2), bold: true, size: 22 }], 1872),
            ],
          }),
        ],
      ),
      label("Campaign breakdown"),
      fixedTable(
        [2860, 2100, 1450, 1350, 1600],
        [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              tableCell([{ text: "CAMPAIGN", bold: true, size: 15 }], 2860, GREEN),
              tableCell([{ text: "RESULT TYPE", bold: true, size: 15 }], 2100, GREEN),
              tableCell([{ text: "SPEND", bold: true, size: 15 }], 1450, GREEN, AlignmentType.RIGHT),
              tableCell([{ text: "RESULTS", bold: true, size: 15 }], 1350, GREEN, AlignmentType.RIGHT),
              tableCell([{ text: "COST / RESULT", bold: true, size: 15 }], 1600, GREEN, AlignmentType.RIGHT),
            ],
          }),
          ...account.campaigns.map(
            (campaign) =>
              new TableRow({
                cantSplit: true,
                children: [
                  tableCell([{ text: campaign.name, bold: true, size: 16 }, { text: campaign.status, size: 14, color: GRAY }], 2860),
                  tableCell([{ text: campaign.objective, size: 16 }], 2100),
                  tableCell([{ text: money(campaign.spend), size: 16 }], 1450, undefined, AlignmentType.RIGHT),
                  tableCell([{ text: campaign.results ? num(campaign.results) : "-", size: 16 }], 1350, undefined, AlignmentType.RIGHT),
                  tableCell([{ text: money(campaign.cost, campaign.cost < 1 ? 3 : 2), size: 16 }], 1600, undefined, AlignmentType.RIGHT),
                ],
              }),
          ),
        ],
      ),
      new Paragraph({ children: [new PageBreak()] }),
      pageTitle("Changes Made This Period"),
      label("What changed and why it matters"),
      ...draft.changes.map(
        (item) =>
          new Paragraph({
            numbering: { reference: "changes", level: 0 },
            spacing: { after: 110, line: 270 },
            children: [new TextRun({ text: item, size: 20, font: "Arial" })],
          }),
      ),
      label("Results spotlight"),
      new Table({
        width: { size: PAGE_WIDTH, type: WidthType.DXA },
        columnWidths: [PAGE_WIDTH],
        borders: noBorders,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: PAGE_WIDTH, type: WidthType.DXA },
                shading: { fill: PALE, type: ShadingType.CLEAR },
                borders: { ...noBorders, left: { color: GREEN, style: BorderStyle.SINGLE, size: 22, space: 0 } },
                margins: { top: 150, bottom: 150, left: 180, right: 180 },
                children: [
                  textParagraph(draft.spotlightTitle, { bold: true, color: DEEP_GREEN, size: 21, after: 90 }),
                  ...draft.spotlight.map((item) => bullet(item)),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ children: [new PageBreak()] }),
      pageTitle("Suggestions & Next Steps"),
      label("Suggestions for next period"),
      ...draft.recommendations.flatMap((recommendation) => [
        textParagraph(recommendation.priority, { bold: true, color: recommendation.priority.includes("HIGH") ? "B86E12" : DEEP_GREEN, size: 16, before: 100, after: 35 }),
        textParagraph(recommendation.title, { bold: true, size: 23, after: 35 }),
        textParagraph(recommendation.body, { size: 19, after: 90 }),
      ]),
      label("Next period plan"),
      fixedTable(
        [4300, 1400, 3660],
        [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            children: [
              tableCell([{ text: "ACTION ITEM", bold: true, size: 15 }], 4300, GREEN),
              tableCell([{ text: "PRIORITY", bold: true, size: 15 }], 1400, GREEN),
              tableCell([{ text: "EXPECTED IMPACT", bold: true, size: 15 }], 3660, GREEN),
            ],
          }),
          ...draft.plan.map(
            (item) =>
              new TableRow({
                cantSplit: true,
                children: [
                  tableCell([{ text: item.action, bold: true, size: 16 }], 4300),
                  tableCell([{ text: item.priority, size: 16 }], 1400),
                  tableCell([{ text: item.impact, size: 16 }], 3660),
                ],
              }),
          ),
        ],
      ),
    ];

    if (payload.view === "internal") {
      children.push(
        new Paragraph({ children: [new PageBreak()] }),
        pageTitle("Internal Notes & Follow-Up"),
        ...draft.internal.flatMap((section) => [label(section.title), ...section.items.map(bullet)]),
      );
    }

    const footer = fixedTable(
      [1800, 7560],
      [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 1800, type: WidthType.DXA },
              borders: noBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: agencyLogo
                    ? [new ImageRun({ data: agencyLogo.data, type: agencyLogo.type, transformation: { width: 62, height: 20 } })]
                    : [],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7560, type: WidthType.DXA },
              borders: noBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                textParagraph("Prepared for " + account.name + " · " + account.reportMonth, { color: "999999", size: 14, align: AlignmentType.RIGHT }),
              ],
            }),
          ],
        }),
      ],
      noBorders,
    );

    const document = new Document({
      numbering: {
        config: [
          {
            reference: "changes",
            levels: [
              {
                level: 0,
                format: "decimal",
                text: "%1",
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 400, hanging: 220 } } },
              },
            ],
          },
        ],
      },
      styles: {
        default: {
          document: {
            run: { font: "Arial", size: 20 },
            paragraph: { spacing: { line: 270 } },
          },
        },
      },
      sections: [
        {
          properties: { page: { margin: { top: 720, right: 1440, bottom: 720, left: 1440 } } },
          footers: { default: new Footer({ children: [footer] }) },
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(document);
    const safeName = account.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
    const fileName = safeName + "_" + account.reportMonth.replace(/\s+/g, "_") + "_Meta_Report" + (payload.view === "internal" ? "_AM" : "") + ".docx";

    return new Response(blob, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="' + fileName + '"',
      },
    });
  } catch (error) {
    console.error("Word export failed", error);
    return Response.json({ error: "Failed to generate Word report" }, { status: 500 });
  }
}
