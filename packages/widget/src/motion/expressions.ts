import type { Emotion } from '@huinuo/shared';
import type { LogicalParam } from './types';

/** 每种情绪在脸上的样子（目标值），切换时平滑过渡。 */
export const EXPRESSIONS: Record<Emotion, Partial<Record<LogicalParam, number>>> = {
  neutral: {},
  smile: { eyeLSmile: 0.6, eyeRSmile: 0.6, mouthForm: 0.8 },
  laugh: { eyeLSmile: 1, eyeRSmile: 1, eyeLOpen: 0.3, eyeROpen: 0.3, mouthForm: 1, mouthOpen: 0.6, cheek: 0.3 },
  shy: { cheek: 1, eyeLSmile: 0.4, eyeRSmile: 0.4, mouthForm: 0.3, browLY: -0.3, browRY: -0.3 },
  surprised: { eyeLOpen: 1.35, eyeROpen: 1.35, mouthOpen: 0.7, mouthForm: -0.2, browLY: 1, browRY: 1 },
  sad: { browLAngle: 0.8, browRAngle: 0.8, browLY: -0.4, browRY: -0.4, mouthForm: -0.8, eyeLOpen: 0.7, eyeROpen: 0.7 },
  cry: { browLAngle: 1, browRAngle: 1, mouthForm: -1, mouthOpen: 0.3, eyeLOpen: 0.4, eyeROpen: 0.4, tear: 1 },
  angry: { browLAngle: -1, browRAngle: -1, browLY: -0.6, browRY: -0.6, mouthForm: -0.6, cheek: 0.5 },
  confused: { browLY: 0.6, browRY: -0.3, browLForm: -0.5, mouthForm: -0.3 },
  smug: { eyeLOpen: 0.75, eyeROpen: 0.75, eyeLSmile: 0.5, eyeRSmile: 0.5, mouthForm: 1, browLY: 0.3 },
  sleepy: { eyeLOpen: 0.35, eyeROpen: 0.35, browLY: -0.4, browRY: -0.4, mouthForm: 0 },
  sparkle: { eyeLOpen: 1.25, eyeROpen: 1.25, eyeLSmile: 0.3, eyeRSmile: 0.3, mouthForm: 1, mouthOpen: 0.4, cheek: 0.4 },
};
