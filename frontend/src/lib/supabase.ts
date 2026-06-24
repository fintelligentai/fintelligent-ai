import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://thxcmjkzxqsncgaqufvc.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoeGNtamt6eHFzbmNnYXF1ZnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDc3NjEsImV4cCI6MjA5NzUyMzc2MX0.CkY-9g_sFB8WJe2OevuwQDYGL2zPg3oIJsHz6Nleeb4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
