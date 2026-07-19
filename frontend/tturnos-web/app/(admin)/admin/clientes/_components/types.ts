export interface Customer {
  id: number;
  phone: string;
  name: string;
  email?: string;
  notes?: string;
  birthday?: string | null;
  instagram?: string | null;
  favoriteProfessionalId?: number | null;
  favoriteProfessionalName?: string | null;
  photoUrls?: string | null;
  createdAt: string;
}
