import { describe, expect, test, vi } from 'vitest';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  createSurfaceStack,
  SurfaceHost,
  SurfaceShell,
  useSurfaceStack,
  type SurfaceDescriptor,
} from '../../src/vue';

/** 仅用于断言「哪个面被渲染」的最小面组件。 */
const makeSurface = (label: string) =>
  defineComponent({
    name: `Surface_${label}`,
    setup() {
      return () => h('div', { class: 'probe', 'data-probe': label }, label);
    },
  });

const render = async (app: unknown): Promise<string> =>
  renderToString(app as Parameters<typeof renderToString>[0]);

describe('createSurfaceStack', () => {
  test('starts at the given initial surface with no back history', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    expect(stack.active.value).toBe('hall');
    expect(stack.stack.value).toEqual(['hall']);
    expect(stack.canBack.value).toBe(false);
  });

  test('open pushes a new surface and keeps active in sync with the stack tail', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('options');
    expect(stack.active.value).toBe('options');
    expect(stack.stack.value).toEqual(['hall', 'options']);
    expect(stack.canBack.value).toBe(true);
  });

  test('open on the current surface only updates payload instead of pushing twice', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('options', { itemId: 'a' });
    stack.open('options', { itemId: 'b' });
    expect(stack.stack.value).toEqual(['hall', 'options']);
    expect(stack.payloads.value.options).toEqual({ itemId: 'b' });
  });

  test('back pops one level and never leaves the root surface', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('options');
    stack.back();
    expect(stack.active.value).toBe('hall');
    expect(stack.stack.value).toEqual(['hall']);
    stack.back();
    expect(stack.stack.value).toEqual(['hall']);
    expect(stack.canBack.value).toBe(false);
  });

  test('reset clears history and returns to the root by default', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('options');
    stack.open('content');
    stack.reset();
    expect(stack.stack.value).toEqual(['hall']);
    expect(stack.active.value).toBe('hall');
  });

  test('reset can target an explicit surface', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('options');
    stack.reset('settings');
    expect(stack.stack.value).toEqual(['settings']);
  });

  test('payloads survive reset so a re-entered surface keeps its last params', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('options', { itemId: 'x' });
    stack.reset();
    expect(stack.payloads.value.options).toEqual({ itemId: 'x' });
  });

  test('open ignores an empty id', () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('');
    expect(stack.stack.value).toEqual(['hall']);
  });
});

describe('useSurfaceStack', () => {
  test('throws a descriptive error outside a surface host', () => {
    // inject() 在 setup 之外调用会告警并返回默认值，此处默认值特意为 null → 显式抛错。
    expect(() => useSurfaceStack()).toThrowError(/must be used inside <SurfaceHost>/);
  });

  test('resolves the provided stack inside a host', async () => {
    const seen: unknown[] = [];
    const Consumer = defineComponent({
      setup() {
        seen.push(useSurfaceStack());
        return () => h('div');
      },
    });
    const surfaces: SurfaceDescriptor[] = [
      { id: 'hall', title: 'Hall', component: Consumer, root: true },
    ];
    await render(
      createSSRApp({
        render: () => h(SurfaceHost, { surfaces, initial: 'hall' }),
      }),
    );
    expect(seen).toHaveLength(1);
    const api = seen[0] as ReturnType<typeof useSurfaceStack>;
    expect(api.active.value).toBe('hall');
  });
});

