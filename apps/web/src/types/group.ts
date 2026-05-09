export interface GroupMember {
  id: number;
  username: string;
  image_url?: string | null;
  joined_at: string;
}

export interface GroupOwner {
  id: number;
  username: string;
  image_url?: string | null;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  image_url?: string | null;
  created_at: string;
  created_by: number;
  member_count?: number;
  members?: GroupMember[];
  owner?: GroupOwner;
}

export interface Assignment {
  receiver_id: number;
  receiver_username: string;
  receiver_image_url?: string | null;
  created_at?: string;
}

export interface GiftIdeaUser {
  id: number;
  username: string;
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
