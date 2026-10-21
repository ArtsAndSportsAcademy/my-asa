import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { iniciarAlertaDeErros } from "./lib/alerta-de-erros";

iniciarAlertaDeErros();
createRoot(document.getElementById("root")!).render(<App />);