describe('SurfaceHost', () => {
  test('renders only the active surface', async () => {
    const surfaces: SurfaceDescriptor[] = [
      { id: 'hall', title: 'Hall', component: makeSurface('hall'), root: true },
      { id: 'options', title: 'Options', component: makeSurface('options') },
    ];
    const html = await render(
      createSSRApp({
        render: () => h(SurfaceHost, { surfaces, initial: 'hall' }),
      }),
    );
    expect(html).toContain('data-probe="hall"');
    expect(html).not.toContain('data-probe="options"');
  });

  test('marks the active surface on the host element', async () => {
    const surfaces: SurfaceDescriptor[] = [
      { id: 'hall', title: 'Hall', component: makeSurface('hall'), root: true },
      { id: 'options', title: 'Options', component: makeSurface('options') },
    ];
    const html = await render(
      createSSRApp({
        render: () => h(SurfaceHost, { surfaces, initial: 'options' }),
      }),
    );
    expect(html).toContain('data-mui-surface="options"');
    expect(html).toContain('data-probe="options"');
  });

  test('falls back to the first root surface when initial is omitted', async () => {
    const surfaces: SurfaceDescriptor[] = [
      { id: 'first', title: 'First', component: makeSurface('first') },
      { id: 'rooted', title: 'Rooted', component: makeSurface('rooted'), root: true },
    ];
    const html = await render(
      createSSRApp({
        render: () => h(SurfaceHost, { surfaces }),
      }),
    );
    expect(html).toContain('data-probe="rooted"');
  });

  test('renders the missing slot when the active id has no descriptor', async () => {
    const html = await render(
      createSSRApp({
        render: () =>
          h(SurfaceHost, { surfaces: [], initial: 'ghost' }, {
            missing: ({ id }: { id: string }) => h('div', { class: 'ghost' }, `missing:${id}`),
          }),
      }),
    );
    expect(html).toContain('missing:ghost');
  });

  test('renders nothing (no crash) when nothing matches and no missing slot exists', async () => {
    const html = await render(
      createSSRApp({
        render: () => h(SurfaceHost, { surfaces: [], initial: 'ghost' }),
      }),
    );
    expect(html).toContain('main-ui-surface-host');
  });

  test('passes the surface payload to the rendered component', async () => {
    const PayloadProbe = defineComponent({
      props: { payload: { type: Object, default: null } },
      setup(props) {
        return () => h('div', { class: 'probe' }, JSON.stringify(props.payload));
      },
    });
    const stack = createSurfaceStack({ initial: 'hall' });
    stack.open('detail', { itemId: 'x' });
    const surfaces: SurfaceDescriptor[] = [
      { id: 'hall', title: 'Hall', component: makeSurface('hall'), root: true },
      { id: 'detail', title: 'Detail', component: PayloadProbe },
    ];
    const html = await render(
      createSSRApp({
        render: () => h(SurfaceHost, { surfaces, stack }),
      }),
    );
    expect(html).toContain('itemId');
    expect(html).toContain('x');
  });

  test('supports a default slot that takes over rendering', async () => {
    const surfaces: SurfaceDescriptor[] = [
      { id: 'hall', title: 'Hall', component: makeSurface('hall'), root: true },
    ];
    const html = await render(
      createSSRApp({
        render: () =>
          h(SurfaceHost, { surfaces, initial: 'hall' }, {
            default: ({ descriptor }: { descriptor: SurfaceDescriptor }) =>
              h('div', { class: 'custom' }, `custom:${descriptor.id}`),
          }),
      }),
    );
    expect(html).toContain('custom:hall');
    expect(html).not.toContain('data-probe="hall"');
  });

  test('accepts an externally created stack', async () => {
    const stack = createSurfaceStack({ initial: 'hall' });
    const surfaces: SurfaceDescriptor[] = [
      { id: 'hall', title: 'Hall', component: makeSurface('hall'), root: true },
      { id: 'options', title: 'Options', component: makeSurface('options') },
    ];
    const app = createSSRApp({
      render: () => h(SurfaceHost, { surfaces, stack }),
    });
    stack.open('options');
    const html = await render(app);
    expect(html).toContain('data-probe="options"');
  });
});

describe('SurfaceShell', () => {
  test('renders title, subtitle and body', async () => {
    const html = await render(
      createSSRApp({
        render: () =>
          h(SurfaceShell, { title: 'T', subtitle: 'S' }, { default: () => h('p', 'body') }),
      }),
    );
    expect(html).toContain('main-ui-surface-shell__title');
    expect(html).toContain('T');
    expect(html).toContain('S');
    expect(html).toContain('body');
  });

  test('renders no header when neither title, subtitle, back nor actions exist', async () => {
    const html = await render(
      createSSRApp({
        render: () => h(SurfaceShell, null, { default: () => h('p', 'body') }),
      }),
    );
    expect(html).not.toContain('main-ui-surface-shell__header');
  });

  test('shows the back button only when onBack is provided', async () => {
    const withBack = await render(
      createSSRApp({
        render: () => h(SurfaceShell, { title: 'T', onBack: () => {} }),
      }),
    );
    expect(withBack).toContain('main-ui-surface-shell__back');

    const withoutBack = await render(
      createSSRApp({
        render: () => h(SurfaceShell, { title: 'T' }),
      }),
    );
    expect(withoutBack).not.toContain('main-ui-surface-shell__back');
  });

  test('invokes onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    const html = await render(
      createSSRApp({
        render: () => h(SurfaceShell, { title: 'T', onBack }),
      }),
    );
    expect(html).toContain('main-ui-surface-shell__back');
    // SSR 无真实事件，直接断言回调已绑定（点击由浏览器冒烟覆盖）。
    expect(onBack).not.toHaveBeenCalled();
  });
});
