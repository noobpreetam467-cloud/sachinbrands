"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function signUpWithEmail(formData: FormData) {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 100 ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    redirect("/signup?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: name.trim(), name: name.trim() } },
  });

  if (error) {
    console.error("Supabase registration failed:", error.message);
    redirect(error.code === "user_already_exists" ? "/signup?error=exists" : "/signup?error=failed");
  }

  redirect("/signup?created=true");
}
