/**
 * input/platform —— 平台归一的**唯一入口**。
 *
 * 输入系统不做自己的平台启发式：`navigator.platform` 已不足以信任
 * （macOS 上的 iPad App、UA 精简、Electron 的 preload 合约），
 * 且 `core/environment` 已经建立了「preload 合约 > 显式覆盖 > 启发式」的判定链。
 *
 * 因此本模块只做**归一**（把各种写法收敛到三个平台值），判定一律委托 `detectEnvironment`。
 */
import { detectEnvironment } from '../environment/detect';
import type { RuntimePlatform } from '../environment/types';
import type { Platform } from './types';

/**
 * 把任意平台字符串归一为三值平台。
 *
 * @param raw 原始平台串（如 `'Darwin'`、`'Win32'`、`'MacIntel'`）。
 * @returns `'mac'` / `'windows'` / `'linux'`；无法识别时回落 `'linux'`。
 * @example
 * normalizePlatform('MacIntel') // 'mac'
 */
export function normalizePlatform(raw: string | undefined): Platform {
  const value = (raw ?? '').toLowerCase();
  if (value.startsWith('darwin') || value.includes('mac')) return 'mac';
  if (value.startsWith('win')) return 'windows';
  return 'linux';
}

/**
 * 当前运行平台（委托环境探测，不重复实现启发式）。
 *
 * @returns 三值平台。
 * @example
 * currentPlatform() // 'mac'
 */
export function currentPlatform(): Platform {
  return detectEnvironment().platform as RuntimePlatform;
}

/**
 * 平台主修饰键：mac 为 `meta`（⌘），其余为 `ctrl`。
 *
 * 这是「`mod`」语义的落点：DSL 里的 `mod` / `cmd` / `ctrl` 都归一到此。
 *
 * @param platform 目标平台。
 * @returns `'meta'` 或 `'ctrl'`。
 */
export function primaryModifier(platform: Platform): 'meta' | 'ctrl' {
  return platform === 'mac' ? 'meta' : 'ctrl';
}

/** 修饰键显示顺序（渲染键位文本时用）。 */
const MODIFIER_DISPLAY_ORDER = ['ctrl', 'meta', 'alt', 'shift'] as const;

/**
 * 修饰键显示符号（mac 用图形符号，其余用缩写）。
 *
 * @param platform 目标平台。
 * @returns 修饰键到显示文本的映射。
 * @example
 * modifierSymbols('mac').meta // '⌘'
 */
export function modifierSymbols(platform: Platform): Record<'ctrl' | 'meta' | 'alt' | 'shift', string> {
  if (platform === 'mac') return { ctrl: '⌃', meta: '⌘', alt: '⌥', shift: '⇧' };
  return { ctrl: 'Ctrl', meta: 'Win', alt: 'Alt', shift: 'Shift' };
}

/**
 * 按平台把修饰键集合格式化为人类可读前缀。
 *
 * @param mods 修饰键集合（已归一）。
 * @param platform 目标平台。
 * @returns 例：mac 的 `{ meta: true, shift: true }` → `'⌘⇧ '`。
 */
export function formatModifiers(
  mods: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean },
  platform: Platform,
): string {
  const symbols = modifierSymbols(platform);
  const parts = MODIFIER_DISPLAY_ORDER.filter((name) => Boolean(mods[name])).map((name) => symbols[name]);
  return parts.length > 0 ? `${parts.join('')} ` : '';
}

/**
 * 把 `KeyboardEvent.code` 转成人类可读键名。
 *
 * 只覆盖常用键；未知键去掉 `Key` / `Digit` 前缀后原样返回，
 * 以保证面板不会显示 `undefined`。
 *
 * @param code 物理键位。
 * @param platform 目标平台（决定修饰键符号）。
 * @returns 例：`'KeyK'` → `'K'`，`'ShiftLeft'` → `'⇧'`（mac）。
 * @example
 * formatKeyCode('KeyK', 'mac') // 'K'
 */
export function formatKeyCode(code: string, platform: Platform): string {
  const symbols = modifierSymbols(platform);
  switch (code) {
    case 'ShiftLeft':
    case 'ShiftRight':
      return symbols.shift;
    case 'ControlLeft':
    case 'ControlRight':
      return symbols.ctrl;
    case 'AltLeft':
    case 'AltRight':
      return symbols.alt;
    case 'MetaLeft':
    case 'MetaRight':
      return symbols.meta;
    case 'Space':
      return platform === 'mac' ? '␣' : 'Space';
    case 'Enter':
    case 'NumpadEnter':
      return platform === 'mac' ? '↩' : 'Enter';
    case 'Escape':
      return 'Esc';
    case 'Backspace':
      return platform === 'mac' ? '⌫' : 'Backspace';
    case 'Delete':
      return platform === 'mac' ? '⌦' : 'Delete';
    case 'Tab':
      return 'Tab';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'Backquote':
      return '`';
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Backslash':
      return '\\';
    case 'Semicolon':
      return ';';
    case 'Quote':
      return "'";
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Slash':
      return '/';
    default:
      break;
  }
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (code.startsWith('Numpad') && code.length > 6) return `Num ${code.slice(6)}`;
  return code;
}
