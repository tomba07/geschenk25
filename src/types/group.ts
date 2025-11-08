export interface GroupMember {
  id: number;
  username: string;
  joined_at: string;
}

export interface GroupOwner {
  id: number;
  username: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  created_by: number;
  members?: GroupMember[];
  owner?: GroupOwner;
}

export interface Invitation {
  id: number;
  group_id: number;
  inviter_id: number;
  created_at: string;
  group_name: string;
  group_description?: string;
  inviter_username: string;
}

