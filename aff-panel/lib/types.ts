export type VipApplicationStatus = "pending_review" | "approved" | "rejected";

export type VipApplication = {
  id: string;
  telegram_user_id: number;
  username: string | null;
  region: string;
  brand_slug: string;
  brand_name: string;
  player_id: string;
  deposit_claimed: boolean;
  status: VipApplicationStatus;
  created_at: string;
  updated_at: string;
  reject_reason?: string | null;
  reviewed_at?: string | null;
  approval_message_sent?: string | null;
};

export type VipStore = {
  applications: VipApplication[];
};

export type VipSettings = {
  approvalMessageTemplate: string;
  defaultVipLink: string;
  rejectMessagePrefix: string;
};

export const DEFAULT_SETTINGS: VipSettings = {
  approvalMessageTemplate:
    "✅ Your VIP application has been approved!\n\n" +
    "Site: {brand}\nPlayer ID: {player_id}\n\n" +
    "Access your VIP here:\n{vip_link}\n\n" +
    "Welcome to RankWagers VIP.",
  defaultVipLink: "https://rankwagers.com/en",
  rejectMessagePrefix:
    "❌ Your VIP application could not be approved at this time.",
};
