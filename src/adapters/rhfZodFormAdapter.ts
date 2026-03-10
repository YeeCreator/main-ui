import { z } from 'zod';
import type { FormAdapter } from './types';

/**
 * RHF + Zod 表单上下文。
 *
 * @typeParam TValues 表单值类型。
 */
export type RhfZodFormContext<TValues> = {
  /** 初始值。 */
  defaultValues: TValues;
  /** 统一校验函数。 */
  validate: (values: TValues) => { valid: boolean; errors?: Record<string, string> };
};

/**
 * RHF + Zod 表单适配器实现。
 */
export const rhfZodFormAdapter: FormAdapter = {
  /**
   * 创建表单上下文。
   *
   * @typeParam TValues 表单值类型。
   * @param options 初始值与可选校验器。
   * @returns 表单上下文。
   */
  createFormContext<TValues>(options: {
    defaultValues: TValues;
    validator?: (values: TValues) => { valid: boolean; errors?: Record<string, string> };
  }): RhfZodFormContext<TValues> {
    const fallbackValidator = (values: TValues): { valid: boolean; errors?: Record<string, string> } => {
      const anySchema = z.any();
      const parsed = anySchema.safeParse(values);
      return {
        valid: parsed.success,
      };
    };

    return {
      defaultValues: options.defaultValues,
      validate: options.validator ?? fallbackValidator,
    };
  },
};
