
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity": string,"entity_id": string | null,"id": string,"meta": NonNullable<Json>,"program_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: string,"meta"?: NonNullable<Json>,"program_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: string,"meta"?: NonNullable<Json>,"program_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"company_members": {
                  Row: {
                    "company_id": string,"created_at": string,"role": Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "company_members_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"email_log": {
                  Row: {
                    "error": string | null,"id": string,"kind": Database["public"]['Enums']["email_kind"],"program_id": string,"provider_id": string | null,"send_date": string,"sent_at": string,"status": string,"tester_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["email_kind"],"program_id": string,"provider_id"?: string | null,"send_date"?: string,"sent_at"?: string,"status"?: string,"tester_id": string
                  }
                  Update: {
                    "error"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["email_kind"],"program_id"?: string,"provider_id"?: string | null,"send_date"?: string,"sent_at"?: string,"status"?: string,"tester_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_log_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_log_tester_id_fkey"
      columns: ["tester_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "body": string,"context": NonNullable<Json>,"created_at": string,"duplicate_of": string | null,"id": string,"kind": Database["public"]['Enums']["feedback_kind"],"program_id": string,"screenshot_path": string | null,"severity": Database["public"]['Enums']["feedback_severity"] | null,"source": string,"status": Database["public"]['Enums']["feedback_status"],"tags": (string)[],"team_rating": number | null,"tester_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string,"context"?: NonNullable<Json>,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["feedback_kind"],"program_id": string,"screenshot_path"?: string | null,"severity"?: Database["public"]['Enums']["feedback_severity"] | null,"source"?: string,"status"?: Database["public"]['Enums']["feedback_status"],"tags"?: (string)[],"team_rating"?: number | null,"tester_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"context"?: NonNullable<Json>,"created_at"?: string,"duplicate_of"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["feedback_kind"],"program_id"?: string,"screenshot_path"?: string | null,"severity"?: Database["public"]['Enums']["feedback_severity"] | null,"source"?: string,"status"?: Database["public"]['Enums']["feedback_status"],"tags"?: (string)[],"team_rating"?: number | null,"tester_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "feedback"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_tester_id_fkey"
      columns: ["tester_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["id"]
    }
                  ]
                },"missions": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"position": number,"program_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"position"?: number,"program_id": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"position"?: number,"program_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "missions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"nominations": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"email": string,"id": string,"name": string,"nominated_by_tester_id": string,"program_id": string,"reason": string,"status": Database["public"]['Enums']["nomination_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"email": string,"id"?: string,"name": string,"nominated_by_tester_id": string,"program_id": string,"reason"?: string,"status"?: Database["public"]['Enums']["nomination_status"]
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"email"?: string,"id"?: string,"name"?: string,"nominated_by_tester_id"?: string,"program_id"?: string,"reason"?: string,"status"?: Database["public"]['Enums']["nomination_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "nominations_nominated_by_tester_id_fkey"
      columns: ["nominated_by_tester_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nominations_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "company_id": string,"created_at": string,"digest_enabled": boolean,"digest_interval_days": number,"digest_intro": string,"digest_send_hour": number,"digest_subject": string,"digest_timezone": string,"id": string,"name": string,"nomination_min_helpfulness": number,"nominations_per_tester": number,"nudge_inactive_days": number,"nudge_stuck_days": number,"nudges_enabled": boolean,"product_name": string,"terms_text": string,"terms_updated_at": string,"terms_version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"created_at"?: string,"digest_enabled"?: boolean,"digest_interval_days"?: number,"digest_intro"?: string,"digest_send_hour"?: number,"digest_subject"?: string,"digest_timezone"?: string,"id"?: string,"name": string,"nomination_min_helpfulness"?: number,"nominations_per_tester"?: number,"nudge_inactive_days"?: number,"nudge_stuck_days"?: number,"nudges_enabled"?: boolean,"product_name"?: string,"terms_text"?: string,"terms_updated_at"?: string,"terms_version"?: number
                  }
                  Update: {
                    "company_id"?: string,"created_at"?: string,"digest_enabled"?: boolean,"digest_interval_days"?: number,"digest_intro"?: string,"digest_send_hour"?: number,"digest_subject"?: string,"digest_timezone"?: string,"id"?: string,"name"?: string,"nomination_min_helpfulness"?: number,"nominations_per_tester"?: number,"nudge_inactive_days"?: number,"nudge_stuck_days"?: number,"nudges_enabled"?: boolean,"product_name"?: string,"terms_text"?: string,"terms_updated_at"?: string,"terms_version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "programs_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    }
                  ]
                },"referral_codes": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"label": string | null,"max_uses": number | null,"program_id": string,"revoked_at": string | null,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"label"?: string | null,"max_uses"?: number | null,"program_id": string,"revoked_at"?: string | null,"uses"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"label"?: string | null,"max_uses"?: number | null,"program_id"?: string,"revoked_at"?: string | null,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "referral_codes_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"rewards": {
                  Row: {
                    "badge": string,"created_at": string,"description": string,"id": string,"metric": Database["public"]['Enums']["reward_metric"],"name": string,"program_id": string,"threshold": number
                  }
                  ComputedFields: never
                  Insert: {
                    "badge"?: string,"created_at"?: string,"description"?: string,"id"?: string,"metric": Database["public"]['Enums']["reward_metric"],"name": string,"program_id": string,"threshold": number
                  }
                  Update: {
                    "badge"?: string,"created_at"?: string,"description"?: string,"id"?: string,"metric"?: Database["public"]['Enums']["reward_metric"],"name"?: string,"program_id"?: string,"threshold"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rewards_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"terms_acceptances": {
                  Row: {
                    "accepted_at": string,"id": string,"terms_version": number,"tester_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"id"?: string,"terms_version": number,"tester_id": string
                  }
                  Update: {
                    "accepted_at"?: string,"id"?: string,"terms_version"?: number,"tester_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "terms_acceptances_tester_id_fkey"
      columns: ["tester_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["id"]
    }
                  ]
                },"tester_missions": {
                  Row: {
                    "completed_at": string | null,"mission_id": string,"started_at": string | null,"status": Database["public"]['Enums']["mission_status"],"tester_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"mission_id": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["mission_status"],"tester_id": string,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"mission_id"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["mission_status"],"tester_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tester_missions_mission_id_fkey"
      columns: ["mission_id"]
isOneToOne: false
      referencedRelation: "missions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tester_missions_tester_id_fkey"
      columns: ["tester_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["id"]
    }
                  ]
                },"tester_rewards": {
                  Row: {
                    "earned_at": string,"reward_id": string,"tester_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "earned_at"?: string,"reward_id": string,"tester_id": string
                  }
                  Update: {
                    "earned_at"?: string,"reward_id"?: string,"tester_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tester_rewards_reward_id_fkey"
      columns: ["reward_id"]
isOneToOne: false
      referencedRelation: "rewards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tester_rewards_tester_id_fkey"
      columns: ["tester_id"]
isOneToOne: false
      referencedRelation: "testers"
      referencedColumns: ["id"]
    }
                  ]
                },"testers": {
                  Row: {
                    "access_revoked_at": string | null,"bugs_count": number,"created_at": string,"email": string,"helpfulness": number,"id": string,"last_active_at": string | null,"name": string,"notes": string,"program_id": string,"progress": number,"referral_code_id": string | null,"responses_count": number,"stage": Database["public"]['Enums']["tester_stage"],"terms_accepted_at": string | null,"terms_version_accepted": number | null,"tips_count": number,"unsubscribed_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "access_revoked_at"?: string | null,"bugs_count"?: number,"created_at"?: string,"email": string,"helpfulness"?: number,"id"?: string,"last_active_at"?: string | null,"name": string,"notes"?: string,"program_id": string,"progress"?: number,"referral_code_id"?: string | null,"responses_count"?: number,"stage"?: Database["public"]['Enums']["tester_stage"],"terms_accepted_at"?: string | null,"terms_version_accepted"?: number | null,"tips_count"?: number,"unsubscribed_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "access_revoked_at"?: string | null,"bugs_count"?: number,"created_at"?: string,"email"?: string,"helpfulness"?: number,"id"?: string,"last_active_at"?: string | null,"name"?: string,"notes"?: string,"program_id"?: string,"progress"?: number,"referral_code_id"?: string | null,"responses_count"?: number,"stage"?: Database["public"]['Enums']["tester_stage"],"terms_accepted_at"?: string | null,"terms_version_accepted"?: number | null,"tips_count"?: number,"unsubscribed_at"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "testers_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "testers_referral_code_id_fkey"
      columns: ["referral_code_id"]
isOneToOne: false
      referencedRelation: "referral_codes"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_deliveries": {
                  Row: {
                    "attempts": number,"created_at": string,"delivered_at": string | null,"event": string,"failed_at": string | null,"id": string,"last_error": string | null,"last_status": number | null,"next_attempt_at": string,"payload": NonNullable<Json>,"program_id": string,"webhook_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"event": string,"failed_at"?: string | null,"id"?: string,"last_error"?: string | null,"last_status"?: number | null,"next_attempt_at"?: string,"payload": NonNullable<Json>,"program_id": string,"webhook_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"event"?: string,"failed_at"?: string | null,"id"?: string,"last_error"?: string | null,"last_status"?: number | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"program_id"?: string,"webhook_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_deliveries_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "webhook_deliveries_webhook_id_fkey"
      columns: ["webhook_id"]
isOneToOne: false
      referencedRelation: "webhooks"
      referencedColumns: ["id"]
    }
                  ]
                },"webhooks": {
                  Row: {
                    "active": boolean,"created_at": string,"events": (string)[],"id": string,"program_id": string,"secret": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"events"?: (string)[],"id"?: string,"program_id": string,"secret": string,"url": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"events"?: (string)[],"id"?: string,"program_id"?: string,"secret"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhooks_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_terms":
{ Args: { "p_tester_id": string }; Returns: undefined
                           },
"award_rewards":
{ Args: { "p_tester_id": string }; Returns: undefined
                           },
"can_edit_program":
{ Args: { "p_program_id": string }; Returns: boolean
                           },
"can_nominate":
{ Args: { "p_tester_id": string }; Returns: boolean
                           },
"enqueue_webhook_event":
{ Args: { "p_data": Json,"p_event": string,"p_program_id": string }; Returns: undefined
                           },
"has_company_role":
{ Args: { "p_company_id": string,"p_roles": (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"has_program_role":
{ Args: { "p_program_id": string,"p_roles": (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"is_company_member":
{ Args: { "p_company_id": string }; Returns: boolean
                           },
"is_my_tester":
{ Args: { "p_tester_id": string }; Returns: boolean
                           },
"is_program_member":
{ Args: { "p_program_id": string }; Returns: boolean
                           },
"is_program_tester":
{ Args: { "p_program_id": string }; Returns: boolean
                           },
"recompute_tester_stats":
{ Args: { "p_tester_id": string }; Returns: undefined
                           },
"redeem_referral_code":
{ Args: { "p_code": string }; Returns: {
              "code_id": string,"program_id": string
            }[]
                           },
"release_referral_code":
{ Args: { "p_code_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "email_kind": "digest"|"nudge"|"fix_notice"|"invite","feedback_kind": "bug"|"tip"|"response","feedback_severity": "low"|"medium"|"high","feedback_status": "new"|"acknowledged"|"fixed"|"wontfix","member_role": "owner"|"admin"|"viewer","mission_status": "todo"|"doing"|"done","nomination_status": "pending"|"approved"|"rejected","reward_metric": "helpfulness"|"bugs_count"|"tips_count"|"responses_count"|"progress","tester_stage": "invited"|"onboarded"|"testing"|"feedback_sent"|"completed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "email_kind": ["digest", "nudge", "fix_notice", "invite"],"feedback_kind": ["bug", "tip", "response"],"feedback_severity": ["low", "medium", "high"],"feedback_status": ["new", "acknowledged", "fixed", "wontfix"],"member_role": ["owner", "admin", "viewer"],"mission_status": ["todo", "doing", "done"],"nomination_status": ["pending", "approved", "rejected"],"reward_metric": ["helpfulness", "bugs_count", "tips_count", "responses_count", "progress"],"tester_stage": ["invited", "onboarded", "testing", "feedback_sent", "completed"]
          }
        }
} as const
