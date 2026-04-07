import { Routes, Route } from "react-router-dom";
import { OperatorPage } from "./pages/OperatorPage";
import { DisplayPage } from "./pages/DisplayPage";
import "./styles/tokens.css";
import "./styles/global.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<OperatorPage />} />
      <Route path="/display" element={<DisplayPage />} />
    </Routes>
  );
}

export default App;
