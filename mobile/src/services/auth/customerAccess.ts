// Auth authentication alone cannot open personal routes. Require a trusted API projection.
export async function resolveCustomerAccess(read: (path: string) => Promise<unknown>, userId: string) {
  try {
    const value = await read('/admin/catalog/access');
    if (!value || typeof value !== 'object') throw new Error('Account access could not be verified.');
    const access=value as Record<string,unknown>;
    if(access.userId!==userId || typeof access.isCatalogAdmin!=='boolean')throw new Error('Account access could not be verified.');
    return {role:access.isCatalogAdmin ? 'admin' as const : 'user' as const, deleting:false};
  } catch(error) {
    if(error && typeof error==='object' && 'status' in error && error.status===403) {
      const value=await read('/account/deletion');
      if(value && typeof value==='object' && 'status' in value && (value.status==='deleting' || value.status==='complete'))
        return {role:'user' as const,deleting:true};
    }
    throw new Error('Your account is not ready for application access. Finish email verification, or try again when the service is available.');
  }
}
