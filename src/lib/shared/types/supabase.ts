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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ad_accounts: {
        Row: {
          aggregated_metrics: Json | null
          business_id: string
          created_at: string
          currency_code: string | null
          external_account_id: string
          id: string
          last_synced: string | null
          name: string | null
          platform_id: string
          status: string | null
          time_increment_metrics: Json | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          aggregated_metrics?: Json | null
          business_id: string
          created_at?: string
          currency_code?: string | null
          external_account_id: string
          id?: string
          last_synced?: string | null
          name?: string | null
          platform_id: string
          status?: string | null
          time_increment_metrics?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          aggregated_metrics?: Json | null
          business_id?: string
          created_at?: string
          currency_code?: string | null
          external_account_id?: string
          id?: string
          last_synced?: string | null
          name?: string | null
          platform_id?: string
          status?: string | null
          time_increment_metrics?: Json | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_dims: {
        Row: {
          ad_account_id: string
          adset_external_id: string
          created_at: string | null
          created_time: string | null
          creative_id: string | null
          external_id: string
          id: string
          name: string | null
          raw: Json | null
          status: string | null
          updated_at: string | null
          updated_time: string | null
        }
        Insert: {
          ad_account_id: string
          adset_external_id: string
          created_at?: string | null
          created_time?: string | null
          creative_id?: string | null
          external_id: string
          id?: string
          name?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_time?: string | null
        }
        Update: {
          ad_account_id?: string
          adset_external_id?: string
          created_at?: string | null
          created_time?: string | null
          creative_id?: string | null
          external_id?: string
          id?: string
          name?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_dims_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_performance_daily: {
        Row: {
          ad_id: string
          calls: number
          clicks: number
          created_at: string | null
          currency_code: string | null
          day: string
          impressions: number
          inline_link_clicks: number
          leads: number
          messages: number
          objective: string | null
          reach: number
          source: string
          spend: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ad_id: string
          calls?: number
          clicks?: number
          created_at?: string | null
          currency_code?: string | null
          day: string
          impressions?: number
          inline_link_clicks?: number
          leads?: number
          messages?: number
          objective?: string | null
          reach?: number
          source?: string
          spend?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string
          calls?: number
          clicks?: number
          created_at?: string | null
          currency_code?: string | null
          day?: string
          impressions?: number
          inline_link_clicks?: number
          leads?: number
          messages?: number
          objective?: string | null
          reach?: number
          source?: string
          spend?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_performance_daily_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ad_dims"
            referencedColumns: ["id"]
          },
        ]
      }
      adset_dims: {
        Row: {
          ad_account_id: string
          campaign_external_id: string
          created_at: string | null
          created_time: string | null
          external_id: string
          id: string
          name: string | null
          optimization_goal: string | null
          raw: Json | null
          status: string | null
          updated_at: string | null
          updated_time: string | null
        }
        Insert: {
          ad_account_id: string
          campaign_external_id: string
          created_at?: string | null
          created_time?: string | null
          external_id: string
          id?: string
          name?: string | null
          optimization_goal?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_time?: string | null
        }
        Update: {
          ad_account_id?: string
          campaign_external_id?: string
          created_at?: string | null
          created_time?: string | null
          external_id?: string
          id?: string
          name?: string | null
          optimization_goal?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adset_dims_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      adsets_performance_daily: {
        Row: {
          adset_id: string
          calls: number
          clicks: number
          created_at: string | null
          currency_code: string | null
          day: string
          impressions: number
          inline_link_clicks: number
          leads: number
          messages: number
          objective: string | null
          reach: number
          source: string | null
          spend: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adset_id: string
          calls?: number
          clicks?: number
          created_at?: string | null
          currency_code?: string | null
          day: string
          impressions?: number
          inline_link_clicks?: number
          leads?: number
          messages?: number
          objective?: string | null
          reach?: number
          source?: string | null
          spend?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adset_id?: string
          calls?: number
          clicks?: number
          created_at?: string | null
          currency_code?: string | null
          day?: string
          impressions?: number
          inline_link_clicks?: number
          leads?: number
          messages?: number
          objective?: string | null
          reach?: number
          source?: string | null
          spend?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adsets_performance_daily_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "adset_dims"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_accounts: {
        Row: {
          created_at: string
          id: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      business_memberships: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_memberships_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          ad_goals: string[] | null
          business_name: string
          created_at: string
          description: string | null
          id: string
          industry: string | null
          monthly_budget: string | null
          onboarding_completed: boolean
          onboarding_step: number
          preferred_platforms: string[] | null
          updated_at: string
          website: string | null
        }
        Insert: {
          ad_goals?: string[] | null
          business_name: string
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          monthly_budget?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          preferred_platforms?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          ad_goals?: string[] | null
          business_name?: string
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          monthly_budget?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          preferred_platforms?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      campaign_dims: {
        Row: {
          ad_account_id: string
          created_at: string | null
          created_time: string | null
          external_id: string
          id: string
          name: string | null
          objective: string | null
          raw: Json | null
          status: string | null
          updated_at: string | null
          updated_time: string | null
        }
        Insert: {
          ad_account_id: string
          created_at?: string | null
          created_time?: string | null
          external_id: string
          id?: string
          name?: string | null
          objective?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_time?: string | null
        }
        Update: {
          ad_account_id?: string
          created_at?: string | null
          created_time?: string | null
          external_id?: string
          id?: string
          name?: string | null
          objective?: string | null
          raw?: Json | null
          status?: string | null
          updated_at?: string | null
          updated_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_dims_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns_performance_daily: {
        Row: {
          calls: number
          campaign_id: string
          clicks: number
          created_at: string | null
          currency_code: string | null
          day: string
          entity_external_id: string
          impressions: number
          inline_link_clicks: number
          leads: number
          messages: number
          objective: string | null
          reach: number
          source: string | null
          spend: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          calls?: number
          campaign_id: string
          clicks?: number
          created_at?: string | null
          currency_code?: string | null
          day: string
          entity_external_id: string
          impressions?: number
          inline_link_clicks?: number
          leads?: number
          messages?: number
          objective?: string | null
          reach?: number
          source?: string | null
          spend?: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          calls?: number
          campaign_id?: string
          clicks?: number
          created_at?: string | null
          currency_code?: string | null
          day?: string
          entity_external_id?: string
          impressions?: number
          inline_link_clicks?: number
          leads?: number
          messages?: number
          objective?: string | null
          reach?: number
          source?: string | null
          spend?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_performance_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_dims"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          business_id: string
          created_at: string
          expires_at: string
          id: string
          platform_id: string
          state: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          expires_at?: string
          id?: string
          platform_id: string
          state: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          platform_id?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_integrations: {
        Row: {
          access_token: string
          business_id: string
          created_at: string | null
          id: string
          integration_details: Json | null
          is_integrated: boolean | null
          platform_id: string
          refresh_token: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          business_id: string
          created_at?: string | null
          id?: string
          integration_details?: Json | null
          is_integrated?: boolean | null
          platform_id: string
          refresh_token?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          business_id?: string
          created_at?: string | null
          id?: string
          integration_details?: Json | null
          is_integrated?: boolean | null
          platform_id?: string
          refresh_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_integrations_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      platforms: {
        Row: {
          api_info: Json
          created_at: string
          id: string
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          api_info?: Json
          created_at?: string
          id?: string
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          api_info?: Json
          created_at?: string
          id?: string
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_account_id: string
          created_at: string
          id: string
          invoice_url: string | null
          last_payment_amount: number | null
          last_payment_date: string | null
          plan_tier: string
          stripe_subscription_id: string | null
          subscription_end: string | null
          subscription_start: string | null
          subscription_status: string
          updated_at: string
        }
        Insert: {
          billing_account_id: string
          created_at?: string
          id?: string
          invoice_url?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          plan_tier?: string
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          billing_account_id?: string
          created_at?: string
          id?: string
          invoice_url?: string | null
          last_payment_amount?: number | null
          last_payment_date?: string | null
          plan_tier?: string
          stripe_subscription_id?: string | null
          subscription_end?: string | null
          subscription_start?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_billing_account_id_fkey"
            columns: ["billing_account_id"]
            isOneToOne: false
            referencedRelation: "billing_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone_number: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone_number: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone_number?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_account: {
        Args: { p_ad_account_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      obj_code: { Args: { raw: string }; Returns: string }
      obj_label: { Args: { raw: string }; Returns: string }
    }
    Enums: {
      business_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      q_msg: {
        msg_id: number | null
        read_ct: number | null
        enqueued_at: string | null
        vt: string | null
        message: Json | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      business_role: ["owner", "admin", "member"],
    },
  },
} as const
