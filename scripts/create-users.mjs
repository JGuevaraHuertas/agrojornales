import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

/**
 * USUARIOS (según tu Excel)
 * INFORMACION (Javier) = ADMIN
 */
const users = [
  { email: "jpaulino@agrokasa.com.pe", password: "jpaulino2025", role: "JEFE" },
  { email: "ediaz@agrokasa.com.pe", password: "ediaz2025", role: "JEFE" },
  { email: "jbazalar@agrokasa.com.pe", password: "jbazalar2025", role: "JEFE" },
  { email: "hsoto@agrokasa.com.pe", password: "hsoto2025", role: "JEFE" },
  { email: "mbuitron@agrokasa.com.pe", password: "mbuitron2025", role: "JEFE" },
  { email: "cfung@agrokasa.com.pe", password: "cfung2025", role: "JEFE" },
  { email: "calvarez@agrokasa.com.pe", password: "calvarez2025", role: "JEFE" },
  { email: "cpena@agrokasa.com.pe", password: "cpena2025", role: "JEFE" },

  // ADMIN
  { email: "jguevara@agrokasa.com.pe", password: "jguevara2025", role: "ADMIN" },
];

for (const u of users) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: {
      role: u.role,
    },
  });

  if (error) {
    console.log(`❌ ${u.email}: ${error.message}`);
  } else {
    console.log(`✅ ${u.email} creado (id=${data.user.id})`);
  }
}

console.log("🎉 Proceso terminado");
