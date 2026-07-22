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
      import_report_items: {
        Row: {
          created_at: string
          details: Json
          file_name: string | null
          id: string
          message: string | null
          report_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json
          file_name?: string | null
          id?: string
          message?: string | null
          report_id: string
          status: string
        }
        Update: {
          created_at?: string
          details?: Json
          file_name?: string | null
          id?: string
          message?: string | null
          report_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "import_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      import_reports: {
        Row: {
          created_at: string
          id: string
          kind: string
          summary: Json
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          summary?: Json
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          summary?: Json
          triggered_by?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          category: string
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          filename: string
          id: string
          metadata: Json
          product_id: string | null
          subcategory: string | null
          title: string
        }
        Insert: {
          category: string
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          filename: string
          id?: string
          metadata?: Json
          product_id?: string | null
          subcategory?: string | null
          title: string
        }
        Update: {
          category?: string
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          filename?: string
          id?: string
          metadata?: Json
          product_id?: string | null
          subcategory?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          bytes: number | null
          category: string
          chunk_count: number
          content: string | null
          content_hash: string | null
          created_at: string
          error_message: string | null
          file_type: string | null
          filename: string
          id: string
          internal_title: string | null
          is_duplicate_of: string | null
          original_file: string | null
          requires_review: boolean
          source_path: string
          status: string
          storage_path: string | null
          subcategory: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          bytes?: number | null
          category: string
          chunk_count?: number
          content?: string | null
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          file_type?: string | null
          filename: string
          id?: string
          internal_title?: string | null
          is_duplicate_of?: string | null
          original_file?: string | null
          requires_review?: boolean
          source_path: string
          status?: string
          storage_path?: string | null
          subcategory?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          bytes?: number | null
          category?: string
          chunk_count?: number
          content?: string | null
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          file_type?: string | null
          filename?: string
          id?: string
          internal_title?: string | null
          is_duplicate_of?: string | null
          original_file?: string | null
          requires_review?: boolean
          source_path?: string
          status?: string
          storage_path?: string | null
          subcategory?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_is_duplicate_of_fkey"
            columns: ["is_duplicate_of"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aliases: {
        Row: {
          alias: string
          alias_normalized: string
          created_at: string
          id: string
          origin: string
          product_id: string
        }
        Insert: {
          alias: string
          alias_normalized: string
          created_at?: string
          id?: string
          origin?: string
          product_id: string
        }
        Update: {
          alias?: string
          alias_normalized?: string
          created_at?: string
          id?: string
          origin?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_queue: {
        Row: {
          created_at: string
          details: Json
          id: string
          product_id: string | null
          reason: string
          resolution_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          product_id?: string | null
          reason: string
          resolution_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          product_id?: string | null
          reason?: string
          resolution_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_review_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          animal_phase: string | null
          category: string | null
          composition: string | null
          consumption: string | null
          created_at: string
          description: string | null
          duplicate_of: string | null
          extra: Json
          guarantee_levels: string | null
          id: string
          indication: string | null
          is_duplicate: boolean
          official_name: string
          package_weight: string | null
          requires_review: boolean
          slug: string
          source_document: string | null
          source_updated_at: string | null
          species: string | null
          updated_at: string
          usage_instructions: string | null
        }
        Insert: {
          active?: boolean
          animal_phase?: string | null
          category?: string | null
          composition?: string | null
          consumption?: string | null
          created_at?: string
          description?: string | null
          duplicate_of?: string | null
          extra?: Json
          guarantee_levels?: string | null
          id?: string
          indication?: string | null
          is_duplicate?: boolean
          official_name: string
          package_weight?: string | null
          requires_review?: boolean
          slug: string
          source_document?: string | null
          source_updated_at?: string | null
          species?: string | null
          updated_at?: string
          usage_instructions?: string | null
        }
        Update: {
          active?: boolean
          animal_phase?: string | null
          category?: string | null
          composition?: string | null
          consumption?: string | null
          created_at?: string
          description?: string | null
          duplicate_of?: string | null
          extra?: Json
          guarantee_levels?: string | null
          id?: string
          indication?: string | null
          is_duplicate?: boolean
          official_name?: string
          package_weight?: string | null
          requires_review?: boolean
          slug?: string
          source_document?: string | null
          source_updated_at?: string | null
          species?: string | null
          updated_at?: string
          usage_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_source_document_fkey"
            columns: ["source_document"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          category: string
          content: string
          document_id: string
          filename: string
          id: string
          similarity: number
          subcategory: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
