import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Supabaseにユーザーを保存（初回のみ）
      const { error } = await supabase.from("users").upsert(
        {
          id: user.id,
          email: user.email,
          display_name: user.name,
          auth_provider: "google",
        },
        { onConflict: "email" }
      );
      return !error;
    },
    async session({ session, token }) {
      // セッションにユーザーIDを追加
      if (session.user) {
        // emailからDB上のIDを取得
        const { data } = await supabase
          .from("users")
          .select("id")
          .eq("email", session.user.email)
          .single();
        if (data) {
          (session.user as any).id = data.id;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export { handler as GET, handler as POST };
