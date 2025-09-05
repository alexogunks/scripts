import { BrowserRouter, Routes, Route } from "react-router-dom"
import Registration from "./pages/registration"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={ <Registration />}/>
      </Routes>
    </BrowserRouter>
  )
};

export default App;