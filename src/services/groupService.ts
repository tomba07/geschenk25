import { apiClient } from '../lib/api';
import { Group, Invitation, Assignment } from '../types/group';
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
  async createGroup(name: string, description?: string): Promise<Group> {
    const response = await apiClient.createGroup(name, description);
    
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
};
