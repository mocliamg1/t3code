import {
  ApprovalRequestId,
  type OrchestrationLatestTurn,
  type OrchestrationThreadActivity,
  type OrchestrationProposedPlanId,
  type ProviderKind,
  type UserInputQuestion,
  type TurnId,
} from "@t3tools/contracts";

import type {
  ChatMessage,
  ProposedPlan,
  SessionPhase,
  ThreadSession,
  TurnDiffSummary,
} from "./types";

export type ProviderPickerKind = ProviderKind | "claudeCode" | "cursor";

export const PROVIDER_OPTIONS: Array<{
  value: ProviderPickerKind;
  label: string;
  available: boolean;
}> = [
  { value: "codex", label: "Codex", available: true },
  { value: "claudeCode", label: "Claude Code", available: false },
  { value: "cursor", label: "Cursor", available: false },
];

export interface WorkLogEntry {
  id: string;
  createdAt: string;
  label: string;
  detail?: string;
  command?: string;
  changedFiles?: ReadonlyArray<string>;
  tone: "thinking" | "tool" | "info" | "error";
}

export interface PendingApproval {
  requestId: ApprovalRequestId;
  requestKind: "command" | "file-read" | "file-change";
  createdAt: string;
  detail?: string;
}

export interface PendingUserInput {
  requestId: ApprovalRequestId;
  createdAt: string;
  questions: ReadonlyArray<UserInputQuestion>;
}

export interface ActivePlanState {
  createdAt: string;
  turnId: TurnId | null;
  explanation?: string | null;
  steps: Array<{
    step: string;
    status: "pending" | "inProgress" | "completed";
  }>;
}

export interface LatestProposedPlanState {
  id: OrchestrationProposedPlanId;
  createdAt: string;
  updatedAt: string;
  turnId: TurnId | null;
  planMarkdown: string;
}

export interface TokenUsageBreakdown {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export interface ThreadTelemetryContext {
  total: TokenUsageBreakdown;
  last: TokenUsageBreakdown;
  modelContextWindow: number;
  contextUsedTokens: number | null;
  contextRemainingTokens: number | null;
  contextUsedPercent: number | null;
  contextRemainingPercent: number | null;
}

export interface ThreadTelemetryRateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface ThreadTelemetryRateLimits {
  limitId: string | null;
  limitName: string | null;
  primary: ThreadTelemetryRateLimitWindow | null;
  secondary: ThreadTelemetryRateLimitWindow | null;
  planType: string | null;
}

export interface ThreadTelemetryContextDisplay {
  usedTokens: number;
  remainingTokens: number;
  usedPercent: number;
  remainingPercent: number;
  modelContextWindow: number;
  lastTurnTotalTokens: number;
  lastTurnInputTokens: number;
  lastTurnCachedInputTokens: number;
  lastTurnOutputTokens: number;
  lastTurnReasoningOutputTokens: number;
}

export interface ThreadTelemetryRateLimitWindowDisplay {
  label: string;
  usedPercent: number;
  remainingPercent: number;
  resetTimeLabel: string | null;
  available: boolean;
}

export interface ThreadTelemetryRateLimitDisplay {
  primary: ThreadTelemetryRateLimitWindowDisplay;
  secondary: ThreadTelemetryRateLimitWindowDisplay;
}

export interface ThreadTelemetry {
  context: ThreadTelemetryContext | null;
  rateLimits: ThreadTelemetryRateLimits | null;
  contextDisplay: ThreadTelemetryContextDisplay | null;
  rateLimitDisplay: ThreadTelemetryRateLimitDisplay | null;
}

export type TimelineEntry =
  | {
      id: string;
      kind: "message";
      createdAt: string;
      message: ChatMessage;
    }
  | {
      id: string;
      kind: "proposed-plan";
      createdAt: string;
      proposedPlan: ProposedPlan;
    }
  | {
      id: string;
      kind: "work";
      createdAt: string;
      entry: WorkLogEntry;
    };

export function formatTimestamp(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(isoDate));
}

