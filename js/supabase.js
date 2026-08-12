import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://pzwhyoattlravuadbfvk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6d2h5b2F0dGxyYXZ1YWRiZnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzMyNDIsImV4cCI6MjEwMTkwOTI0Mn0.zBPnp7rVpR5ojidhuUCSQyUhA5VTFSCQosG_XtFXBWo';

export const supabase = createClient(supabaseUrl, supabaseKey);
