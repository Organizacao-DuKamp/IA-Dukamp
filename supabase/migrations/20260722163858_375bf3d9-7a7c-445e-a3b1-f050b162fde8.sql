
CREATE OR REPLACE FUNCTION public.auto_promote_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email = 'dukamp@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.auto_promote_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auto_promote_owner_trg ON auth.users;
CREATE TRIGGER auto_promote_owner_trg
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_promote_owner();
