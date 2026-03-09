export type ScreenAction = {
  id?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export type CopyField = {
  label: string;
  value: string;
  monospace?: boolean;
  multiline?: boolean;
};

export type SidebarControl =
  | {
      kind: 'select';
      id?: string;
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
      disabled?: boolean;
    }
  | {
      kind: 'segmented';
      id?: string;
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
      disabled?: boolean;
    }
  | {
      kind: 'radio';
      id?: string;
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
      disabled?: boolean;
    };

export type SidebarSection = {
  /** Unique id used as React key. Must be stable. */
  id: string;
  title: string;
  statusText?: string;
  controls?: SidebarControl[];
  actions?: ScreenAction[];
  copyFields?: CopyField[];
  footerHint?: string;
};

export type SidebarModel = {
  title?: string;
  sections: SidebarSection[];
};
