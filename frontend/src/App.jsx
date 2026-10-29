import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Studio, StudioLanding } from './studio/Studio';
import { StudioProvider } from './studio/StudioContext';
import { Account } from './studio/pages/Account';
export default function App() {
  return <BrowserRouter><StudioProvider><Routes><Route path="/" element={<StudioLanding />} /><Route path="/login" element={<Account />} /><Route path="/signup" element={<Account signup />} /><Route path="*" element={<Studio />} /></Routes></StudioProvider></BrowserRouter>;
}
