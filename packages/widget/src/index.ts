import { HuinuoAssistant } from './element';

export { HuinuoAssistant };
export { MOTION_LIBRARY } from './motion/library';
export { PROFILES, STANDARD_PROFILE, HARU_PROFILE } from './motion/profiles';
export { toMotion3Json } from './motion/export';
export { MOTIONS, EMOTIONS } from '@huinuo/shared';

if (!customElements.get('huinuo-assistant')) {
  customElements.define('huinuo-assistant', HuinuoAssistant);
}
