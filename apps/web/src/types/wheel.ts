export type WheelCampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "archived";

export type WheelTheme = {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  neutral?: string;
};

export type WheelRules = {
  couponExpireDays?: number;
  minOrderTry?: number | string;
  oneSpinPerDevice?: boolean;
  oneSpinPerEmail?: boolean;
  oneSpinPerPhone?: boolean;
  oneSpinPerUser?: boolean;
  requireConsent?: boolean;
  requireLogin?: boolean;
};

export type WheelUi = {
  bgImage?: string;
  buttonLabel?: string;
  headline?: string;
  subheadline?: string;
};

export type WheelCampaignDoc = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  heroTitle?: string;
  heroText?: string;
  buttonLabel?: string;
  popupEnabled: boolean;
  isActive: boolean;
  status: WheelCampaignStatus | string;
  startsAt?: any;
  endsAt?: any;
  requireConsent?: boolean;
  requirePhone?: boolean;
  requireEmail?: boolean;
  requireLogin?: boolean;
  maxSpinsPerUser?: number;
  cooldownHours?: number;
  published?: boolean;
  ui?: WheelUi;
  rules?: WheelRules;
  wheelTheme?: WheelTheme;
};

export type WheelRewardType =
  | "percent"
  | "fixed"
  | "free_shipping"
  | "gift"
  | "teaser";

export type WheelRewardDoc = {
  id: string;
  campaignId: string;
  label: string;
  rewardType: WheelRewardType;
  value: number;
  probabilityWeight: number;
  isActive: boolean;
  isVisibleOnWheel: boolean;
  isWinnable: boolean;
  color?: string;
  sortOrder?: number;
  couponPrefix?: string;
  couponDurationDays?: number;
  singleUse?: boolean;
  minCartAmount?: number;

  createdAt?: any;
  updatedAt?: any;
};