import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Studio, StudioLanding } from './studio/Studio';

export default function App() {
  return <BrowserRouter><Routes><Route path="/" element={<StudioLanding />} /><Route path="*" element={<Studio />} /></Routes></BrowserRouter>;
}
