import type { ReactNode } from 'react';

/**
 * 数据表格列定义。
 */
export type DataTableColumn<TItem> = {
  /** 列唯一标识。 */
  id: string;
  /** 列标题。 */
  header: ReactNode;
  /** 单元格渲染函数。 */
  cell: (item: TItem) => ReactNode;
};

/**
 * 数据表格适配器契约。
 */
export type DataTableAdapter = {
  /**
   * 创建数据表格上下文。
   *
   * @typeParam TItem 行数据类型。
   * @param options 表格数据和列定义。
   * @returns 供宿主渲染层消费的表格上下文对象。
   */
  createTableContext<TItem extends object>(options: {
    /** 行数据集合。 */
    data: TItem[];
    /** 列定义集合。 */
    columns: Array<DataTableColumn<TItem>>;
  }): unknown;
};

/**
 * 树形导航适配器契约。
 */
export type TreeAdapter = {
  /**
   * 创建树渲染上下文。
   *
   * @typeParam TNode 节点数据类型。
   * @param options 树节点与键映射配置。
   * @returns 可被导航面板消费的树上下文对象。
   */
  createTreeContext<TNode>(options: {
    /** 节点列表。 */
    nodes: TNode[];
    /** 节点唯一键提取函数。 */
    getId: (node: TNode) => string;
    /** 子节点提取函数。 */
    getChildren: (node: TNode) => TNode[] | undefined;
  }): unknown;
};

/**
 * 表单适配器契约。
 */
export type FormAdapter = {
  /**
   * 创建表单上下文。
   *
   * @typeParam TValues 表单值类型。
   * @param options 表单初始值与校验器。
   * @returns 表单上下文对象。
   */
  createFormContext<TValues>(options: {
    /** 初始值。 */
    defaultValues: TValues;
    /** 可选校验器。 */
    validator?: (values: TValues) => { valid: boolean; errors?: Record<string, string> };
  }): unknown;
};

/**
 * 开源库适配器注册表。
 */
export type AdapterRegistry = {
  /** 数据表格适配器。 */
  dataTable?: DataTableAdapter;
  /** 树形适配器。 */
  tree?: TreeAdapter;
  /** 表单适配器。 */
  form?: FormAdapter;
};
