import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { api } from "../api";

const ACCESS_TOKEN_KEY = "complass_access_token";
const USER_KEY = "complass_user";
const SESSION_EXPIRES_KEY = "complass_session_expires_at";

export function FeishuAuthPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const expiresIn = searchParams.get("expires_in");
    const next = searchParams.get("next") || "/";

    if (!token) {
      setError("缺少 token 参数");
      return;
    }

    if (!expiresIn) {
      setError("缺少 expires_in 参数");
      return;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    localStorage.setItem(SESSION_EXPIRES_KEY, String(Date.now() + Number(expiresIn) * 1000));

    api
      .getMe(token)
      .then((user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        window.location.replace(next);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "获取用户信息失败");
      });
  }, [searchParams]);

  if (error) {
    return (
      <main className="auth-screen">
        <div className="auth-panel" style={{ textAlign: "center", padding: "2rem" }}>
          <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: "1rem" }} />
          <h2 style={{ marginBottom: "1rem" }}>认证失败</h2>
          <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>{error}</p>
          <a href="/" style={{ color: "var(--brand)" }}>
            返回首页
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <div className="auth-panel" style={{ textAlign: "center", padding: "2rem" }}>
        <Loader2 size={48} color="var(--brand)" style={{ marginBottom: "1rem", animation: "spin 1s linear infinite" }} />
        <h2 style={{ marginBottom: "1rem" }}>飞书授权登录中...</h2>
        <p style={{ color: "var(--muted)" }}>请稍候</p>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
