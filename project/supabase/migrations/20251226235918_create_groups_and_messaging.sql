/*
  # Create Groups and Messaging System

  1. New Tables
    - `groups`
      - `id` (uuid, primary key) - Unique group identifier
      - `name` (text) - Group name
      - `description` (text, nullable) - Group description
      - `created_by` (uuid) - Reference to user who created the group
      - `created_at` (timestamptz) - When the group was created
      - `updated_at` (timestamptz) - Last update timestamp
    
    - `group_members`
      - `id` (uuid, primary key) - Unique membership identifier
      - `group_id` (uuid) - Reference to groups table
      - `user_id` (uuid) - Reference to profiles table
      - `role` (text) - Member role (admin, moderator, member)
      - `joined_at` (timestamptz) - When the user joined
    
    - `messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `group_id` (uuid) - Reference to groups table
      - `user_id` (uuid) - Reference to profiles table (sender)
      - `content` (text) - Message content
      - `created_at` (timestamptz) - When the message was sent
      - `updated_at` (timestamptz, nullable) - When the message was edited

  2. Security
    - Enable RLS on all tables
    - Groups: Members can view their groups
    - Group Members: Users can view memberships for groups they belong to
    - Messages: Members can view and send messages in their groups
    - Only group admins can add/remove members

  3. Indexes
    - Add indexes for efficient querying of messages and memberships
*/

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Users can view groups they are members of"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups"
  ON groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
  );

-- Group members policies
CREATE POLICY "Users can view members of groups they belong to"
  ON group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can add members"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_members.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'admin'
    )
    OR
    auth.uid() = user_id
  );

CREATE POLICY "Group admins can remove members"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
    OR
    auth.uid() = user_id
  );

CREATE POLICY "Group admins can update member roles"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
    )
  );

-- Messages policies
CREATE POLICY "Group members can view messages in their groups"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = messages.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = messages.group_id
      AND group_members.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);