export function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "0ms";
  if (durationMs < 1_000) return `${Math.max(1, Math.round(durationMs))}ms`;
  if (durationMs < 10_000) return `${(durationMs / 1_000).toFixed(1)}s`;
  if (durationMs < 60_000) return `${Math.round(durationMs / 1_000)}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  if (seconds === 0) return `${minutes}m`;
  if (seconds === 60) return `${minutes + 1}m`;
  return `${minutes}m ${seconds}s`;
}

export function formatElapsed(startIso: string, endIso: string | undefined): string | null {
  if (!endIso) return null;
  const startedAt = Date.parse(startIso);
  const endedAt = Date.parse(endIso);
  if (Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt < startedAt) {
    return null;
  }
  return formatDuration(endedAt - startedAt);
}

type LatestTurnTiming = Pick<OrchestrationLatestTurn, "turnId" | "startedAt" | "completedAt">;
type SessionActivityState = Pick<ThreadSession, "orchestrationStatus" | "activeTurnId">;

export function isLatestTurnSettled(
  latestTurn: LatestTurnTiming | null,
  session: SessionActivityState | null,
): boolean {
  if (!latestTurn?.startedAt) return false;
  if (!latestTurn.completedAt) return false;
  if (!session) return true;
  if (session.orchestrationStatus === "running") return false;
  return true;
}

export function deriveActiveWorkStartedAt(
  latestTurn: LatestTurnTiming | null,
  session: SessionActivityState | null,
  sendStartedAt: string | null,
): string | null {
  if (!isLatestTurnSettled(latestTurn, session)) {
    return latestTurn?.startedAt ?? sendStartedAt;
  }
  return sendStartedAt;
}

function requestKindFromRequestType(requestType: unknown): PendingApproval["requestKind"] | null {
  switch (requestType) {
    case "command_execution_approval":
    case "exec_command_approval":
      return "command";
    case "file_read_approval":
      return "file-read";
    case "file_change_approval":
    case "apply_patch_approval":
      return "file-change";
    default:
      return null;
  }
}

export function derivePendingApprovals(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): PendingApproval[] {
  const openByRequestId = new Map<ApprovalRequestId, PendingApproval>();
  const ordered = [...activities].toSorted(compareActivitiesByOrder);

  for (const activity of ordered) {
    const payload =
      activity.payload && typeof activity.payload === "object"
        ? (activity.payload as Record<string, unknown>)
        : null;
    const requestId =
      payload && typeof payload.requestId === "string"
        ? ApprovalRequestId.makeUnsafe(payload.requestId)
        : null;
    const requestKind =
      payload &&
      (payload.requestKind === "command" ||
        payload.requestKind === "file-read" ||
        payload.requestKind === "file-change")
        ? payload.requestKind
        : payload
          ? requestKindFromRequestType(payload.requestType)
          : null;
    const detail = payload && typeof payload.detail === "string" ? payload.detail : undefined;

    if (activity.kind === "approval.requested" && requestId && requestKind) {
      openByRequestId.set(requestId, {
        requestId,
        requestKind,
        createdAt: activity.createdAt,
        ...(detail ? { detail } : {}),
      });
      continue;
    }

    if (activity.kind === "approval.resolved" && requestId) {
      openByRequestId.delete(requestId);
      continue;
    }

    if (
      activity.kind === "provider.approval.respond.failed" &&
      requestId &&
      detail?.includes("Unknown pending permission request")
    ) {
      openByRequestId.delete(requestId);
      continue;
    }
  }

  return [...openByRequestId.values()].toSorted((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function parseUserInputQuestions(
  payload: Record<string, unknown> | null,
): ReadonlyArray<UserInputQuestion> | null {
  const questions = payload?.questions;
  if (!Array.isArray(questions)) {
    return null;
  }
  const parsed = questions
    .map<UserInputQuestion | null>((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const question = entry as Record<string, unknown>;
      if (
        typeof question.id !== "string" ||
        typeof question.header !== "string" ||
        typeof question.question !== "string" ||
        !Array.isArray(question.options)
      ) {
        return null;
      }
      const options = question.options
        .map<UserInputQuestion["options"][number] | null>((option) => {
          if (!option || typeof option !== "object") return null;
          const optionRecord = option as Record<string, unknown>;
          if (
            typeof optionRecord.label !== "string" ||
            typeof optionRecord.description !== "string"
          ) {
            return null;
          }
          return {
            label: optionRecord.label,
            description: optionRecord.description,
          };
        })
        .filter((option): option is UserInputQuestion["options"][number] => option !== null);
      if (options.length === 0) {
        return null;
      }
      return {
        id: question.id,
        header: question.header,
        question: question.question,
        options,
      };
    })
    .filter((question): question is UserInputQuestion => question !== null);
  return parsed.length > 0 ? parsed : null;
}

export function derivePendingUserInputs(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): PendingUserInput[] {
  const openByRequestId = new Map<ApprovalRequestId, PendingUserInput>();
  const ordered = [...activities].toSorted(compareActivitiesByOrder);

  for (const activity of ordered) {
    const payload =
      activity.payload && typeof activity.payload === "object"
        ? (activity.payload as Record<string, unknown>)
        : null;
    const requestId =
      payload && typeof payload.requestId === "string"
        ? ApprovalRequestId.makeUnsafe(payload.requestId)
        : null;

    if (activity.kind === "user-input.requested" && requestId) {
      const questions = parseUserInputQuestions(payload);
      if (!questions) {
        continue;
      }
      openByRequestId.set(requestId, {
        requestId,
        createdAt: activity.createdAt,
        questions,
      });
      continue;
    }

    if (activity.kind === "user-input.resolved" && requestId) {
      openByRequestId.delete(requestId);
    }
  }

  return [...openByRequestId.values()].toSorted((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export function deriveActivePlanState(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
  latestTurnId: TurnId | undefined,
): ActivePlanState | null {
  const ordered = [...activities].toSorted(compareActivitiesByOrder);
  const candidates = ordered.filter((activity) => {
    if (activity.kind !== "turn.plan.updated") {
      return false;
    }
    if (!latestTurnId) {
      return true;
    }
    return activity.turnId === latestTurnId;
  });
  const latest = candidates.at(-1);
  if (!latest) {
    return null;
  }
  const payload =
    latest.payload && typeof latest.payload === "object"
      ? (latest.payload as Record<string, unknown>)
      : null;
  const rawPlan = payload?.plan;
  if (!Array.isArray(rawPlan)) {
    return null;
  }
  const steps = rawPlan
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      if (typeof record.step !== "string") {
        return null;
      }
      const status =
        record.status === "completed" || record.status === "inProgress" ? record.status : "pending";
      return {
        step: record.step,
        status,
      };
    })
    .filter(
      (
        step,
      ): step is {
        step: string;
        status: "pending" | "inProgress" | "completed";
      } => step !== null,
    );
  if (steps.length === 0) {
    return null;
  }
  return {
    createdAt: latest.createdAt,
    turnId: latest.turnId,
    ...(payload && "explanation" in payload
      ? { explanation: payload.explanation as string | null }
      : {}),
    steps,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

function normalizeTokenCount(value: unknown): number | null {
  const numberValue = asFiniteNumber(value);
  if (numberValue === null) {
    return null;
  }
  return Math.max(0, Math.round(numberValue));
}

function parseTokenUsageBreakdown(value: unknown): TokenUsageBreakdown | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const totalTokens = normalizeTokenCount(record.totalTokens);
  const inputTokens = normalizeTokenCount(record.inputTokens);
  const cachedInputTokens = normalizeTokenCount(record.cachedInputTokens);
  const outputTokens = normalizeTokenCount(record.outputTokens);
  const reasoningOutputTokens = normalizeTokenCount(record.reasoningOutputTokens);
  if (
    totalTokens === null ||
    inputTokens === null ||
    cachedInputTokens === null ||
    outputTokens === null ||
    reasoningOutputTokens === null
  ) {
    return null;
  }
  return {
    totalTokens,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
  };
}

function parseThreadTelemetryContext(value: unknown): ThreadTelemetryContext | null {
  const record = asRecord(value);
  const usageRecord = asRecord(record?.tokenUsage) ?? record;
  if (!usageRecord) {
    return null;
  }
  const total = parseTokenUsageBreakdown(usageRecord.total);
  const last = parseTokenUsageBreakdown(usageRecord.last);
  const modelContextWindow = normalizeTokenCount(usageRecord.modelContextWindow);
  if (!total || !last || modelContextWindow === null || modelContextWindow <= 0) {
    return null;
  }

  const contextRecords = [
    usageRecord,
    asRecord(usageRecord.contextWindow),
    asRecord(usageRecord.context),
    asRecord(usageRecord.currentContext),
    asRecord(usageRecord.current),
  ].filter((entry): entry is Record<string, unknown> => entry !== null);

  const contextUsedTokens = contextRecords
    .map(
      (entry) =>
        normalizeTokenCount(
          entry.usedTokens ??
            entry.contextUsedTokens ??
            entry.currentContextTokens ??
            entry.currentTokens ??
            entry.tokensInContext,
        ),
    )
    .find((entry): entry is number => entry !== null);
  const contextRemainingTokens = contextRecords
    .map(
      (entry) =>
        normalizeTokenCount(
          entry.remainingTokens ??
            entry.contextRemainingTokens ??
            entry.remainingContextTokens ??
            entry.remaining ??
            entry.tokensRemaining,
        ),
    )
    .find((entry): entry is number => entry !== null);
  const contextUsedPercent = contextRecords
    .map((entry) =>
      asFiniteNumber(
        entry.usedPercent ?? entry.contextUsedPercent ?? entry.currentContextUsedPercent,
      ),
    )
    .find((entry): entry is number => entry !== null);
  const contextRemainingPercent = contextRecords
    .map((entry) =>
      asFiniteNumber(
        entry.remainingPercent ??
          entry.contextRemainingPercent ??
          entry.currentContextRemainingPercent ??
          entry.contextLeftPercent,
      ),
    )
    .find((entry): entry is number => entry !== null);

  return {
    total,
    last,
    modelContextWindow,
    contextUsedTokens: contextUsedTokens ?? null,
    contextRemainingTokens: contextRemainingTokens ?? null,
    contextUsedPercent: contextUsedPercent === undefined ? null : clampPercent(contextUsedPercent),
    contextRemainingPercent:
      contextRemainingPercent === undefined ? null : clampPercent(contextRemainingPercent),
  };
}

function parseRateLimitWindow(value: unknown): ThreadTelemetryRateLimitWindow | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const usedPercent = asFiniteNumber(record.usedPercent);
  if (usedPercent === null) {
    return null;
  }
  const windowDurationMins = asFiniteNumber(record.windowDurationMins);
  const resetsAt = asFiniteNumber(record.resetsAt);
  return {
    usedPercent: clampPercent(usedPercent),
    windowDurationMins:
      windowDurationMins === null ? null : Math.max(0, Math.round(windowDurationMins)),
    resetsAt: resetsAt === null ? null : Math.max(0, Math.round(resetsAt)),
  };
}

function parseThreadTelemetryRateLimits(value: unknown): ThreadTelemetryRateLimits | null {
  const record = asRecord(value);
  const rateLimitRecord = asRecord(record?.rateLimits) ?? record;
  if (!rateLimitRecord) {
    return null;
  }
  return {
    limitId: typeof rateLimitRecord.limitId === "string" ? rateLimitRecord.limitId : null,
    limitName: typeof rateLimitRecord.limitName === "string" ? rateLimitRecord.limitName : null,
    primary: parseRateLimitWindow(rateLimitRecord.primary),
    secondary: parseRateLimitWindow(rateLimitRecord.secondary),
    planType: typeof rateLimitRecord.planType === "string" ? rateLimitRecord.planType : null,
  };
}

function rateLimitDurationLabel(
  windowDurationMins: number | null,
  fallbackLabel: "5h" | "weekly",
): string {
  if (windowDurationMins === null) {
    return fallbackLabel;
  }

  const minutesPerHour = 60;
  const minutesPerDay = 24 * minutesPerHour;
  const minutesPerWeek = 7 * minutesPerDay;
  const minutesPerMonth = 30 * minutesPerDay;
  const roundingBiasMinutes = 3;
  const adjustedMinutes = Math.max(0, windowDurationMins);

  if (adjustedMinutes <= minutesPerDay + roundingBiasMinutes) {
    const roundedHours = Math.max(
      1,
      Math.floor((adjustedMinutes + roundingBiasMinutes) / minutesPerHour),
    );
    return `${roundedHours}h`;
  }
  if (adjustedMinutes <= minutesPerWeek + roundingBiasMinutes) {
    return "weekly";
  }
  if (adjustedMinutes <= minutesPerMonth + roundingBiasMinutes) {
    return "monthly";
  }
  return "annual";
}

function formatResetTimeLabel(resetsAtSeconds: number | null): string | null {
  if (resetsAtSeconds === null) {
    return null;
  }
  const resetDate = new Date(resetsAtSeconds * 1_000);
  const now = new Date();
  const moreThanDayAway = resetDate.getTime() - now.getTime() > 24 * 60 * 60 * 1_000;

  if (moreThanDayAway) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      ...(resetDate.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
    }).format(resetDate);
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(resetDate);
}

function toContextDisplay(context: ThreadTelemetryContext): ThreadTelemetryContextDisplay | null {
  const clampTokenWithinWindow = (value: number) =>
    Math.min(context.modelContextWindow, Math.max(0, value));

  let usedTokens: number | null = null;
  let remainingTokens: number | null = null;
  let usedPercent: number | null = null;
  let remainingPercent: number | null = null;

  if (context.contextRemainingTokens !== null || context.contextUsedTokens !== null) {
    remainingTokens =
      context.contextRemainingTokens !== null
        ? clampTokenWithinWindow(context.contextRemainingTokens)
        : clampTokenWithinWindow(context.modelContextWindow - context.contextUsedTokens!);
    usedTokens = context.modelContextWindow - remainingTokens;
    usedPercent = clampPercent((usedTokens / context.modelContextWindow) * 100);
    remainingPercent = clampPercent(100 - usedPercent);
  } else if (context.contextRemainingPercent !== null || context.contextUsedPercent !== null) {
    remainingPercent =
      context.contextRemainingPercent !== null
        ? clampPercent(context.contextRemainingPercent)
        : clampPercent(100 - context.contextUsedPercent!);
    usedPercent = clampPercent(100 - remainingPercent);
    remainingTokens = Math.round((context.modelContextWindow * remainingPercent) / 100);
    usedTokens = Math.max(0, context.modelContextWindow - remainingTokens);
  } else {
    usedTokens = clampTokenWithinWindow(context.last.inputTokens);
    remainingTokens = context.modelContextWindow - usedTokens;
    usedPercent = clampPercent((usedTokens / context.modelContextWindow) * 100);
    remainingPercent = clampPercent(100 - usedPercent);
  }

  if (
    usedTokens === null ||
    remainingTokens === null ||
    usedPercent === null ||
    remainingPercent === null
  ) {
    return null;
  }

  return {
    usedTokens,
    remainingTokens,
    usedPercent,
    remainingPercent,
    modelContextWindow: context.modelContextWindow,
    lastTurnTotalTokens: context.last.totalTokens,
    lastTurnInputTokens: context.last.inputTokens,
    lastTurnCachedInputTokens: context.last.cachedInputTokens,
    lastTurnOutputTokens: context.last.outputTokens,
    lastTurnReasoningOutputTokens: context.last.reasoningOutputTokens,
  };
}

function toRateLimitWindowDisplay(
  window: ThreadTelemetryRateLimitWindow | null,
  fallbackLabel: "5h" | "weekly",
): ThreadTelemetryRateLimitWindowDisplay {
  if (!window) {
    return {
      label: fallbackLabel,
      usedPercent: 0,
      remainingPercent: 0,
      resetTimeLabel: null,
      available: false,
    };
  }
  return {
    label: rateLimitDurationLabel(window.windowDurationMins, fallbackLabel),
    usedPercent: window.usedPercent,
    remainingPercent: clampPercent(100 - window.usedPercent),
    resetTimeLabel: formatResetTimeLabel(window.resetsAt),
    available: true,
  };
}

export function deriveThreadTelemetry(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ThreadTelemetry {
  let context: ThreadTelemetryContext | null = null;
  let rateLimits: ThreadTelemetryRateLimits | null = null;
  const ordered = [...activities].toSorted(compareActivitiesByOrder);

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const activity = ordered[index];
    if (!activity) {
      continue;
    }
    const payload = asRecord(activity.payload);

    if (context === null && activity.kind === "thread.token-usage.updated") {
      context = parseThreadTelemetryContext(payload?.usage ?? payload);
    }

    if (rateLimits === null && activity.kind === "account.rate-limits.updated") {
      rateLimits = parseThreadTelemetryRateLimits(payload?.rateLimits ?? payload);
    }

    if (context !== null && rateLimits !== null) {
      break;
    }
  }

  return {
    context,
    rateLimits,
    contextDisplay: context ? toContextDisplay(context) : null,
    rateLimitDisplay: rateLimits
      ? {
          primary: toRateLimitWindowDisplay(rateLimits.primary, "5h"),
          secondary: toRateLimitWindowDisplay(rateLimits.secondary, "weekly"),
        }
      : null,
  };
}

export function findLatestProposedPlan(
  proposedPlans: ReadonlyArray<ProposedPlan>,
  latestTurnId: TurnId | string | null | undefined,
): LatestProposedPlanState | null {
  if (latestTurnId) {
    const matchingTurnPlan = [...proposedPlans]
      .filter((proposedPlan) => proposedPlan.turnId === latestTurnId)
      .toSorted(
        (left, right) =>
          left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id),
      )
      .at(-1);
    if (matchingTurnPlan) {
      return {
        id: matchingTurnPlan.id,
        createdAt: matchingTurnPlan.createdAt,
        updatedAt: matchingTurnPlan.updatedAt,
        turnId: matchingTurnPlan.turnId,
        planMarkdown: matchingTurnPlan.planMarkdown,
      };
    }
  }

  const latestPlan = [...proposedPlans]
    .toSorted(
      (left, right) =>
        left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id),
    )
    .at(-1);
  if (!latestPlan) {
    return null;
  }

  return {
    id: latestPlan.id,
    createdAt: latestPlan.createdAt,
    updatedAt: latestPlan.updatedAt,
    turnId: latestPlan.turnId,
    planMarkdown: latestPlan.planMarkdown,
  };
}

export function deriveWorkLogEntries(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
  latestTurnId: TurnId | undefined,
): WorkLogEntry[] {
  const ordered = [...activities].toSorted(compareActivitiesByOrder);
  return ordered
    .filter((activity) => (latestTurnId ? activity.turnId === latestTurnId : true))
    .filter((activity) => activity.kind !== "tool.started")
    .filter((activity) => activity.kind !== "task.started" && activity.kind !== "task.completed")
    .filter((activity) => activity.kind !== "thread.token-usage.updated")
    .filter((activity) => activity.kind !== "account.rate-limits.updated")
    .filter((activity) => activity.summary !== "Checkpoint captured")
    .map((activity) => {
      const payload =
        activity.payload && typeof activity.payload === "object"
          ? (activity.payload as Record<string, unknown>)
          : null;
      const command = extractToolCommand(payload);
      const changedFiles = extractChangedFiles(payload);
      const entry: WorkLogEntry = {
        id: activity.id,
        createdAt: activity.createdAt,
        label: activity.summary,
        tone: activity.tone === "approval" ? "info" : activity.tone,
      };
      if (payload && typeof payload.detail === "string" && payload.detail.length > 0) {
        entry.detail = payload.detail;
      }
      if (command) {
        entry.command = command;
      }
      if (changedFiles.length > 0) {
        entry.changedFiles = changedFiles;
      }
      return entry;
    });
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCommandValue(value: unknown): string | null {
  const direct = asTrimmedString(value);
  if (direct) {
    return direct;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const parts = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== null);
  return parts.length > 0 ? parts.join(" ") : null;
}

function extractToolCommand(payload: Record<string, unknown> | null): string | null {
  const data = asRecord(payload?.data);
  const item = asRecord(data?.item);
  const itemResult = asRecord(item?.result);
  const itemInput = asRecord(item?.input);
  const candidates = [
    normalizeCommandValue(item?.command),
    normalizeCommandValue(itemInput?.command),
    normalizeCommandValue(itemResult?.command),
    normalizeCommandValue(data?.command),
  ];
  return candidates.find((candidate) => candidate !== null) ?? null;
}

function pushChangedFile(target: string[], seen: Set<string>, value: unknown) {
  const normalized = asTrimmedString(value);
  if (!normalized || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  target.push(normalized);
}

function collectChangedFiles(value: unknown, target: string[], seen: Set<string>, depth: number) {
  if (depth > 4 || target.length >= 12) {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectChangedFiles(entry, target, seen, depth + 1);
      if (target.length >= 12) {
        return;
      }
    }
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  pushChangedFile(target, seen, record.path);
  pushChangedFile(target, seen, record.filePath);
  pushChangedFile(target, seen, record.relativePath);
  pushChangedFile(target, seen, record.filename);
  pushChangedFile(target, seen, record.newPath);
  pushChangedFile(target, seen, record.oldPath);

  for (const nestedKey of [
    "item",
    "result",
    "input",
    "data",
    "changes",
    "files",
    "edits",
    "patch",
    "patches",
    "operations",
  ]) {
    if (!(nestedKey in record)) {
      continue;
    }
    collectChangedFiles(record[nestedKey], target, seen, depth + 1);
    if (target.length >= 12) {
      return;
    }
  }
}

function extractChangedFiles(payload: Record<string, unknown> | null): string[] {
  const data = asRecord(payload?.data);
  const changedFiles: string[] = [];
  collectChangedFiles(data, changedFiles, new Set<string>(), 0);
  return changedFiles;
}

function compareActivitiesByOrder(
  left: OrchestrationThreadActivity,
  right: OrchestrationThreadActivity,
): number {
  if (left.sequence !== undefined && right.sequence !== undefined) {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
  } else if (left.sequence !== undefined) {
    return 1;
  } else if (right.sequence !== undefined) {
    return -1;
  }

  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

export function hasToolActivityForTurn(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
  turnId: TurnId | null | undefined,
): boolean {
  if (!turnId) return false;
  return activities.some((activity) => activity.turnId === turnId && activity.tone === "tool");
}

export function deriveTimelineEntries(
  messages: ChatMessage[],
  proposedPlans: ProposedPlan[],
  workEntries: WorkLogEntry[],
): TimelineEntry[] {
  const messageRows: TimelineEntry[] = messages.map((message) => ({
    id: message.id,
    kind: "message",
    createdAt: message.createdAt,
    message,
  }));
  const proposedPlanRows: TimelineEntry[] = proposedPlans.map((proposedPlan) => ({
    id: proposedPlan.id,
    kind: "proposed-plan",
    createdAt: proposedPlan.createdAt,
    proposedPlan,
  }));
  const workRows: TimelineEntry[] = workEntries.map((entry) => ({
    id: entry.id,
    kind: "work",
    createdAt: entry.createdAt,
    entry,
  }));
  return [...messageRows, ...proposedPlanRows, ...workRows].toSorted((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function inferCheckpointTurnCountByTurnId(
  summaries: TurnDiffSummary[],
): Record<TurnId, number> {
  const sorted = [...summaries].toSorted((a, b) => a.completedAt.localeCompare(b.completedAt));
  const result: Record<TurnId, number> = {};
  for (let index = 0; index < sorted.length; index += 1) {
    const summary = sorted[index];
    if (!summary) continue;
    result[summary.turnId] = index + 1;
  }
  return result;
}

export function derivePhase(session: ThreadSession | null): SessionPhase {
  if (!session || session.status === "closed") return "disconnected";
  if (session.status === "connecting") return "connecting";
  if (session.status === "running") return "running";
  return "ready";
}
