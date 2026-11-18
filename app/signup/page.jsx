import AuthForm from "../auth-form";

export const metadata = {
  title: "Регистрация — Bilim Hub",
  description: "Создание аккаунта студента Bilim Hub.",
};

export default function SignupPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  return <AuthForm mode="signup" configured={configured} />;
}
