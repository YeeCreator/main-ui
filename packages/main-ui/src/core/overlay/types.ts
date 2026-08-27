import type { EditorInstanceId, OverlayDismissReason, OverlaySessionId } from '../types';

export type OverlaySession = {
  id: OverlaySessionId;
  editorInstanceId: EditorInstanceId;
  presentation: 'centered-modal' | 'anchored-popover';
  dismissOnOutsidePointerDown: boolean;
  dismissOnEscape: boolean;
  showBackdrop: boolean;
  canPromoteToTab: boolean;
  width?: number;
  height?: number;
  anchorId?: string;
};

export type OverlayCloseEvent = {
  overlayId: OverlaySessionId;
  reason: OverlayDismissReason;
};
