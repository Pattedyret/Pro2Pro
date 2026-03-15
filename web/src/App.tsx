import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Callback } from './pages/Callback';
import { Daily } from './pages/Daily';
import { PastDaily } from './pages/PastDaily';
import { Archive } from './pages/Archive';
import { Random } from './pages/Random';
import { Custom } from './pages/Custom';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter basename="/Pro2Pro">
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/callback" element={<Callback />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/daily/:number" element={<PastDaily />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/random" element={<Random />} />
            <Route path="/custom" element={<Custom />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
