REVOKE EXECUTE ON FUNCTION public.owns_shop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_shop(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;