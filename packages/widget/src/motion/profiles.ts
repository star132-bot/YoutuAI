import type { ModelProfile } from './types';

const std = (id: string, scale = 1) => ({ ids: [id], scale });

/**
 * Live2D 标准参数 ID（Cubism 官方命名）。
 * 灰糯原创模型请按这套命名绑定，就能直接使用全部动作。
 */
export const STANDARD_PROFILE: ModelProfile = {
  name: 'standard',
  params: {
    angleX: std('ParamAngleX'),
    angleY: std('ParamAngleY'),
    angleZ: std('ParamAngleZ'),
    bodyX: std('ParamBodyAngleX'),
    bodyY: std('ParamBodyAngleY'),
    bodyZ: std('ParamBodyAngleZ'),
    eyeLOpen: std('ParamEyeLOpen'),
    eyeROpen: std('ParamEyeROpen'),
    eyeLSmile: std('ParamEyeLSmile'),
    eyeRSmile: std('ParamEyeRSmile'),
    eyeBallX: std('ParamEyeBallX'),
    eyeBallY: std('ParamEyeBallY'),
    browLY: std('ParamBrowLY'),
    browRY: std('ParamBrowRY'),
    browLAngle: std('ParamBrowLAngle'),
    browRAngle: std('ParamBrowRAngle'),
    browLForm: std('ParamBrowLForm'),
    browRForm: std('ParamBrowRForm'),
    mouthForm: std('ParamMouthForm'),
    mouthOpen: std('ParamMouthOpenY'),
    cheek: std('ParamCheek'),
    tear: std('ParamTear'),
    armL: std('ParamArmLA'),
    armR: std('ParamArmRA'),
    forearmL: std('ParamArmLB'),
    forearmR: std('ParamArmRB'),
    handL: std('ParamHandL'),
    handR: std('ParamHandR'),
  },
};

/** 开发期占位：Live2D 官方示例模型 Haru */
export const HARU_PROFILE: ModelProfile = {
  name: 'haru',
  params: {
    ...STANDARD_PROFILE.params,
    cheek: { ids: ['ParamTere', 'ParamCheek'] },
    // Haru 有两套手臂：A（双手交握，默认）和 B（ParamArmB 0=抱臂 → 5=双手举起）。
    // 抬手类动作切换到 B 套，并把 0~1 映射到 2~5。
    armL: { ids: ['ParamArmLB'], scale: 3, offset: 2, parts: { show: ['Part01ArmLB001'], hide: ['Part01ArmLA001'] } },
    armR: { ids: ['ParamArmRB'], scale: 3, offset: 2, parts: { show: ['Part01ArmRB001'], hide: ['Part01ArmRA001'] } },
    forearmL: undefined,
    forearmR: undefined,
    handL: { ids: ['ParamHandAngleL'] },
    handR: { ids: ['ParamHandAngleR'] },
  },
};

export const PROFILES: Record<string, ModelProfile> = {
  standard: STANDARD_PROFILE,
  haru: HARU_PROFILE,
};
