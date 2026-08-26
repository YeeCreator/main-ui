export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type WorkspaceId = string;
export type LayoutNodeId = string;
export type GroupId = string;
export type TabId = string;
export type EditorInstanceId = string;
export type EditorKind = string;
export type OverlaySessionId = string;
export type IconToken = string;
export type ThemeId = string;

export type SplitDirection = 'left' | 'right' | 'up' | 'down';
export type SplitOrientation = 'horizontal' | 'vertical';
export type JoinMode = 'keep-source' | 'keep-target' | 'merge-tabs';
export type OverlayDismissReason = 'escape' | 'outside-pointer' | 'close-button' | 'promote' | 'programmatic';

export type Result<T> =
  | { ok: true; value: T; warnings?: string[] }
  | { ok: false; error: WorkbenchError };

export type WorkbenchError = {
  code: string;
  message: string;
  details?: JsonObject;
};

export type IdFactory = (prefix: string) => string;

export type Clock = () => string;

export const createError = (code: string, message: string, details?: JsonObject): WorkbenchError => ({
  code,
  message,
  details,
});

export const ok = <T>(value: T, warnings?: string[]): Result<T> => ({ ok: true, value, warnings });

export const fail = <T = never>(code: string, message: string, details?: JsonObject): Result<T> => ({
  ok: false,
  error: createError(code, message, details),
});
