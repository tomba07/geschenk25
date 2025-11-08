import { supabase } from '../lib/supabase';
import { Group } from '../types/group';

export const groupService = {
  // Fetch all groups for the current user
  async getGroups(): Promise<Group[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    // Fetch groups where user is the creator
    // This will work if you have Row Level Security (RLS) policies set up
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching groups:', error);
      // If groups table doesn't exist or has RLS issues, return empty array
      return [];
    }

    return data || [];
  },

  // Create a new group
  async createGroup(name: string, description?: string): Promise<Group> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User must be authenticated to create a group');
    }

    const { data, error } = await supabase
      .from('groups')
      .insert([
        {
          name,
          description: description || null,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating group:', error);
      throw error;
    }

    return data;
  },

  // Get a single group by ID
  async getGroupById(groupId: string): Promise<Group | null> {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) {
      console.error('Error fetching group:', error);
      return null;
    }

    return data;
  },

  // Delete a group
  async deleteGroup(groupId: string): Promise<void> {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  },
};

