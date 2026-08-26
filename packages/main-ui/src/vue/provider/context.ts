import type { InjectionKey, ShallowRef } from 'vue';
import type { WorkbenchAction, WorkbenchDocument, Result } from '../../core';
import type { MainUiRuntime } from '../runtime';

export type MainUiVueContext = {
  runtime: MainUiRuntime;
  document: ShallowRef<WorkbenchDocument>;
  dispatch: (action: WorkbenchAction) => Promise<Result<WorkbenchDocument>>;
};

export const MainUiContextKey: InjectionKey<MainUiVueContext> = Symbol('MainUiContext');
