import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://cffjcobipldadwsgcwlx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZmpjb2JpcGxkYWR3c2djd2x4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMzE0NTcsImV4cCI6MjA2MzYwNzQ1N30.gFriwuZCHItlAFhutPUqZSoplKEGMWqIqoJcBrDOtCQ'
)