export type ContactEstado =
  | 'consulta'
  | 'respondio'
  | 'presupuesto'
  | 'seguimiento'
  | 'vendido'
  | 'perdido';

export type UserRole = 'admin' | 'seller';

export type StaffArea = 'minorista' | 'mayorista' | 'marketing' | 'tecnico';
export type ClockKind = 'entrada' | 'salida_comida' | 'vuelta_comida' | 'salida';
export type StockStatus = 'pendiente' | 'autorizado' | 'rechazado' | 'entregado';
export type TripSlot = '10:00' | '15:00' | 'urgente';

type Rel = [];
type TableOf<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: Rel };

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
          fuente: string | null;
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
          fuente?: string | null;
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
          fuente?: string | null;
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
          staff_id: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          staff_id?: string | null;
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
      staff: TableOf<
        {
          id: string;
          name: string;
          full_name: string;
          area: StaffArea;
          role_label: string;
          is_manager: boolean;
          seller_id: string | null;
          start_time: string;
          pin_set: boolean;
          active: boolean;
          sort: number;
          created_at: string;
        },
        {
          id: string;
          name: string;
          full_name: string;
          area: StaffArea;
          role_label: string;
          is_manager?: boolean;
          seller_id?: string | null;
          start_time?: string;
          active?: boolean;
          sort?: number;
        }
      >;
      clock_events: TableOf<
        {
          id: string;
          staff_id: string;
          kind: ClockKind;
          at: string;
          work_date: string;
          late_minutes: number;
          photo_path: string | null;
          device_id: string | null;
          manual: boolean;
          note: string | null;
          created_by: string | null;
          created_at: string;
        },
        {
          staff_id: string;
          kind: ClockKind;
          at?: string;
          work_date: string;
          late_minutes?: number;
          photo_path?: string | null;
          manual?: boolean;
          note?: string | null;
          created_by?: string | null;
        }
      >;
      kiosk_devices: TableOf<
        { id: string; name: string; active: boolean; created_at: string; created_by: string | null },
        { name: string; active?: boolean }
      >;
      task_templates: TableOf<
        { id: string; staff_id: string; title: string; sort: number; active: boolean; created_at: string },
        { staff_id: string; title: string; sort?: number; active?: boolean }
      >;
      tasks: TableOf<
        {
          id: string;
          staff_id: string;
          date: string;
          title: string;
          source: 'fija' | 'extra';
          template_id: string | null;
          done_at: string | null;
          created_by: string | null;
          created_at: string;
        },
        {
          staff_id: string;
          date: string;
          title: string;
          source?: 'fija' | 'extra';
          template_id?: string | null;
          done_at?: string | null;
        }
      >;
      stock_requests: TableOf<
        {
          id: string;
          staff_id: string;
          cliente: string;
          turno_date: string;
          turno_time: string | null;
          modelo: string;
          capacidad: string | null;
          color: string | null;
          tipo: 'venta' | 'mostrar';
          urgent: boolean;
          trip_date: string;
          trip_slot: TripSlot;
          status: StockStatus;
          note: string | null;
          decided_by: string | null;
          decided_at: string | null;
          imei: string | null;
          group_id: string | null;
          created_at: string;
        },
        {
          staff_id: string;
          cliente: string;
          turno_date: string;
          turno_time?: string | null;
          modelo: string;
          capacidad?: string | null;
          color?: string | null;
          tipo?: 'venta' | 'mostrar';
          urgent?: boolean;
          trip_date?: string;
          trip_slot?: TripSlot;
          status?: StockStatus;
          note?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          imei?: string | null;
          group_id?: string | null;
        }
      >;
      push_subscriptions: TableOf<
        { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at: string },
        { endpoint: string; p256dh: string; auth: string; user_id?: string }
      >;
      saturday_shifts: TableOf<
        { id: string; staff_id: string; date: string; start_time: string; end_time: string; note: string | null; created_at: string },
        { staff_id: string; date: string; start_time?: string; end_time?: string; note?: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      register_kiosk: { Args: { p_name: string }; Returns: string };
      set_staff_pin: { Args: { p_staff: string; p_pin: string }; Returns: undefined };
      kiosk_board: { Args: { p_token: string }; Returns: unknown };
      kiosk_punch: {
        Args: { p_token: string; p_staff: string; p_pin: string; p_kind: string; p_photo: string };
        Returns: unknown;
      };
      ensure_tasks: { Args: { p_date?: string }; Returns: undefined };
      office_live: { Args: Record<string, never>; Returns: unknown };
      push_targets_for_stock: { Args: { p_id: string }; Returns: unknown };
      push_drop: { Args: { p_endpoint: string }; Returns: undefined };
      close_period: {
        Args: { new_name: string; new_start: string; new_end: string };
        Returns: undefined;
      };
      auto_rollover_period: {
        Args: Record<string, never>;
        Returns: number;
      };
      team_ranking: {
        Args: Record<string, never>;
        Returns: {
          seller_id: string;
          seller_name: string;
          sales: number;
          target: number;
          consultas: number;
          respondidos: number;
          ventas: number;
        }[];
      };
    };
  };
}
