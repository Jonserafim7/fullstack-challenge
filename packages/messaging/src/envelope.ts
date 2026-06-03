export interface MessageEnvelope<TPayload = unknown> {
  messageKey: string;
  type: string;
  payload: TPayload;
  occurredAt: string;
}
