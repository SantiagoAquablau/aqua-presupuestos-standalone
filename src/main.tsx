import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Quan es publica una nova versio, els chunks JS de la versio anterior
// desapareixen del servidor. Si una pestanya oberta des d'abans intenta
// carregar-ne un, Vite dispara aquest esdeveniment; recarreguem la pagina
// per obtenir els chunks nous. Guardem un flag a sessionStorage per evitar
// un bucle infinit si l'error persisteix despres de recarregar.
window.addEventListener("vite:preloadError", () => {
  const alreadyReloaded = sessionStorage.getItem("reloaded_after_chunk_error");
  if (alreadyReloaded) {
    window.alert(
      "Hi ha una nova versio de l'aplicacio disponible. Si us plau, recarrega la pagina manualment (F5) per continuar."
    );
    return;
  }
  sessionStorage.setItem("reloaded_after_chunk_error", "1");
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
