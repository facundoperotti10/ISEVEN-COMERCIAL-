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
      period_history: {
        Row: {
          id: string;
          period_name: string;
          start_date: string;
          end_date: string;
          seller_id: string;
          seller_name: string;
          initial_sales: number;
          sales: number;
          target: number;
          bonus_usd: number;
          reached: boolean;
          consultas: number;
          respondidos: number;
          presupuestos: number;
          seguimientos: number;
          perdidos: number;
          closed_at: string;
          closed_by: string | null;
        };
        Insert: {
          id?: string;
          period_name: string;
          start_date: string;
          end_date: string;
          seller_id: string;
          seller_name: string;
          initial_sales?: number;
          sales?: number;
          target?: number;
          bonus_usd?: number;
          reached?: boolean;
          consultas?: number;
          respondidos?: number;
          presupuestos?: number;
          seguimientos?: number;
          perdidos?: number;
          closed_at?: string;
          closed_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['period_history']['Insert']>;
        Relationships: [];
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
    Functions: {
      close_period: {
        Args: { new_name: string; new_start: string; new_end: string };
        Returns: undefined;
      };
      auto_rollover_period: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
  };
}
