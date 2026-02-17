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
          vendor: string
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
          vendor: string
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
          vendor?: string
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
      ads_metrics: {
        Row: {
          ad_id: string
          adset_id: string | null
          clicks: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          creative_id: string | null
          ctr: number | null
          end_date: string | null
          id: number
          impressions: number | null
          leads: number | null
          link_clicks: number | null
          messages: number | null
          name: string
          platform_name: string | null
          raw_data: Json | null
          reach: number | null
          spend: number | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ad_id: string
          adset_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_id?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: number
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          messages?: number | null
          name: string
          platform_name?: string | null
          raw_data?: Json | null
          reach?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string
          adset_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_id?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: number
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          messages?: number | null
          name?: string
          platform_name?: string | null
          raw_data?: Json | null
          reach?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "adset_metrics"
            referencedColumns: ["adset_id"]
          },
        ]
      }
      ads_performance_daily: {
        Row: {
          ad_account_id: string
          adset_external_id: string | null
          calls: number
          campaign_external_id: string | null
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
          source: string
          spend: number
          status: string | null
          updated_at: string | null
          vendor: string
        }
        Insert: {
          ad_account_id: string
          adset_external_id?: string | null
          calls?: number
          campaign_external_id?: string | null
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
          source?: string
          spend?: number
          status?: string | null
          updated_at?: string | null
          vendor: string
        }
        Update: {
          ad_account_id?: string
          adset_external_id?: string | null
          calls?: number
          campaign_external_id?: string | null
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
          source?: string
          spend?: number
          status?: string | null
          updated_at?: string | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_performance_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
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
          vendor: string
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
          vendor: string
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
          vendor?: string
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
      adset_metrics: {
        Row: {
          adset_id: string
          campaign_id: string | null
          clicks: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          end_date: string | null
          id: number
          impressions: number | null
          leads: number | null
          link_clicks: number | null
          messages: number | null
          name: string
          optimization_goal: string | null
          platform_name: string | null
          raw_data: Json | null
          reach: number | null
          spend: number | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          adset_id: string
          campaign_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: number
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          messages?: number | null
          name: string
          optimization_goal?: string | null
          platform_name?: string | null
          raw_data?: Json | null
          reach?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          adset_id?: string
          campaign_id?: string | null
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: number
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          messages?: number | null
          name?: string
          optimization_goal?: string | null
          platform_name?: string | null
          raw_data?: Json | null
          reach?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adset_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_metrics"
            referencedColumns: ["campaign_id"]
          },
        ]
      }
      adsets_performance_daily: {
        Row: {
          ad_account_id: string
          calls: number
          campaign_external_id: string | null
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
          vendor: string
        }
        Insert: {
          ad_account_id: string
          calls?: number
          campaign_external_id?: string | null
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
          vendor: string
        }
        Update: {
          ad_account_id?: string
          calls?: number
          campaign_external_id?: string | null
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
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "adsets_performance_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
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
          user_id: string
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
          user_id: string
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
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          vendor: string
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
          vendor: string
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
          vendor?: string
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
      campaign_drafts: {
        Row: {
          ad_account_id: string
          approved_at: string | null
          created_at: string
          creative_id: string | null
          decision_reason: string | null
          expires_at: string | null
          id: string
          idempotency_key: string | null
          payload_json: Json
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          ad_account_id: string
          approved_at?: string | null
          created_at?: string
          creative_id?: string | null
          decision_reason?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          payload_json: Json
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          ad_account_id?: string
          approved_at?: string | null
          created_at?: string
          creative_id?: string | null
          decision_reason?: string | null
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          payload_json?: Json
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_job_progress: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          meta: Json | null
          status: string
          step: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          meta?: Json | null
          status: string
          step: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          meta?: Json | null
          status?: string
          step?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ad_data: Json | null
          adset_data: Json | null
          budget: number
          budget_type: string
          campaign_data: Json | null
          content_source: string | null
          created_at: string | null
          created_by_deepvisor: boolean | null
          creative_data: Json | null
          destination_type: string | null
          end_date: string | null
          id: string
          is_smart_campaign: boolean | null
          last_sync: string | null
          location_data: Json | null
          metrics: Json | null
          name: string
          objective: string
          optimization_goal: string | null
          platform: string
          platform_ad_ids: string | null
          platform_adset_ids: string | null
          platform_campaign_id: string
          platform_creative_ids: string | null
          start_date: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ad_data?: Json | null
          adset_data?: Json | null
          budget: number
          budget_type: string
          campaign_data?: Json | null
          content_source?: string | null
          created_at?: string | null
          created_by_deepvisor?: boolean | null
          creative_data?: Json | null
          destination_type?: string | null
          end_date?: string | null
          id?: string
          is_smart_campaign?: boolean | null
          last_sync?: string | null
          location_data?: Json | null
          metrics?: Json | null
          name: string
          objective: string
          optimization_goal?: string | null
          platform: string
          platform_ad_ids?: string | null
          platform_adset_ids?: string | null
          platform_campaign_id: string
          platform_creative_ids?: string | null
          start_date?: string | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ad_data?: Json | null
          adset_data?: Json | null
          budget?: number
          budget_type?: string
          campaign_data?: Json | null
          content_source?: string | null
          created_at?: string | null
          created_by_deepvisor?: boolean | null
          creative_data?: Json | null
          destination_type?: string | null
          end_date?: string | null
          id?: string
          is_smart_campaign?: boolean | null
          last_sync?: string | null
          location_data?: Json | null
          metrics?: Json | null
          name?: string
          objective?: string
          optimization_goal?: string | null
          platform?: string
          platform_ad_ids?: string | null
          platform_adset_ids?: string | null
          platform_campaign_id?: string
          platform_creative_ids?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      campaigns_metrics: {
        Row: {
          ad_account_id: string | null
          ad_account_uuid: string | null
          campaign_id: string
          clicks: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          end_date: string | null
          id: number
          impressions: number | null
          last_30d_metrics: Json | null
          last_7d_metrics: Json | null
          last_month_metrics: Json | null
          leads: number | null
          link_clicks: number | null
          messages: number | null
          name: string
          objective: string | null
          platform_name: string | null
          raw_data: Json | null
          reach: number | null
          spend: number | null
          start_date: string | null
          status: string | null
          this_month_metrics: Json | null
          today_metrics: Json | null
          updated_at: string | null
          yesterday_metrics: Json | null
        }
        Insert: {
          ad_account_id?: string | null
          ad_account_uuid?: string | null
          campaign_id: string
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: number
          impressions?: number | null
          last_30d_metrics?: Json | null
          last_7d_metrics?: Json | null
          last_month_metrics?: Json | null
          leads?: number | null
          link_clicks?: number | null
          messages?: number | null
          name: string
          objective?: string | null
          platform_name?: string | null
          raw_data?: Json | null
          reach?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          this_month_metrics?: Json | null
          today_metrics?: Json | null
          updated_at?: string | null
          yesterday_metrics?: Json | null
        }
        Update: {
          ad_account_id?: string | null
          ad_account_uuid?: string | null
          campaign_id?: string
          clicks?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          end_date?: string | null
          id?: number
          impressions?: number | null
          last_30d_metrics?: Json | null
          last_7d_metrics?: Json | null
          last_month_metrics?: Json | null
          leads?: number | null
          link_clicks?: number | null
          messages?: number | null
          name?: string
          objective?: string | null
          platform_name?: string | null
          raw_data?: Json | null
          reach?: number | null
          spend?: number | null
          start_date?: string | null
          status?: string | null
          this_month_metrics?: Json | null
          today_metrics?: Json | null
          updated_at?: string | null
          yesterday_metrics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_metrics_ad_account_uuid_fkey"
            columns: ["ad_account_uuid"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns_performance_daily: {
        Row: {
          ad_account_id: string
          calls: number
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
          vendor: string
        }
        Insert: {
          ad_account_id: string
          calls?: number
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
          vendor: string
        }
        Update: {
          ad_account_id?: string
          calls?: number
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
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_performance_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          ad_account_id: string
          approved_at: string | null
          created_at: string | null
          decision_comment: string | null
          executed_at: string | null
          execution_result: Json | null
          gatekeeper_result: Json | null
          id: string
          idempotency_key: string | null
          job_id: string
          mode: string
          plan_json: Json
          rejected_at: string | null
          review_mode: string | null
          reviewer: Json | null
          status: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          approved_at?: string | null
          created_at?: string | null
          decision_comment?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          gatekeeper_result?: Json | null
          id?: string
          idempotency_key?: string | null
          job_id: string
          mode: string
          plan_json: Json
          rejected_at?: string | null
          review_mode?: string | null
          reviewer?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          approved_at?: string | null
          created_at?: string | null
          decision_comment?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          gatekeeper_result?: Json | null
          id?: string
          idempotency_key?: string | null
          job_id?: string
          mode?: string
          plan_json?: Json
          rejected_at?: string | null
          review_mode?: string | null
          reviewer?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_pages: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          instagram_account_id: string | null
          name: string | null
          page_id: string | null
          platform_integration_id: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          name?: string | null
          page_id?: string | null
          platform_integration_id?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          instagram_account_id?: string | null
          name?: string | null
          page_id?: string | null
          platform_integration_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_page_account_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_page_accounts_platform_integration_id_fkey"
            columns: ["platform_integration_id"]
            isOneToOne: false
            referencedRelation: "platform_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          platform: string
          state: string
          user_id: string
        }
        Insert: {
          created_at: string
          expires_at: string
          id?: string
          platform: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          platform?: string
          state?: string
          user_id?: string
        }
        Relationships: []
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
          platform_name: string | null
          refresh_token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          business_id: string
          created_at?: string | null
          id?: string
          integration_details?: Json | null
          is_integrated?: boolean | null
          platform_id: string
          platform_name?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          business_id?: string
          created_at?: string | null
          id?: string
          integration_details?: Json | null
          is_integrated?: boolean | null
          platform_id?: string
          platform_name?: string | null
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_integrations_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: true
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          first_name: string | null
          id: string
          last_name: string | null
          phone_number: string
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string
          role?: string | null
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
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
