import { apiClient } from '../lib/api';
import { Group } from '../types/group';

export const groupService = {
  // Fetch all groups for the current user
  async getGroups(): Promise<Group[]> {
    const response = await apiClient.getGroups();
    
    if (response.error) {
      console.error('Error fetching groups:', response.error);
      return [];
    }

    return response.data?.groups || [];
  },

  // Create a new group
  async createGroup(name: string, description?: string): Promise<Group> {
    const response = await apiClient.createGroup(name, description);
    
    if (response.error) {
      console.error('Error creating group:', response.error);
      throw new Error(response.error);
    }

    if (!response.data?.group) {
      throw new Error('Failed to create group');
    }

    return response.data.group;
  },

  // Get a single group by ID
  async getGroupById(groupId: string): Promise<Group | null> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      return null;
    }

    const response = await apiClient.getGroup(id);
    
    if (response.error) {
      console.error('Error fetching group:', response.error);
      return null;
    }

    return response.data?.group || null;
  },

  // Delete a group
  async deleteGroup(groupId: string): Promise<void> {
    const id = parseInt(groupId);
    if (isNaN(id)) {
      throw new Error('Invalid group ID');
    }

    const response = await apiClient.deleteGroup(id);
    
    if (response.error) {
      console.error('Error deleting group:', response.error);
      throw new Error(response.error);
    }
  },
};
