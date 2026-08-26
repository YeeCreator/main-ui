export type FeedbackKind = 'notification' | 'confirm' | 'progress';
export type FeedbackItem = { id: string; kind: FeedbackKind; title: string; message?: string; progress?: number; resolve?: (value: boolean) => void };
