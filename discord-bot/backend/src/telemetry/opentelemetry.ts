export interface TraceSpan {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  attributes: Record<string, any>;
}

export class TelemetryTracer {
  private static instance: TelemetryTracer;
  private activeSpans: Map<string, TraceSpan> = new Map();

  public static getInstance(): TelemetryTracer {
    if (!this.instance) {
      this.instance = new TelemetryTracer();
    }
    return this.instance;
  }

  public startSpan(name: string, attributes: Record<string, any> = {}): TraceSpan {
    const traceId = Math.random().toString(36).substring(2, 15);
    const spanId = Math.random().toString(36).substring(2, 10);
    const span: TraceSpan = {
      traceId,
      spanId,
      name,
      startTime: Date.now(),
      attributes,
    };
    this.activeSpans.set(spanId, span);
    return span;
  }

  public endSpan(span: TraceSpan): void {
    const durationMs = Date.now() - span.startTime;
    console.log(`[OpenTelemetry] Span [${span.name}] completed in ${durationMs}ms (TraceId: ${span.traceId})`);
    this.activeSpans.delete(span.spanId);
  }
}

export const tracer = TelemetryTracer.getInstance();
