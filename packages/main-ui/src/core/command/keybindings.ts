import type { CommandRunContext, KeyModifier, KeybindingDescriptor, ParsedKeybinding } from './types';

const MODIFIER_ALIASES: Record<string, KeyModifier> = {
  ctrl: 'ctrl', control: 'ctrl', cmd: 'cmd', command: 'cmd', meta: 'meta', mod: 'meta',
  alt: 'alt', option: 'alt', shift: 'shift',
};

const MODIFIER_ORDER: KeyModifier[] = ['ctrl', 'cmd', 'meta', 'alt', 'shift'];

export const parseKeybinding = (input: string): ParsedKeybinding => {
  const tokens = input.split(/\s*\+\s*/).map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error('A keybinding must contain a key.');
  }
  const rawKey = tokens.pop()!;
  const modifiers = [...new Set(tokens.map((token) => MODIFIER_ALIASES[token.toLowerCase()]).filter(Boolean))]
    .sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  const key = rawKey.length === 1 ? rawKey.toUpperCase() : rawKey.toLowerCase();
  const canonical = [...modifiers, key].join('+');
  return { key, modifiers, canonical };
};

export const normalizeKeybinding = (input: string, platform: 'mac' | 'windows' | 'linux' = detectPlatform()): string => {
  const parsed = parseKeybinding(input);
  const modifiers: KeyModifier[] = parsed.modifiers.map((modifier): KeyModifier => {
    if (modifier === 'ctrl' && platform === 'mac') return 'cmd';
    if ((modifier === 'cmd' || modifier === 'meta') && platform !== 'mac') return 'ctrl';
    return modifier;
  });
  return [...new Set(modifiers), parsed.key].sort((a, b) => {
    if (a === parsed.key) return 1;
    if (b === parsed.key) return -1;
    return MODIFIER_ORDER.indexOf(a as KeyModifier) - MODIFIER_ORDER.indexOf(b as KeyModifier);
  }).join('+');
};

export const detectPlatform = (): 'mac' | 'windows' | 'linux' => {
  if (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)) return 'mac';
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.platform)) return 'windows';
  return 'linux';
};

export type KeybindingConflict = {
  keybinding: string;
  entries: KeybindingDescriptor[];
};

export class KeybindingRegistry {
  private readonly entries = new Map<string, KeybindingDescriptor[]>();
  private readonly platform: 'mac' | 'windows' | 'linux';

  constructor(platform: 'mac' | 'windows' | 'linux' = detectPlatform()) {
    this.platform = platform;
  }

  register(descriptor: KeybindingDescriptor): void {
    const key = normalizeKeybinding(descriptor.keybinding, this.platform);
    const list = this.entries.get(key) ?? [];
    const next = list.filter((entry) => entry.commandId !== descriptor.commandId || entry.source !== descriptor.source);
    next.push({ ...descriptor, keybinding: key });
    next.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    this.entries.set(key, next);
  }

  unregister(commandId: string, keybinding?: string): void {
    const keys = keybinding ? [normalizeKeybinding(keybinding, this.platform)] : [...this.entries.keys()];
    for (const key of keys) {
      const next = (this.entries.get(key) ?? []).filter((entry) => entry.commandId !== commandId);
      if (next.length > 0) this.entries.set(key, next); else this.entries.delete(key);
    }
  }

  getForKeybinding(keybinding: string): KeybindingDescriptor[] {
    return [...(this.entries.get(normalizeKeybinding(keybinding, this.platform)) ?? [])];
  }

  list(): KeybindingDescriptor[] {
    return [...this.entries.values()].flat().map((entry) => ({ ...entry }));
  }

  conflicts(): KeybindingConflict[] {
    return [...this.entries.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([keybinding, entries]) => ({ keybinding, entries: entries.map((entry) => ({ ...entry })) }));
  }

  resolve(event: KeyboardEvent, context: CommandRunContext): KeybindingDescriptor | undefined {
    const canonical = eventToKeybinding(event, this.platform);
    const candidates = this.entries.get(canonical) ?? [];
    return candidates.find((entry) => {
      if (!entry.allowInInput && context.scope === 'input') return false;
      return evaluateWhen(entry.when, context);
    });
  }
}

export const eventToKeybinding = (event: KeyboardEvent, platform: 'mac' | 'windows' | 'linux' = detectPlatform()): string => {
  const modifiers: string[] = [];
  if (platform === 'mac' ? event.metaKey : event.ctrlKey) modifiers.push(platform === 'mac' ? 'cmd' : 'ctrl');
  if (platform === 'mac' ? event.ctrlKey : false) modifiers.push('ctrl');
  if (event.altKey) modifiers.push('alt');
  if (event.shiftKey) modifiers.push('shift');
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key.toLowerCase();
  return [...new Set(modifiers)].sort((a, b) => MODIFIER_ORDER.indexOf(a as KeyModifier) - MODIFIER_ORDER.indexOf(b as KeyModifier)).concat(key).join('+');
};

export const evaluateWhen = (when: KeybindingDescriptor['when'] | undefined, context: CommandRunContext): boolean => {
  if (!when) return true;
  if (typeof when === 'function') return Boolean(when(context));
  return when.split(/\s*(?:&&|and)\s*/i).every((clause) => {
    const match = clause.trim().match(/^!?(\w+)(?:\s*(?:==|=)\s*["']?([^"']+)["']?)?$/);
    if (!match) return true;
    const value = context.keys?.[match[1]];
    const expected = match[2];
    const actual = expected === undefined ? Boolean(value) : String(value) === expected;
    return clause.trim().startsWith('!') ? !actual : actual;
  });
};
