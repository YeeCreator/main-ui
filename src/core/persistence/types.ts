import type { WorkbenchDocument } from '../workspace/types';

export type PersistenceAdapter = {
  load: () => Promise<WorkbenchDocument | null>;
  save: (document: WorkbenchDocument) => Promise<void>;
  clear?: () => Promise<void>;
};
