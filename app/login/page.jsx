import AuthForm from "../auth-form";

export const metadata = {
  title: "Вход — Bilim Hub",
  description: "Вход в личный кабинет Bilim Hub.",
};

export default function LoginPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  return <AuthForm mode="login" configured={configured} />;
}
