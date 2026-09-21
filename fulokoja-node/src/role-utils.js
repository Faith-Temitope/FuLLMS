export function resolveUserRole(user, profileRole = null) {
  return user?.app_metadata?.role ?? user?.user_metadata?.role ?? profileRole ?? null;
}

export function hasAnyRole(user, profileRole = null, roles = []) {
  const role = resolveUserRole(user, profileRole);
  return Boolean(role) && roles.includes(role);
}
