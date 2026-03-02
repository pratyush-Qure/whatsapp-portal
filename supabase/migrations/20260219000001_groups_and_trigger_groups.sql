-- Groups (per project): reusable recipient lists
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, slug)
);
CREATE INDEX idx_groups_project_id ON public.groups(project_id);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view groups" ON public.groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage groups" ON public.groups FOR ALL USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Group members (phone numbers in a group)
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, phone)
);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view group members" ON public.group_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage group members" ON public.group_members FOR ALL USING (auth.uid() IS NOT NULL);

-- Trigger–group mapping (many-to-many): which triggers send to which groups
CREATE TABLE public.trigger_groups (
  trigger_id UUID NOT NULL REFERENCES public.triggers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (trigger_id, group_id)
);
CREATE INDEX idx_trigger_groups_trigger_id ON public.trigger_groups(trigger_id);
CREATE INDEX idx_trigger_groups_group_id ON public.trigger_groups(group_id);
ALTER TABLE public.trigger_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view trigger_groups" ON public.trigger_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage trigger_groups" ON public.trigger_groups FOR ALL USING (auth.uid() IS NOT NULL);
