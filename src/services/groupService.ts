import { apiClient } from '../lib/api';
import { Group, Invitation, Assignment, GiftIdea } from '../types/group';
import { AppError, ErrorType, parseError, logError } from '../utils/errors';

export class GroupServiceError extends Error {
  appError: AppError;

  constructor(appError: AppError) {
    super(appError.userMessage);
    this.name = 'GroupServiceError';
    this.appError = appError;
  }
}

export const groupService = {
  // Fetch all groups for the current user
  async getGroups(): Promise<Group[]> {
    const response = await apiClient.getGroups();
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.getGroups');
      // Return empty array for non-critical errors (network issues, etc.)
      // This allows the UI to still render, showing an empty state
      return [];
    }

    return response.data?.groups || [];
  },

  // Create a new group
  async createGroup(name: string, description?: string, imageUrl?: string): Promise<Group> {
    const response = await apiClient.createGroup(name, description, imageUrl);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.createGroup');
      throw new GroupServiceError(appError);
    }

    if (!response.data?.group) {
      const appError: AppError = {
        type: ErrorType.API,
        message: 'No group data returned',
        userMessage: 'Failed to create group. Please try again.',
      };
      logError(appError, 'groupService.createGroup');
      throw new GroupServiceError(appError);
    }

    return response.data.group;
  },

  // Get a single group by ID
  async getGroupById(groupId: string): Promise<Group | null> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.getGroupById');
      return null;
    }

    const response = await apiClient.getGroup(id);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.getGroupById');
      // Return null for not found errors, but log other errors
      if (appError.type === ErrorType.NOT_FOUND) {
        return null;
      }
      // For other errors, still return null but log them
      return null;
    }

    return response.data?.group || null;
  },

  // Update a group
  async updateGroup(groupId: string, imageUrl?: string): Promise<Group> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.updateGroup');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.updateGroup(id, imageUrl);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.updateGroup');
      throw new GroupServiceError(appError);
    }

    if (!response.data?.group) {
      const appError: AppError = {
        type: ErrorType.API,
        message: 'No group data returned',
        userMessage: 'Failed to update group. Please try again.',
      };
      logError(appError, 'groupService.updateGroup');
      throw new GroupServiceError(appError);
    }

    return response.data.group;
  },

  // Delete a group
  async deleteGroup(groupId: string): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.deleteGroup');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.deleteGroup(id);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.deleteGroup');
      throw new GroupServiceError(appError);
    }
  },

  // Invite user to group
  async inviteUser(groupId: string, username: string): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.inviteUser');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.inviteUserToGroup(id, username);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.inviteUser');
      throw new GroupServiceError(appError);
    }
  },

  // Get pending invitations
  async getPendingInvitations(): Promise<Invitation[]> {
    const response = await apiClient.getPendingInvitations();
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.getPendingInvitations');
      // Return empty array for non-critical errors
      return [];
    }

    return response.data?.invitations || [];
  },

  // Accept invitation
  async acceptInvitation(invitationId: number): Promise<void> {
    const response = await apiClient.acceptInvitation(invitationId);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.acceptInvitation');
      throw new GroupServiceError(appError);
    }
  },

  // Reject invitation
  async rejectInvitation(invitationId: number): Promise<void> {
    const response = await apiClient.rejectInvitation(invitationId);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.rejectInvitation');
      throw new GroupServiceError(appError);
    }
  },

  // Cancel pending invitation (group owner only)
  async cancelInvitation(groupId: string, invitationId: number): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.cancelInvitation');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.cancelInvitation(id, invitationId);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.cancelInvitation');
      throw new GroupServiceError(appError);
    }
  },

  // Leave group (member can leave, but owner cannot)
  async leaveGroup(groupId: string): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.leaveGroup');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.leaveGroup(id);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.leaveGroup');
      throw new GroupServiceError(appError);
    }
  },

  // Remove member from group
  async removeMember(groupId: string, userId: number): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.removeMember');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.removeMember(id, userId);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.removeMember');
      throw new GroupServiceError(appError);
    }
  },

  // Assign Secret Santa pairs
  async assignSecretSanta(groupId: string): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.assignSecretSanta');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.assignSecretSanta(id);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.assignSecretSanta');
      throw new GroupServiceError(appError);
    }
  },

  // Get current user's assignment
  async getAssignment(groupId: string): Promise<Assignment | null> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.getAssignment');
      return null;
    }

    const response = await apiClient.getAssignment(id);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.getAssignment');
      // Return null for not found or other errors
      return null;
    }

    return response.data?.assignment || null;
  },

  // Delete all assignments for a group (undo assignments)
  async deleteAssignments(groupId: string): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.deleteAssignments');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.deleteAssignments(id);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.deleteAssignments');
      throw new GroupServiceError(appError);
    }
  },

  // Create gift idea
  async createGiftIdea(groupId: string, forUserId: number, idea: string, link?: string): Promise<GiftIdea> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.createGiftIdea');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.createGiftIdea(id, forUserId, idea, link);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.createGiftIdea');
      throw new GroupServiceError(appError);
    }

    if (!response.data?.gift_idea) {
      const appError: AppError = {
        type: ErrorType.API,
        message: 'No gift idea data returned',
        userMessage: 'Failed to create gift idea. Please try again.',
      };
      logError(appError, 'groupService.createGiftIdea');
      throw new GroupServiceError(appError);
    }

    return response.data.gift_idea;
  },

  // Get gift ideas
  async getGiftIdeas(groupId: string, forUserId?: number): Promise<GiftIdea[]> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.getGiftIdeas');
      return [];
    }

    const response = await apiClient.getGiftIdeas(id, forUserId);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.getGiftIdeas');
      return [];
    }

    return response.data?.gift_ideas || [];
  },

  // Update gift idea
  async updateGiftIdea(groupId: string, ideaId: number, idea: string, link?: string): Promise<GiftIdea> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.updateGiftIdea');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.updateGiftIdea(id, ideaId, idea, link);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.updateGiftIdea');
      throw new GroupServiceError(appError);
    }

    if (!response.data?.gift_idea) {
      const appError: AppError = {
        type: ErrorType.API,
        message: 'No gift idea data returned',
        userMessage: 'Failed to update gift idea. Please try again.',
      };
      logError(appError, 'groupService.updateGiftIdea');
      throw new GroupServiceError(appError);
    }

    return response.data.gift_idea;
  },

  // Delete gift idea
  async deleteGiftIdea(groupId: string, ideaId: number): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      const appError: AppError = {
        type: ErrorType.VALIDATION,
        message: `Invalid group ID: ${groupId}`,
        userMessage: 'Invalid group ID',
      };
      logError(appError, 'groupService.deleteGiftIdea');
      throw new GroupServiceError(appError);
    }

    const response = await apiClient.deleteGiftIdea(id, ideaId);
    
    if (response.error) {
      const appError = response.appError || parseError(response.error);
      logError(appError, 'groupService.deleteGiftIdea');
      throw new GroupServiceError(appError);
    }
  },
};
