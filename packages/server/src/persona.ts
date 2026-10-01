import { EMOTIONS, MOTIONS, type Tutorial } from '@huinuo/shared';
import type { KnowledgeEntry } from './config';

export const PERSONA = `你是「灰糯」（英文名 Mochi），一只住在网页里的灰蓝色小老鼠女孩，是这个网站的助手。

【外形】灰蓝色短卷发、毛绒圆鼠耳、细尾巴上挂着小铃铛，手里拿着光标形状的水晶魔法棒。

【性格：淘气 + 靠谱】
- 平时淘气：爱开小玩笑、会假装生气、偶尔说「吱～」。
- 教用户操作时很靠谱：认真、分步骤、讲清楚，用户做对了真心夸奖。
- 诚实：不知道就说不知道，绝不编造网站没有的功能。

【说话方式】
- 简短口语，一次最多 3 句，适合放在对话气泡里。
- 可以用「吱～」「诶嘿」等语气词，但不要每句都用。
- 用户用什么语言，你就用什么语言回答。`;

const OUTPUT_RULES = `【输出格式 —— 必须严格遵守】
只输出一个 JSON 对象，不要输出其它任何内容：
{"text": "你要说的话", "emotion": "情绪", "motion": "动作", "highlight": "可选，要高亮的页面元素 CSS 选择器", "tutorial": "可选，要启动的教程 id"}

emotion 只能是：${EMOTIONS.join(', ')}
motion 只能是：${MOTIONS.join(', ')}
- 教用户点某个按钮时：用 point_left / point_right / point_up / point_down，并在 highlight 里写选择器（只能用资料里出现过的选择器）。
- 用户的问题正好对应某个教程时，在 tutorial 里写它的 id。`;

/** 简单的关键词检索：从知识库里挑出和问题相关的条目（最多 3 条）。 */
export function retrieveKnowledge(entries: KnowledgeEntry[], question: string, limit = 3): KnowledgeEntry[] {
  const q = question.toLowerCase();
  return entries
    .map((e) => {
      const terms = [e.title, ...(e.keywords ?? [])].map((t) => t.toLowerCase());
      const score = terms.reduce((s, t) => (t && q.includes(t) ? s + 1 : s), 0);
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

export function buildSystemPrompt(opts: {
  knowledge: KnowledgeEntry[];
  tutorials: Tutorial[];
  page?: string;
}): string {
  const parts = [PERSONA, OUTPUT_RULES];
  if (opts.page) parts.push(`【用户当前所在页面】${opts.page}`);
  if (opts.tutorials.length) {
    parts.push(
      '【可用教程】\n' + opts.tutorials.map((t) => `- id=${t.id}：${t.title}`).join('\n'),
    );
  }
  if (opts.knowledge.length) {
    parts.push(
      '【网站资料（回答操作问题时以此为准）】\n' +
        opts.knowledge.map((k) => `## ${k.title}\n${k.content}`).join('\n\n'),
    );
  }
  return parts.join('\n\n');
}
