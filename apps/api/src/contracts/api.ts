export interface ApiUserDto {
  id: number;
  email: string;
  username?: string | null;
  image_url?: string | null;
  profile_complete?: boolean;
}

export interface SearchUserDto {
  id: number;
  username: string;
  image_url?: string | null;
}

export interface FriendDto {
  id: number;
  username: string;
  image_url?: string | null;
  created_at?: string;
}

export interface FriendSearchResultDto extends SearchUserDto {
  friendship_status: 'none' | 'friend' | 'incoming_pending' | 'outgoing_pending';
}

export interface FriendRequestDto {
  id: number;
  user_id: number;
  username: string;
  image_url?: string | null;
  created_at: string;
}

export interface GroupMemberDto {
  id: number;
  username: string;
  image_url?: string | null;
  joined_at: string;
}

export interface GroupOwnerDto {
  id: number;
  username: string;
  image_url?: string | null;
}

export interface GroupDto {
  id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  created_at: string;
  created_by: number;
  member_count?: number;
  assignments_created?: boolean;
  members?: GroupMemberDto[];
  owner?: GroupOwnerDto;
}

export interface AssignmentDto {
  receiver_id: number;
  receiver_username: string;
  receiver_image_url?: string | null;
  created_at?: string;
}

export interface AssignmentPairDto {
  giver_id: number;
  receiver_id: number;
  giver_username: string;
  receiver_username: string;
}

export interface GiftIdeaUserDto {
  id: number;
  username: string;
}

export interface GiftIdeaDto {
  id: number;
  group_id: number;
  for_user_id: number;
  created_by_id: number;
  idea: string;
  link?: string | null;
  created_at: string;
  updated_at: string;
  created_by: GiftIdeaUserDto;
  for_user: GiftIdeaUserDto;
}

export interface AssignmentChatDto {
  id: number;
  assignment_id: number;
  group_id: number;
  role: 'giver' | 'receiver';
  title: string;
  subtitle: string;
  receiver_id?: number;
  receiver_username?: string;
  created_at?: string;
}

export interface AssignmentChatMessageDto {
  id: number;
  assignment_id: number;
  body: string;
  created_at: string;
  sent_by_me: boolean;
  sender_label: string;
  sender_role: 'me' | 'secret_santa' | 'receiver';
}

export interface DevUserDto {
  id: number;
  email: string;
  username: string;
  is_test_account?: boolean;
  image_url?: string | null;
  created_at?: string;
}

export interface DevTestAccountDto {
  id?: number;
  email: string;
  username: string;
  password: string;
  image_url?: string | null;
}

export interface DevGroupMemberDto extends DevUserDto {
  joined_at: string;
  role: 'owner' | 'member';
}

export interface DevGiftIdeaDto {
  id: number;
  group_id: number;
  for_user_id: number;
  created_by_id: number;
  idea: string;
  link?: string | null;
  created_at: string;
  updated_at: string;
  created_by_username: string;
  for_user_username: string;
}

export interface DevGroupDto {
  id: number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  created_at: string;
  created_by: number;
  owner_username: string;
  member_count: number;
  members: DevGroupMemberDto[];
  assignments: AssignmentPairDto[];
  gift_ideas: DevGiftIdeaDto[];
}

export interface DevStateDto {
  users: DevUserDto[];
  groups: DevGroupDto[];
  test_accounts: DevTestAccountDto[];
}

export interface MessageResponse {
  message: string;
}

export interface AuthSessionResponse {
  token: string;
  user: ApiUserDto;
}

export interface UserResponse {
  user: ApiUserDto;
}

export interface SearchUsersResponse {
  users: SearchUserDto[];
}

export interface AuthEmailLinkResponse extends MessageResponse {
  expires_in_minutes: number;
  devMagicLink?: string;
}

export interface PasswordResetRequestResponse extends MessageResponse {
  expires_in_minutes: number;
  devPasswordResetLink?: string;
}

export interface GroupsResponse {
  groups: GroupDto[];
}

export interface GroupResponse {
  group: GroupDto;
}

export interface InviteLinkResponse {
  invite_token: string;
}

export interface JoinGroupResponse extends MessageResponse {
  group_id: number;
}

export interface AssignmentResponse {
  assignment: AssignmentDto | null;
}

export interface AssignmentsResponse {
  assignments: AssignmentPairDto[];
}

export interface GiftIdeaResponse {
  gift_idea: GiftIdeaDto;
}

export interface GiftIdeasResponse {
  gift_ideas: GiftIdeaDto[];
}

export interface AssignmentChatsResponse {
  chats: AssignmentChatDto[];
}

export interface AssignmentChatMessagesResponse {
  messages: AssignmentChatMessageDto[];
}

export interface AssignmentChatMessageResponse {
  message: AssignmentChatMessageDto;
}

export interface FriendsResponse {
  friends: FriendDto[];
}

export interface FriendRequestsResponse {
  incoming: FriendRequestDto[];
  outgoing: FriendRequestDto[];
}

export interface FriendSearchResponse {
  users: FriendSearchResultDto[];
}

export interface FriendInviteResponse {
  user: FriendDto;
}

export interface JoinFriendResponse extends MessageResponse {
  friend_id: number;
}

export interface NotificationConfigResponse {
  enabled: boolean;
  publicKey: string | null;
}

export interface NotificationPreferencesResponse {
  email_enabled: boolean;
}
