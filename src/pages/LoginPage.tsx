import type { FormEvent } from "react";
import { RefreshCw, Scale, ShieldCheck } from "lucide-react";

export interface LoginPageProps {
  authMode: "login" | "register";
  authEmail: string;
  authName: string;
  authPassword: string;
  notice: string;
  busy: (label: string) => boolean;
  handleAuth: (event: FormEvent<HTMLFormElement>) => void;
  setAuthEmail: (value: string) => void;
  setAuthName: (value: string) => void;
  setAuthPassword: (value: string) => void;
  setAuthMode: (value: "login" | "register") => void;
}

export function LoginPage(props: LoginPageProps) {
  const {
    authMode,
    authEmail,
    authName,
    authPassword,
    notice,
    busy,
    handleAuth,
    setAuthEmail,
    setAuthName,
    setAuthPassword,
    setAuthMode
  } = props;

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <div className="brand-mark">
          <Scale size={30} />
        </div>
        <p className="eyebrow">COMPLASS</p>
        <h1>合规罗盘</h1>
        <p>上传合同、定位风险、复核建议，并把最终文本导出为清洁版本。</p>
        <div className="auth-proof">
          <span>单合同审查</span>
          <span>版本差异比对</span>
          <span>人工复核闭环</span>
        </div>
      </section>
      <form className="auth-panel" onSubmit={handleAuth}>
        <div>
          <p className="eyebrow">{authMode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</p>
          <h2>{authMode === "login" ? "登录工作台" : "注册账号"}</h2>
        </div>
        <label>
          邮箱
          <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} type="email" placeholder="user@example.com" />
        </label>
        {authMode === "register" && (
          <label>
            昵称
            <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="请输入昵称" />
          </label>
        )}
        <label>
          密码
          <input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} type="password" placeholder="至少 6 位" />
        </label>
        {notice && <div className="notice-panel warning">{notice}</div>}
        <button className="primary-action large" disabled={busy("auth")}>
          {busy("auth") ? <RefreshCw className="spin" size={18} /> : <ShieldCheck size={18} />}
          {authMode === "login" ? "登录" : "注册并登录"}
        </button>
        <button type="button" className="link-button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
          {authMode === "login" ? "没有账号？注册" : "已有账号？登录"}
        </button>
      </form>
    </main>
  );
}
