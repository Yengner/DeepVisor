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
  ai: {
    Tables: {
      ad_account_signals: {
        Row: {
          ad_account_id: string
          business_id: string
          created_at: string
          evidence_json: Json
          first_detected_at: string
          id: string
          last_detected_at: string
          platform_integration_id: string
          reason: string
          recommended_action_json: Json
          resolved_at: string | null
          severity: string
          signal_type: string
          source_assessment_id: string | null
          source_digest_hash: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          business_id: string
          created_at?: string
          evidence_json?: Json
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          platform_integration_id: string
          reason: string
          recommended_action_json?: Json
          resolved_at?: string | null
          severity: string
          signal_type: string
          source_assessment_id?: string | null
          source_digest_hash: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          business_id?: string
          created_at?: string
          evidence_json?: Json
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          platform_integration_id?: string
          reason?: string
          recommended_action_json?: Json
          resolved_at?: string | null
          severity?: string
          signal_type?: string
          source_assessment_id?: string | null
          source_digest_hash?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_account_signals_source_assessment_id_fkey"
            columns: ["source_assessment_id"]
            isOneToOne: false
            referencedRelation: "business_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_observations: {
        Row: {
          ad_account_id: string | null
          business_id: string
          confidence_score: number | null
          created_at: string
          entity_id: string | null
          entity_type: string
          evidence_json: Json
          id: string
          observation_text: string
          observation_type: string
          source: string
          title: string | null
        }
        Insert: {
          ad_account_id?: string | null
          business_id: string
          confidence_score?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          evidence_json?: Json
          id?: string
          observation_text: string
          observation_type: string
          source?: string
          title?: string | null
        }
        Update: {
          ad_account_id?: string | null
          business_id?: string
          confidence_score?: number | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          evidence_json?: Json
          id?: string
          observation_text?: string
          observation_type?: string
          source?: string
          title?: string | null
        }
        Relationships: []
      }
      business_agent_profiles: {
        Row: {
          assessment_status: string
          best_audience_patterns_json: Json
          best_budget_patterns_json: Json
          best_creative_patterns_json: Json
          best_objectives_json: Json
          best_time_patterns_json: Json
          business_id: string
          confidence_score: number | null
          created_at: string
          failure_patterns_json: Json
          forbidden_patterns_json: Json
          history_available: boolean
          history_end_date: string | null
          history_start_date: string | null
          id: string
          last_assessed_at: string | null
          last_learning_update_at: string | null
          playbook_markdown: string | null
          primary_platform: string | null
          recommended_defaults_json: Json
          updated_at: string
        }
        Insert: {
          assessment_status?: string
          best_audience_patterns_json?: Json
          best_budget_patterns_json?: Json
          best_creative_patterns_json?: Json
          best_objectives_json?: Json
          best_time_patterns_json?: Json
          business_id: string
          confidence_score?: number | null
          created_at?: string
          failure_patterns_json?: Json
          forbidden_patterns_json?: Json
          history_available?: boolean
          history_end_date?: string | null
          history_start_date?: string | null
          id?: string
          last_assessed_at?: string | null
          last_learning_update_at?: string | null
          playbook_markdown?: string | null
          primary_platform?: string | null
          recommended_defaults_json?: Json
          updated_at?: string
        }
        Update: {
          assessment_status?: string
          best_audience_patterns_json?: Json
          best_budget_patterns_json?: Json
          best_creative_patterns_json?: Json
          best_objectives_json?: Json
          best_time_patterns_json?: Json
          business_id?: string
          confidence_score?: number | null
          created_at?: string
          failure_patterns_json?: Json
          forbidden_patterns_json?: Json
          history_available?: boolean
          history_end_date?: string | null
          history_start_date?: string | null
          id?: string
          last_assessed_at?: string | null
          last_learning_update_at?: string | null
          playbook_markdown?: string | null
          primary_platform?: string | null
          recommended_defaults_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      business_assessments: {
        Row: {
          assessment_json: Json
          business_id: string
          created_at: string
          digest_json: Json
          id: string
          scope: string
        }
        Insert: {
          assessment_json?: Json
          business_id: string
          created_at?: string
          digest_json?: Json
          id?: string
          scope?: string
        }
        Update: {
          assessment_json?: Json
          business_id?: string
          created_at?: string
          digest_json?: Json
          id?: string
          scope?: string
        }
        Relationships: []
      }
      creative_feature_snapshots: {
        Row: {
          ad_account_id: string
          ad_id: string | null
          adset_id: string | null
          body_text: string | null
          business_id: string
          campaign_id: string | null
          created_at: string
          creative_id: string
          cta_type: string | null
          feature_json: Json
          has_branding: boolean | null
          has_discount: boolean | null
          has_price: boolean | null
          has_social_proof: boolean | null
          has_testimonial: boolean | null
          has_urgency: boolean | null
          headline_text: string | null
          hook_style: string | null
          id: string
          landing_page_type: string | null
          message_angle_tags: string[]
          offer_type: string | null
          primary_format: string | null
          snapshot_date: string
          visual_style_tags: string[]
        }
        Insert: {
          ad_account_id: string
          ad_id?: string | null
          adset_id?: string | null
          body_text?: string | null
          business_id: string
          campaign_id?: string | null
          created_at?: string
          creative_id: string
          cta_type?: string | null
          feature_json?: Json
          has_branding?: boolean | null
          has_discount?: boolean | null
          has_price?: boolean | null
          has_social_proof?: boolean | null
          has_testimonial?: boolean | null
          has_urgency?: boolean | null
          headline_text?: string | null
          hook_style?: string | null
          id?: string
          landing_page_type?: string | null
          message_angle_tags?: string[]
          offer_type?: string | null
          primary_format?: string | null
          snapshot_date?: string
          visual_style_tags?: string[]
        }
        Update: {
          ad_account_id?: string
          ad_id?: string | null
          adset_id?: string | null
          body_text?: string | null
          business_id?: string
          campaign_id?: string | null
          created_at?: string
          creative_id?: string
          cta_type?: string | null
          feature_json?: Json
          has_branding?: boolean | null
          has_discount?: boolean | null
          has_price?: boolean | null
          has_social_proof?: boolean | null
          has_testimonial?: boolean | null
          has_urgency?: boolean | null
          headline_text?: string | null
          hook_style?: string | null
          id?: string
          landing_page_type?: string | null
          message_angle_tags?: string[]
          offer_type?: string | null
          primary_format?: string | null
          snapshot_date?: string
          visual_style_tags?: string[]
        }
        Relationships: []
      }
      ingestion_jobs: {
        Row: {
          ad_account_id: string | null
          attempts: number
          business_id: string
          created_at: string
          error_text: string | null
          finished_at: string | null
          id: string
          job_type: string
          max_attempts: number
          payload_json: Json
          platform_integration_id: string
          priority: number
          result_json: Json
          scheduled_for: string
          started_at: string | null
          status: string
          sync_run_id: string | null
        }
        Insert: {
          ad_account_id?: string | null
          attempts?: number
          business_id: string
          created_at?: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          max_attempts?: number
          payload_json?: Json
          platform_integration_id: string
          priority?: number
          result_json?: Json
          scheduled_for?: string
          started_at?: string | null
          status?: string
          sync_run_id?: string | null
        }
        Update: {
          ad_account_id?: string | null
          attempts?: number
          business_id?: string
          created_at?: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          payload_json?: Json
          platform_integration_id?: string
          priority?: number
          result_json?: Json
          scheduled_for?: string
          started_at?: string | null
          status?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "platform_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_sync_runs: {
        Row: {
          ad_account_id: string | null
          business_id: string
          created_at: string
          error_text: string | null
          finished_at: string | null
          id: string
          metadata: Json
          platform_integration_id: string
          records_processed: number
          started_at: string | null
          status: string
          sync_type: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          ad_account_id?: string | null
          business_id: string
          created_at?: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          platform_integration_id: string
          records_processed?: number
          started_at?: string | null
          status?: string
          sync_type: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          ad_account_id?: string | null
          business_id?: string
          created_at?: string
          error_text?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          platform_integration_id?: string
          records_processed?: number
          started_at?: string | null
          status?: string
          sync_type?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
  public: {
    Tables: {
      account_intelligence_profiles: {
        Row: {
          active_days_count: number
          ad_account_id: string
          ads_count: number
          adsets_count: number
          best_ad_id: string | null
          best_adset_id: string | null
          best_campaign_id: string | null
          best_historical_objective: string | null
          best_recent_objective: string | null
          business_id: string
          campaigns_count: number
          created_at: string
          data_sufficiency_score: number | null
          first_activity_date: string | null
          generated_at: string
          id: string
          maturity_classification: string
          primary_objective: string | null
          recommendation_readiness: boolean
          summary: Json
          total_clicks: number
          total_impressions: number
          total_leads: number
          total_spend: number
          updated_at: string
        }
        Insert: {
          active_days_count?: number
          ad_account_id: string
          ads_count?: number
          adsets_count?: number
          best_ad_id?: string | null
          best_adset_id?: string | null
          best_campaign_id?: string | null
          best_historical_objective?: string | null
          best_recent_objective?: string | null
          business_id: string
          campaigns_count?: number
          created_at?: string
          data_sufficiency_score?: number | null
          first_activity_date?: string | null
          generated_at?: string
          id?: string
          maturity_classification: string
          primary_objective?: string | null
          recommendation_readiness?: boolean
          summary?: Json
          total_clicks?: number
          total_impressions?: number
          total_leads?: number
          total_spend?: number
          updated_at?: string
        }
        Update: {
          active_days_count?: number
          ad_account_id?: string
          ads_count?: number
          adsets_count?: number
          best_ad_id?: string | null
          best_adset_id?: string | null
          best_campaign_id?: string | null
          best_historical_objective?: string | null
          best_recent_objective?: string | null
          business_id?: string
          campaigns_count?: number
          created_at?: string
          data_sufficiency_score?: number | null
          first_activity_date?: string | null
          generated_at?: string
          id?: string
          maturity_classification?: string
          primary_objective?: string | null
          recommendation_readiness?: boolean
          summary?: Json
          total_clicks?: number
          total_impressions?: number
          total_leads?: number
          total_spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_intelligence_profiles_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: true
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_intelligence_profiles_best_ad_id_fkey"
            columns: ["best_ad_id"]
            isOneToOne: false
            referencedRelation: "ad_dims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_intelligence_profiles_best_adset_id_fkey"
            columns: ["best_adset_id"]
            isOneToOne: false
            referencedRelation: "adset_dims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_intelligence_profiles_best_campaign_id_fkey"
            columns: ["best_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_dims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_intelligence_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      account_sync_jobs: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          ad_account_id: string
          ads_synced: number
          adsets_synced: number
          business_id: string
          campaigns_synced: number
          created_at: string
          creatives_synced: number
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json
          performance_rows_synced: number
          platform_integration_id: string
          requested_end_date: string | null
          requested_start_date: string | null
          started_at: string | null
          status: string
          sync_type: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          ad_account_id: string
          ads_synced?: number
          adsets_synced?: number
          business_id: string
          campaigns_synced?: number
          created_at?: string
          creatives_synced?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          performance_rows_synced?: number
          platform_integration_id: string
          requested_end_date?: string | null
          requested_start_date?: string | null
          started_at?: string | null
          status?: string
          sync_type: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          ad_account_id?: string
          ads_synced?: number
          adsets_synced?: number
          business_id?: string
          campaigns_synced?: number
          created_at?: string
          creatives_synced?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          performance_rows_synced?: number
          platform_integration_id?: string
          requested_end_date?: string | null
          requested_start_date?: string | null
          started_at?: string | null
          status?: string
          sync_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_sync_jobs_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_sync_jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_sync_jobs_platform_integration_id_fkey"
            columns: ["platform_integration_id"]
            isOneToOne: false
            referencedRelation: "platform_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_account_sync_state: {
        Row: {
          ad_account_id: string
          created_at: string
          dimensions_synced_at: string | null
          first_activity_date: string | null
          first_full_sync_at: string | null
          first_full_sync_completed: boolean
          has_meaningful_history: boolean
          historical_data_available: boolean
          id: string
          insights_synced_through: string | null
          last_failed_sync_job_id: string | null
          last_incremental_sync_at: string | null
          last_successful_sync_job_id: string | null
          latest_activity_date: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          dimensions_synced_at?: string | null
          first_activity_date?: string | null
          first_full_sync_at?: string | null
          first_full_sync_completed?: boolean
          has_meaningful_history?: boolean
          historical_data_available?: boolean
          id?: string
          insights_synced_through?: string | null
          last_failed_sync_job_id?: string | null
          last_incremental_sync_at?: string | null
          last_successful_sync_job_id?: string | null
          latest_activity_date?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          dimensions_synced_at?: string | null
          first_activity_date?: string | null
          first_full_sync_at?: string | null
          first_full_sync_completed?: boolean
          has_meaningful_history?: boolean
          historical_data_available?: boolean
          id?: string
          insights_synced_through?: string | null
          last_failed_sync_job_id?: string | null
          last_incremental_sync_at?: string | null
          last_successful_sync_job_id?: string | null
          latest_activity_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_account_sync_state_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: true
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_account_sync_state_last_failed_sync_job_id_fkey"
            columns: ["last_failed_sync_job_id"]
            isOneToOne: false
            referencedRelation: "account_sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_account_sync_state_last_successful_sync_job_id_fkey"
            columns: ["last_successful_sync_job_id"]
            isOneToOne: false
            referencedRelation: "account_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ad_creatives: {
        Row: {
          ad_account_id: string
          asset_feed_spec: Json
          business_id: string
          created_at: string
          creative_type: string | null
          cta_type: string | null
          description: string | null
          headline: string | null
          id: string
          image_hash: string | null
          image_url: string | null
          instagram_actor_id: string | null
          link_url: string | null
          name: string | null
          object_story_id: string | null
          object_story_spec: Json
          page_id: string | null
          platform_creative_id: string
          platform_integration_id: string | null
          primary_text: string | null
          raw: Json
          thumbnail_url: string | null
          updated_at: string
          video_id: string | null
        }
        Insert: {
          ad_account_id: string
          asset_feed_spec?: Json
          business_id: string
          created_at?: string
          creative_type?: string | null
          cta_type?: string | null
          description?: string | null
          headline?: string | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          instagram_actor_id?: string | null
          link_url?: string | null
          name?: string | null
          object_story_id?: string | null
          object_story_spec?: Json
          page_id?: string | null
          platform_creative_id: string
          platform_integration_id?: string | null
          primary_text?: string | null
          raw?: Json
          thumbnail_url?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          ad_account_id?: string
          asset_feed_spec?: Json
          business_id?: string
          created_at?: string
          creative_type?: string | null
          cta_type?: string | null
          description?: string | null
          headline?: string | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          instagram_actor_id?: string | null
          link_url?: string | null
          name?: string | null
          object_story_id?: string | null
          object_story_spec?: Json
          page_id?: string | null
          platform_creative_id?: string
          platform_integration_id?: string | null
          primary_text?: string | null
          raw?: Json
          thumbnail_url?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creatives_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_creatives_platform_integration_id_fkey"
            columns: ["platform_integration_id"]
            isOneToOne: false
            referencedRelation: "platform_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_dims: {
        Row: {
          ad_account_id: string
          adset_external_id: string
          adset_id: string | null
          campaign_id: string | null
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
          adset_id?: string | null
          campaign_id?: string | null
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
          adset_id?: string | null
          campaign_id?: string | null
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
          {
            foreignKeyName: "ad_dims_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "adset_dims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_dims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_dims"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_performance_summary: {
        Row: {
          ad_account_id: string
          ad_id: string
          adset_id: string | null
          calls: number
          campaign_id: string | null
          clicks: number
          cost_per_result: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          first_day: string | null
          frequency: number | null
          history_status: string
          impressions: number
          inline_link_clicks: number
          last_day: string | null
          leads: number
          messages: number
          reach: number
          spend: number
          summary_source: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          adset_id?: string | null
          calls?: number
          campaign_id?: string | null
          clicks?: number
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          first_day?: string | null
          frequency?: number | null
          history_status?: string
          impressions?: number
          inline_link_clicks?: number
          last_day?: string | null
          leads?: number
          messages?: number
          reach?: number
          spend?: number
          summary_source?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          adset_id?: string | null
          calls?: number
          campaign_id?: string | null
          clicks?: number
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          first_day?: string | null
          frequency?: number | null
          history_status?: string
          impressions?: number
          inline_link_clicks?: number
          last_day?: string | null
          leads?: number
          messages?: number
          reach?: number
          spend?: number
          summary_source?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_performance_summary_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_performance_summary_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: true
            referencedRelation: "ad_dims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_performance_summary_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "adset_dims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_performance_summary_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_dims"
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
          campaign_id: string | null
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
          campaign_id?: string | null
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
          campaign_id?: string | null
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
          {
            foreignKeyName: "adset_dims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_dims"
            referencedColumns: ["id"]
          },
        ]
      }
      adset_performance_summary: {
        Row: {
          ad_account_id: string
          adset_id: string
          calls: number
          campaign_id: string | null
          clicks: number
          cost_per_result: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          first_day: string | null
          frequency: number | null
          history_status: string
          impressions: number
          inline_link_clicks: number
          last_day: string | null
          leads: number
          messages: number
          reach: number
          spend: number
          summary_source: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          adset_id: string
          calls?: number
          campaign_id?: string | null
          clicks?: number
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          first_day?: string | null
          frequency?: number | null
          history_status?: string
          impressions?: number
          inline_link_clicks?: number
          last_day?: string | null
          leads?: number
          messages?: number
          reach?: number
          spend?: number
          summary_source?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          adset_id?: string
          calls?: number
          campaign_id?: string | null
          clicks?: number
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          first_day?: string | null
          frequency?: number | null
          history_status?: string
          impressions?: number
          inline_link_clicks?: number
          last_day?: string | null
          leads?: number
          messages?: number
          reach?: number
          spend?: number
          summary_source?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adset_performance_summary_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adset_performance_summary_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: true
            referencedRelation: "adset_dims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adset_performance_summary_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_dims"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          preferred_platforms?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_queue_items: {
        Row: {
          ad_account_id: string
          business_id: string
          campaign_draft_id: string | null
          child_blueprints_json: Json
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          destination_href: string | null
          dismissed_at: string | null
          due_date: string | null
          id: string
          item_type: string
          materialized_from_blueprint_key: string | null
          parent_queue_item_id: string | null
          payload_json: Json
          platform_integration_id: string
          priority: string
          scheduled_for: string | null
          source_signal_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
          workflow_key: string | null
        }
        Insert: {
          ad_account_id: string
          business_id: string
          campaign_draft_id?: string | null
          child_blueprints_json?: Json
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          destination_href?: string | null
          dismissed_at?: string | null
          due_date?: string | null
          id?: string
          item_type: string
          materialized_from_blueprint_key?: string | null
          parent_queue_item_id?: string | null
          payload_json?: Json
          platform_integration_id: string
          priority?: string
          scheduled_for?: string | null
          source_signal_id?: string | null
          source_type?: string
          status?: string
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
          workflow_key?: string | null
        }
        Update: {
          ad_account_id?: string
          business_id?: string
          campaign_draft_id?: string | null
          child_blueprints_json?: Json
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          destination_href?: string | null
          dismissed_at?: string | null
          due_date?: string | null
          id?: string
          item_type?: string
          materialized_from_blueprint_key?: string | null
          parent_queue_item_id?: string | null
          payload_json?: Json
          platform_integration_id?: string
          priority?: string
          scheduled_for?: string | null
          source_signal_id?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
          workflow_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_queue_items_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_queue_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_queue_items_campaign_draft_id_fkey"
            columns: ["campaign_draft_id"]
            isOneToOne: false
            referencedRelation: "campaign_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_queue_items_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_queue_items_parent_queue_item_id_fkey"
            columns: ["parent_queue_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_queue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_queue_items_platform_integration_id_fkey"
            columns: ["platform_integration_id"]
            isOneToOne: false
            referencedRelation: "platform_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_queue_items_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
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
      campaign_drafts: {
        Row: {
          ad_account_id: string
          business_id: string
          created_at: string
          created_by_user_id: string
          id: string
          payload_json: Json
          platform_integration_id: string
          review_notes: string | null
          source_action_id: string | null
          status: string
          title: string | null
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          ad_account_id: string
          business_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          payload_json?: Json
          platform_integration_id: string
          review_notes?: string | null
          source_action_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          ad_account_id?: string
          business_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          payload_json?: Json
          platform_integration_id?: string
          review_notes?: string | null
          source_action_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drafts_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_drafts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_drafts_platform_integration_id_fkey"
            columns: ["platform_integration_id"]
            isOneToOne: false
            referencedRelation: "platform_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_drafts_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_performance_summary: {
        Row: {
          ad_account_id: string
          calls: number
          campaign_id: string
          clicks: number
          cost_per_result: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          first_day: string | null
          frequency: number | null
          history_status: string
          impressions: number
          inline_link_clicks: number
          last_day: string | null
          leads: number
          messages: number
          reach: number
          spend: number
          summary_source: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          calls?: number
          campaign_id: string
          clicks?: number
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          first_day?: string | null
          frequency?: number | null
          history_status?: string
          impressions?: number
          inline_link_clicks?: number
          last_day?: string | null
          leads?: number
          messages?: number
          reach?: number
          spend?: number
          summary_source?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          calls?: number
          campaign_id?: string
          clicks?: number
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          first_day?: string | null
          frequency?: number | null
          history_status?: string
          impressions?: number
          inline_link_clicks?: number
          last_day?: string | null
          leads?: number
          messages?: number
          reach?: number
          spend?: number
          summary_source?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_performance_summary_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_performance_summary_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaign_dims"
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
      organization_memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_org_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          primary_language: string
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          primary_language?: string
          type: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          primary_language?: string
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: []
      }
      platform_integrations: {
        Row: {
          access_token_secret_id: string | null
          business_id: string
          connected_at: string | null
          connected_by_user_id: string | null
          created_at: string
          disconnected_at: string | null
          id: string
          integration_details: Json
          last_error: string | null
          last_synced_at: string | null
          platform_id: string
          refresh_token_secret_id: string | null
          scopes: string[]
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_secret_id?: string | null
          business_id: string
          connected_at?: string | null
          connected_by_user_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          integration_details?: Json
          last_error?: string | null
          last_synced_at?: string | null
          platform_id: string
          refresh_token_secret_id?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_secret_id?: string | null
          business_id?: string
          connected_at?: string | null
          connected_by_user_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          id?: string
          integration_details?: Json
          last_error?: string | null
          last_synced_at?: string | null
          platform_id?: string
          refresh_token_secret_id?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
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
            foreignKeyName: "platform_integrations_connected_by_user_id_fkey"
            columns: ["connected_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          is_enabled: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          api_info?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          api_info?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
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
      accept_calendar_queue_workflow: {
        Args: { p_queue_item_id: string; p_user_id?: string | null }
        Returns: {
          ad_account_id: string
          business_id: string
          campaign_draft_id: string | null
          child_blueprints_json: Json
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          destination_href: string | null
          dismissed_at: string | null
          due_date: string | null
          id: string
          item_type: string
          materialized_from_blueprint_key: string | null
          parent_queue_item_id: string | null
          payload_json: Json
          platform_integration_id: string
          priority: string
          scheduled_for: string | null
          source_signal_id: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
          workflow_key: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "calendar_queue_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      can_access_account: {
        Args: { p_ad_account_id: string }
        Returns: boolean
      }
      claim_account_sync_job: {
        Args: { allowed_sync_types?: string[]; target_job_id?: string }
        Returns: {
          actual_end_date: string | null
          actual_start_date: string | null
          ad_account_id: string
          ads_synced: number
          adsets_synced: number
          business_id: string
          campaigns_synced: number
          created_at: string
          creatives_synced: number
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json
          performance_rows_synced: number
          platform_integration_id: string
          requested_end_date: string | null
          requested_start_date: string | null
          started_at: string | null
          status: string
          sync_type: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "account_sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_organization_with_owner: {
        Args: {
          org_name: string
          org_primary_language?: string
          org_type: Database["public"]["Enums"]["organization_type"]
        }
        Returns: string
      }
      get_org_role: {
        Args: { p_organization_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      get_platform_token: { Args: { secret_id: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_org_admin: { Args: { p_organization_id: string }; Returns: boolean }
      is_org_member: { Args: { p_organization_id: string }; Returns: boolean }
      obj_code: { Args: { raw: string }; Returns: string }
      obj_label: { Args: { raw: string }; Returns: string }
      store_platform_token: {
        Args: {
          secret_description?: string
          secret_name: string
          secret_value: string
        }
        Returns: string
      }
      upsert_platform_token: {
        Args: {
          secret_description?: string
          secret_name: string
          secret_value: string
        }
        Returns: string
      }
    }
    Enums: {
      business_role: "owner" | "admin" | "member"
      org_role: "owner" | "admin" | "member" | "viewer"
      organization_type: "agency" | "business"
      report_type: "weekly" | "monthly" | "custom"
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
  ai: {
    Enums: {},
  },
  public: {
    Enums: {
      business_role: ["owner", "admin", "member"],
      org_role: ["owner", "admin", "member", "viewer"],
      organization_type: ["agency", "business"],
      report_type: ["weekly", "monthly", "custom"],
    },
  },
} as const
