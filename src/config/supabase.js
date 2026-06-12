const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials missing in environment variables.");
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = supabase;
