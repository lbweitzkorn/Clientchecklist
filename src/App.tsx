import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TimelineList } from './pages/TimelineList';
import { TimelineDetail } from './pages/TimelineDetail';
import { ClientView } from './pages/ClientView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TimelineList />} />
        <Route path="/timeline/:id" element={<TimelineDetail />} />
        <Route path="/client" element={<ClientView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
