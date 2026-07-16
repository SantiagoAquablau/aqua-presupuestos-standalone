CREATE OR REPLACE FUNCTION public.list_comercials()
RETURNS TABLE(id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE COALESCE(p.active, true) = true
  ORDER BY p.full_name NULLS LAST, p.email;
$$;

GRANT EXECUTE ON FUNCTION public.list_comercials() TO authenticated;