import type {
  ThreadTelemetryContextDisplay,
  ThreadTelemetryRateLimitDisplay,
} from "../session-logic";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

function formatDetailedTokenCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function RateLimitRow(props: {
  label: string;
  available: boolean;
  remainingPercent: number;
  resetTimeLabel: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground/80">{props.label}</span>
      {props.available ? (
        <span className="text-right font-medium text-foreground/85">
          {formatPercent(props.remainingPercent)} left
          {props.resetTimeLabel ? ` • resets ${props.resetTimeLabel}` : ""}
        </span>
      ) : (
        <span className="text-muted-foreground/70">Unavailable</span>
      )}
    </div>
  );
}

export default function ComposerContextStatus(props: {
  compact: boolean;
  contextDisplay: ThreadTelemetryContextDisplay;
  rateLimitDisplay: ThreadTelemetryRateLimitDisplay | null;
}) {
  const progress = Math.min(100, Math.max(0, props.contextDisplay.usedPercent));
  const rateLimitDisplay = props.rateLimitDisplay ?? {
    primary: {
      label: "5h",
      usedPercent: 0,
      remainingPercent: 0,
      resetTimeLabel: null,
      available: false,
    },
    secondary: {
      label: "weekly",
      usedPercent: 0,
      remainingPercent: 0,
      resetTimeLabel: null,
      available: false,
    },
  };

  return (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={
          <button
            type="button"
            className="shrink-0 rounded-full opacity-60 transition-opacity hover:opacity-85 focus-visible:opacity-100 focus-visible:outline-none"
            aria-label="Conversation context status"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 36 36"
              className={cn("text-foreground", props.compact ? "size-4" : "size-5")}
            >
              <circle
                cx="20"
                cy="20"
                r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-12"
              />
              <circle
                cx="20"
                cy="20"
                r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={`${progress} 100`}
                transform="rotate(-90 20 20)"
                className="opacity-75"
              />
            </svg>
          </button>
        }
      />
      <TooltipPopup
        side="top"
        align="end"
        sideOffset={8}
        className="max-w-88 whitespace-normal px-3 py-2 text-xs"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="font-medium text-foreground">Context</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground/80">Used</span>
              <span>{formatDetailedTokenCount(props.contextDisplay.usedTokens)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground/80">Remaining</span>
              <span>
                {formatDetailedTokenCount(props.contextDisplay.remainingTokens)} (
                {formatPercent(props.contextDisplay.remainingPercent)})
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground/80">Window</span>
              <span>
                {formatDetailedTokenCount(props.contextDisplay.modelContextWindow)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground/80">Last turn</span>
              <span className="text-right">
                {formatDetailedTokenCount(props.contextDisplay.lastTurnTotalTokens)} total
              </span>
            </div>
            <div className="text-muted-foreground/75 text-xs">
              {formatDetailedTokenCount(props.contextDisplay.lastTurnInputTokens)} in,{" "}
              {formatDetailedTokenCount(props.contextDisplay.lastTurnCachedInputTokens)} cached,{" "}
              {formatDetailedTokenCount(props.contextDisplay.lastTurnOutputTokens)} out,{" "}
              {formatDetailedTokenCount(props.contextDisplay.lastTurnReasoningOutputTokens)}{" "}
              reasoning
            </div>
          </div>
          <div className="space-y-1.5 border-border/60 border-t pt-2">
            <div className="font-medium text-foreground">Rate limits</div>
            <RateLimitRow
              label={rateLimitDisplay.primary.label}
              available={rateLimitDisplay.primary.available}
              remainingPercent={rateLimitDisplay.primary.remainingPercent}
              resetTimeLabel={rateLimitDisplay.primary.resetTimeLabel}
            />
            <RateLimitRow
              label={rateLimitDisplay.secondary.label}
              available={rateLimitDisplay.secondary.available}
              remainingPercent={rateLimitDisplay.secondary.remainingPercent}
              resetTimeLabel={rateLimitDisplay.secondary.resetTimeLabel}
            />
          </div>
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}
