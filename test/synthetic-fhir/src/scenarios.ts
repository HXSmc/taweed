import type { DenialReasonCode } from "@taweed/shared";

export const SCENARIOS = [
  "clean",
  "fullDenial",
  "partialDenial",
  "bundledLines",
  "missingPreAuth",
  "multiReason",
  "payerVariantA",
  "payerVariantB",
  "arabicText",
] as const;

export type ScenarioName = (typeof SCENARIOS)[number];

export interface ScenarioSpec {
  lineCount: number;
  hasPreAuth: boolean;
  language: "en" | "ar";
  payer: { id: string; name: string };
  outcome: "complete" | "partial" | "error";
  /** 0-based line index → denial reason codes on that line (absent = accepted). */
  denials: Record<number, DenialReasonCode[]>;
}

const PAYER_DEFAULT = { id: "payer-nphies-0", name: "Placeholder Insurer" };
const PAYER_A = { id: "payer-nphies-A", name: "Placeholder TPA A" };
const PAYER_B = { id: "payer-nphies-B", name: "Placeholder Insurer B" };

export const SCENARIO_SPECS: Record<ScenarioName, ScenarioSpec> = {
  clean: {
    lineCount: 2,
    hasPreAuth: true,
    language: "en",
    payer: PAYER_DEFAULT,
    outcome: "complete",
    denials: {},
  },
  fullDenial: {
    lineCount: 2,
    hasPreAuth: true,
    language: "en",
    payer: PAYER_DEFAULT,
    outcome: "error",
    denials: { 0: ["TWD-D01"], 1: ["TWD-D05"] },
  },
  partialDenial: {
    lineCount: 3,
    hasPreAuth: true,
    language: "en",
    payer: PAYER_DEFAULT,
    outcome: "partial",
    denials: { 1: ["TWD-D03"] },
  },
  bundledLines: {
    lineCount: 4,
    hasPreAuth: true,
    language: "en",
    payer: PAYER_DEFAULT,
    outcome: "partial",
    denials: { 2: ["TWD-D07"] },
  },
  missingPreAuth: {
    lineCount: 2,
    hasPreAuth: false,
    language: "en",
    payer: PAYER_DEFAULT,
    outcome: "partial",
    denials: { 0: ["TWD-D02"] },
  },
  multiReason: {
    lineCount: 2,
    hasPreAuth: true,
    language: "en",
    payer: PAYER_DEFAULT,
    outcome: "partial",
    denials: { 0: ["TWD-D03", "TWD-D06"] },
  },
  payerVariantA: {
    lineCount: 2,
    hasPreAuth: true,
    language: "en",
    payer: PAYER_A,
    outcome: "partial",
    denials: { 0: ["TWD-D04"] },
  },
  payerVariantB: {
    lineCount: 2,
    hasPreAuth: true,
    language: "en",
    payer: PAYER_B,
    outcome: "partial",
    denials: { 0: ["TWD-D04"] },
  },
  arabicText: {
    lineCount: 2,
    hasPreAuth: true,
    language: "ar",
    payer: PAYER_DEFAULT,
    outcome: "partial",
    denials: { 0: ["TWD-D06"] },
  },
};
