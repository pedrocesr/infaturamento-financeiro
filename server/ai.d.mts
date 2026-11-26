import type { IncomingMessage, ServerResponse } from 'node:http';

type Options = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export type FinancialSummary = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  pendingCents: number;
  categories: {
    name: string;
    spentCents: number;
    limitCents: number;
  }[];
};

export type FinancialReport = {
  summary: string;
  tips: {
    title: string;
    category: string;
    reason: string;
    action: string;
  }[];
  provider: string;
  model: string;
  generatedAt: string;
  month: string;
};

export function validateSummary(value: unknown): FinancialSummary;

export function generateReport(
  summary: FinancialSummary,
  options: Options
): Promise<FinancialReport>;

export function createAiMiddleware(
  options: Options
): (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void
) => Promise<void>;