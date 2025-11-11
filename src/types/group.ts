export interface GroupMember {
  id: number;
  username: string;
  display_name: string;
  joined_at: string;
}

export interface GroupOwner {
  id: number;
  username: string;
  display_name: string;
}

export interface PendingInvitation {
  id: number;
  username: string;
  display_name: string;
  invitation_id: number;
  invited_at: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  created_by: number;
  members?: GroupMember[];
  owner?: GroupOwner;
  pending_invitations?: PendingInvitation[];
}

export interface Invitation {
  id: number;
  group_id: number;
  inviter_id: number;
  created_at: string;
  group_name: string;
  group_description?: string;
  inviter_username: string;
  inviter_display_name: string;
}

export interface Assignment {
  receiver_id: number;
  receiver_username: string;
  receiver_display_name: string;
}

export interface GiftIdeaUser {
  id: number;
  username: string;
  display_name: string;
}

export interface GiftIdea {
  id: number;
  group_id: number;
  for_user_id: number;
  created_by_id: number;
  idea: string;
  link?: string | null;
  created_at: string;
  updated_at: string;
  created_by: GiftIdeaUser;
  for_user: GiftIdeaUser;
}

