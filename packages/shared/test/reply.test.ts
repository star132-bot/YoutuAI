import { describe, expect, it } from 'vitest';
import { MOTIONS, parseAssistantReply } from '@huinuo/shared';

describe('parseAssistantReply', () => {
  it('parses a clean JSON reply', () => {
    const r = parseAssistantReply(
      '{"text":"点右上角就好啦~","emotion":"smile","motion":"point_right","highlight":"#upload"}',
    );
    expect(r).toEqual({ text: '点右上角就好啦~', emotion: 'smile', motion: 'point_right', highlight: '#upload' });
  });

  it('extracts JSON from a fenced block with chatter around it', () => {
    const r = parseAssistantReply('好的！\n```json\n{"text":"吱～{来啦}","emotion":"laugh","motion":"happy_spin"}\n```\n以上');
    expect(r.text).toBe('吱～{来啦}');
    expect(r.motion).toBe('happy_spin');
  });

  it('falls back to a valid motion when the model invents one', () => {
    const r = parseAssistantReply('{"text":"哼！","emotion":"angry","motion":"backflip"}');
    expect(r.emotion).toBe('angry');
    expect(r.motion).toBe('angry_puff');
  });

  it('infers emotion from plain text when there is no JSON', () => {
    const r = parseAssistantReply('哈哈，你真有趣');
    expect(r.emotion).toBe('laugh');
    expect(MOTIONS).toContain(r.motion);
  });

  it('ignores empty highlight', () => {
    const r = parseAssistantReply('{"text":"hi","emotion":"smile","motion":"talk","highlight":"  "}');
    expect(r.highlight).toBeUndefined();
  });
});
