export type ContactEstado =
  | 'consulta'
  | 'respondio'
  | 'presupuesto'
  | 'seguimiento'
  | 'vendido'
  | 'perdido';

export type UserRole = 'admin' | 'seller';

export interface Database {
  public: {
    Tables: {
      sellers: {
        Row: {
          id: string;
          name: string;
          target: number;
          initial_sales: number;
          bonus_usd: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          target?: number;
          initial_sales?: number;
          bonus_usd?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          target?: number;
          initial_sales?: number;
          bonus_usd?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      period: {
        Row: {
          id: number;
          name: string;
          start_date: string;
          end_date: string;
        };
        Insert: {
          id?: number;
          name: string;
          start_date: string;
          end_date: string;
        };
        Update: {
          id?: number;
          name?: string;
          start_date?: string;
          end_date?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          seller_id: string;
          date: string;
          nombre: string;
          telefono: string | null;
          estado: ContactEstado;
          observacion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          date?: string;
          nombre: string;
          telefono?: string | null;
          estado?: ContactEstado;
          observacion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          date?: string;
          nombre?: string;
          telefono?: string | null;
          estado?: ContactEstado;
          observacion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_seller_id_fkey';
            columns: ['seller_id'];
            isOneToOne: false;
            referencedRelation: 'sellers';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          seller_id: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          seller_id?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          seller_id?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_seller_id_fkey';
            columns: ['seller_id'];
            isOneToOne: false;
            referencedRelation: 'sellers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
