import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web',
    },
  },
  db: {
    schema: 'public',
  },
});

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  country_code: string;
  total_pv: number;
  is_active: boolean;
  referred_by: string | null;
  role: 'user' | 'admin' | 'manager';
  is_master: boolean;
  region?: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  account_status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  profile_image_url?: string | null;
  created_at: string;
  updated_at: string;
  countries?: {
    currency_code: string;
    currency_symbol: string;
  } | null;
}

export interface Branch {
  id: string;
  parent_id: string;
  child_id: string;
  is_active: boolean;
  created_at: string;
}

export interface PVTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'purchase' | 'meeting' | 'reward' | 'adjustment' | 'bonus';
  reference_id: string | null;
  reference_type: 'product' | 'meeting' | 'payment' | 'admin' | null;
  description: string | null;
  created_at: string;
}


export interface Notification {
  id: string;
  user_id: string;
  type: 'meeting' | 'promotion' | 'approval' | 'payment' | 'group' | 'system';
  title: string;
  message: string;
  title_key?: string | null;
  message_key?: string | null;
  message_params?: Record<string, string | number> | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  name_en?: string | null;
  product_type: string;
  product_type_en?: string | null;
  pv_value: number;
  description: string | null;
  description_en?: string | null;
  image_url: string | null;
  is_active: boolean;
}


export type PermissionType =
  | 'manage_orders'
  | 'manage_inventory'
  | 'manage_users'
  | 'manage_accounts'
  | 'manage_products'
  | 'manage_promotions';

export interface ManagerPermission {
  id: string;
  user_id: string;
  permission: PermissionType;
  regions: string[] | null;
  granted_by: string | null;
  created_at: string;
}

export interface Country {
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  tax_rate: number;
  is_active: boolean;
}
