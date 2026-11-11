// Auto-generated from the Supabase schema (project: agentos / jugrekehmwxgumffecsz).
// Regenerate via Supabase MCP (generate_typescript_types) after schema changes.
// Do not hand-edit -- domain-facing types live in src/types.ts instead.
//
// EXCEPTION: `profiles.approved` and `profiles.role` below were hand-added
// (no live DB/MCP access to regenerate this file at the time). Matches
// backend/sql/001_agent_approval.sql and 002_admin_role.sql. Re-run the
// generator once MCP is connected and this note can go away.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          id: string
          occurred_at: string
          owner_id: string
          text: string
        }
        Insert: {
          id?: string
          occurred_at?: string
          owner_id: string
          text: string
        }
        Update: {
          id?: string
          occurred_at?: string
          owner_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "activity_log_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          deleted: boolean
          id: string
          last_contact: string | null
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted?: boolean
          id?: string
          last_contact?: string | null
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted?: boolean
          id?: string
          last_contact?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          client_id: string | null
          converted: boolean
          created_at: string
          id: string
          inquiry_date: string
          listing_ref_id: string | null
          listing_ref_label: string | null
          listing_ref_type: string | null
          note: string | null
          owner_id: string
          phone: string
          property_id: string | null
        }
        Insert: {
          client_id?: string | null
          converted?: boolean
          created_at?: string
          id?: string
          inquiry_date?: string
          listing_ref_id?: string | null
          listing_ref_label?: string | null
          listing_ref_type?: string | null
          note?: string | null
          owner_id: string
          phone: string
          property_id?: string | null
        }
        Update: {
          client_id?: string | null
          converted?: boolean
          created_at?: string
          id?: string
          inquiry_date?: string
          listing_ref_id?: string | null
          listing_ref_label?: string | null
          listing_ref_type?: string | null
          note?: string | null
          owner_id?: string
          phone?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "inquiries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string | null
          approved: boolean
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string
          trial_status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string
          phone?: string | null
          role?: string
          trial_status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          approved?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string
          trial_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          agency_id: string | null
          archive_reason: string | null
          area: number | null
          balcony: boolean
          baths: number | null
          beds: number | null
          building_type: string | null
          city: string
          commission_model: string | null
          commission_pct: number | null
          condition: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_type: string | null
          cooperates: string | null
          created_at: string
          deal_type: string
          deleted: boolean
          district: string
          floor: number | null
          floors: number | null
          id: string
          imported_at: string | null
          my_home_listing_id: string | null
          my_home_listing_url: string | null
          negotiable_to: number | null
          next_follow_up: string | null
          notes: string | null
          owner_id: string
          owner_net: number | null
          parking: boolean
          photos: string[]
          portal_price: number | null
          price: number | null
          rooms: number | null
          shared_with_agency: boolean
          source: string | null
          source_ref: string | null
          source_url: string | null
          ss_listing_id: string | null
          ss_listing_url: string | null
          status: string
          type: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          address: string
          agency_id?: string | null
          archive_reason?: string | null
          area?: number | null
          balcony?: boolean
          baths?: number | null
          beds?: number | null
          building_type?: string | null
          city: string
          commission_model?: string | null
          commission_pct?: number | null
          condition?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type?: string | null
          cooperates?: string | null
          created_at?: string
          deal_type: string
          deleted?: boolean
          district: string
          floor?: number | null
          floors?: number | null
          id?: string
          imported_at?: string | null
          my_home_listing_id?: string | null
          my_home_listing_url?: string | null
          negotiable_to?: number | null
          next_follow_up?: string | null
          notes?: string | null
          owner_id: string
          owner_net?: number | null
          parking?: boolean
          photos?: string[]
          portal_price?: number | null
          price?: number | null
          rooms?: number | null
          shared_with_agency?: boolean
          source?: string | null
          source_ref?: string | null
          source_url?: string | null
          ss_listing_id?: string | null
          ss_listing_url?: string | null
          status?: string
          type: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          address?: string
          agency_id?: string | null
          archive_reason?: string | null
          area?: number | null
          balcony?: boolean
          baths?: number | null
          beds?: number | null
          building_type?: string | null
          city?: string
          commission_model?: string | null
          commission_pct?: number | null
          condition?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type?: string | null
          cooperates?: string | null
          created_at?: string
          deal_type?: string
          deleted?: boolean
          district?: string
          floor?: number | null
          floors?: number | null
          id?: string
          imported_at?: string | null
          my_home_listing_id?: string | null
          my_home_listing_url?: string | null
          negotiable_to?: number | null
          next_follow_up?: string | null
          notes?: string | null
          owner_id?: string
          owner_net?: number | null
          parking?: boolean
          photos?: string[]
          portal_price?: number | null
          price?: number | null
          rooms?: number | null
          shared_with_agency?: boolean
          source?: string | null
          source_ref?: string | null
          source_url?: string | null
          ss_listing_id?: string | null
          ss_listing_url?: string | null
          status?: string
          type?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_favorites: {
        Row: {
          agent_id: string
          created_at: string
          property_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          property_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_favorites_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "property_favorites_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          area_max: number | null
          area_min: number | null
          beds: number | null
          budget_max: number | null
          budget_min: number | null
          client_id: string
          condition: string | null
          created_at: string
          deal_type: string | null
          districts: string[]
          floor_pref: string | null
          id: string
          must: Json
          name: string | null
          notes: string | null
          owner_id: string
          parking: boolean
          property_type: string | null
          rooms: number | null
          shared: boolean
          status: string
          updated_at: string
        }
        Insert: {
          area_max?: number | null
          area_min?: number | null
          beds?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id: string
          condition?: string | null
          created_at?: string
          deal_type?: string | null
          districts?: string[]
          floor_pref?: string | null
          id?: string
          must?: Json
          name?: string | null
          notes?: string | null
          owner_id: string
          parking?: boolean
          property_type?: string | null
          rooms?: number | null
          shared?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          area_max?: number | null
          area_min?: number | null
          beds?: number | null
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string
          condition?: string | null
          created_at?: string
          deal_type?: string | null
          districts?: string[]
          floor_pref?: string | null
          id?: string
          must?: Json
          name?: string | null
          notes?: string | null
          owner_id?: string
          parking?: boolean
          property_type?: string | null
          rooms?: number | null
          shared?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "requirements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_properties: {
        Row: {
          client_id: string
          created_at: string
          feedback: string
          id: string
          owner_id: string
          price: number | null
          property_id: string
          sent_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          feedback?: string
          id?: string
          owner_id: string
          price?: number | null
          property_id: string
          sent_date?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          feedback?: string
          id?: string
          owner_id?: string
          price?: number | null
          property_id?: string
          sent_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_properties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "sent_properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string | null
          created_at: string
          done: boolean
          due_date: string | null
          due_time: string | null
          id: string
          notes: string | null
          owner_id: string
          property_id: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_time?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          property_id?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_time?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          property_id?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_view"
            referencedColumns: ["id"]
          },
        ]
      }
      trash_items: {
        Row: {
          deleted_at: string
          id: string
          kind: string
          label: string
          owner_id: string
          ref_id: string | null
        }
        Insert: {
          deleted_at?: string
          id?: string
          kind: string
          label: string
          owner_id: string
          ref_id?: string | null
        }
        Update: {
          deleted_at?: string
          id?: string
          kind?: string
          label?: string
          owner_id?: string
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trash_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "trash_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_settings: {
        Row: {
          agency: string | null
          agent_id: string | null
          city: string | null
          email: string | null
          name: string | null
          phone: string | null
          trial: string | null
        }
        Relationships: []
      }
      colleague_requirements: {
        Row: {
          agency: string | null
          agent: string | null
          area_min: number | null
          beds: number | null
          budget_max: number | null
          deal_type: string | null
          districts: string[] | null
          id: string | null
          note: string | null
          parking: boolean | null
        }
        Relationships: []
      }
      properties_view: {
        Row: {
          address: string | null
          agency: string | null
          archive_reason: string | null
          area: number | null
          balcony: boolean | null
          baths: number | null
          beds: number | null
          building_type: string | null
          city: string | null
          commission_model: string | null
          commission_pct: number | null
          condition: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_type: string | null
          cooperates: string | null
          created_at: string | null
          deal_type: string | null
          deleted: boolean | null
          district: string | null
          favorite: boolean | null
          floor: number | null
          floors: number | null
          id: string | null
          imported_at: string | null
          mine: boolean | null
          my_home_listing_id: string | null
          my_home_listing_url: string | null
          negotiable_to: number | null
          next_follow_up: string | null
          notes: string | null
          owner_id: string | null
          owner_net: number | null
          parking: boolean | null
          photos: string[] | null
          portal_price: number | null
          price: number | null
          rooms: number | null
          shared_by: string | null
          shared_with_agency: boolean | null
          source: string | null
          source_ref: string | null
          source_url: string | null
          ss_listing_id: string | null
          ss_listing_url: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          verified_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "agent_settings"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
