import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Credencials incorrectes");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <img src="/pdf/logo-color.png" alt="Aquablau" className="h-20 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Pressupostos</h1>
          <p className="text-muted-foreground mt-1">Piscines Aquablau · Gestió de Pressupostos</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card rounded-2xl border border-border p-8 shadow-elevated space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Correu electrònic</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              placeholder="nom@aquablau.cat"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Contrasenya</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-primary-foreground py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Iniciant sessió..." : "Iniciar sessió"}
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Només els administradors poden crear nous usuaris.
          </p>
        </form>
      </div>
    </div>
  );
}
