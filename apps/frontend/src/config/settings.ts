// F-03: runtime configuration is loaded from the API, never hard-coded in screens.
import { useQuery } from '@tanstack/react-query';
import { api, http, type Catalogue, type Settings } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { setOrganisation } from '@/lib/format';

export function useSettings() {
  const { token, isStaff } = useAuth();
  return useQuery({
    queryKey: ['settings', isStaff ? 'staff' : 'public'],
    queryFn: async () => {
      const s = isStaff && token ? await api.settings.get() : ((await http.get<Partial<Settings>>('/public/settings')) as Settings);
      if (s.organisation) setOrganisation(s.organisation);
      return s;
    },
    staleTime: 60_000,
  });
}

export function useCatalogue() {
  const { token, isStaff } = useAuth();
  return useQuery({
    queryKey: ['catalogue', isStaff ? 'staff' : 'public'],
    queryFn: () => (isStaff && token ? api.catalogue.get() : http.get<Catalogue>('/public/catalogue')),
    staleTime: 60_000,
  });
}

export function useNames() {
  const { data } = useCatalogue();
  return {
    service: (id?: string) => data?.serviceTypes.find((s) => s.id === id)?.name ?? '—',
    category: (id?: string) => (id === '*' ? 'Mixed load' : data?.categories.find((c) => c.id === id)?.name ?? '—'),
    serviceType: (id?: string) => data?.serviceTypes.find((s) => s.id === id),
  };
}
