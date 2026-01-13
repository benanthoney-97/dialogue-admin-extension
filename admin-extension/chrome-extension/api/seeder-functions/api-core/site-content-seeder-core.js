const path = require("path");
const fetch = globalThis.fetch || require("node-fetch");
const os = require("os");
const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg"); // maybe not needed? we only use supabase?
