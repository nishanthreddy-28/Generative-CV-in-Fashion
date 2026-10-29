import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Image, Shirt, Compass, ScanLine, Heart, UserRound, ArrowUpRight, ArrowRight, ChevronRight, CircleHelp, Menu, X, Info } from 'lucide-react';
const Icons = { LayoutDashboard, Image, Shirt, Compass, ScanLine, Heart, UserRound, ArrowUpRight, ArrowRight, ChevronRight, CircleHelp, Menu, X, Info };
import { navigation, resolvePage } from './navigation';
import './studio.css';
import { useStudio } from './StudioContext';
import { logout } from './services/auth';
import { Wardrobe } from './pages/Wardrobe';
import { Photos } from './pages/Photos';
import { Onboarding, Profile } from './pages/Account';

function Glyph({ name, ...props }) { const Icon = Icons[name]; return <Icon size={19} aria-hidden="true" {...props} />; }
function Brand() { return <Link className="studio-brand" to="/"><span className="brand-mark">d.</span><span>Drape & Drop<small>THE PERSONAL STYLE STUDIO</small></span></Link>; }

export function StudioLanding() {
  return <div className="studio landing"><header><Brand /><Link className="studio-button outline" to="/dashboard">Explore the studio <Glyph name="ArrowUpRight" /></Link></header><main id="main"><div className="landing-copy"><p className="eyebrow">A MORE PERSONAL WAY TO GET DRESSED</p><h1>Your style.<br />A new perspective.</h1><p>A considered home for your wardrobe, your inspiration, and the looks you want to explore.</p><Link className="studio-button" to="/dashboard">Step into your studio <Glyph name="ArrowRight" /></Link><p className="fine">Local frontend demo · Browser storage · CV integration pending</p></div><div className="landing-image"><img src="/images/hero_fashion_1.png" alt="Editorial fashion portrait" /><span>THE EVERYDAY, REIMAGINED.</span></div></main><footer>Drape & Drop <span>Collect. Consider. Create.</span></footer></div>;
}

export function Studio() {
  const { user, reload } = useStudio();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const trigger = useRef(null);
  const drawer = useRef(null);
  const page = resolvePage(location.pathname) || (location.pathname === '/onboarding' ? { label: 'Welcome' } : null);
  useEffect(() => {
    if (!menu) return;
    const previous = document.body.style.overflow;
    const triggerButton = trigger.current;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector('button')?.focus();
    function key(event) {
      if (event.key === 'Escape') setMenu(false);
      if (event.key === 'Tab') {
        const nodes = drawer.current.querySelectorAll('a, button');
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); triggerButton?.focus(); };
  }, [menu]);
  if (!user) return <Navigate to="/login" replace />;
  async function signOut() { logout(); await reload(); navigate('/login'); }
  const links = <>{navigation.map(item => <NavLink key={item.path} to={item.path} onClick={() => setMenu(false)}><Glyph name={item.icon} />{item.label}<Glyph name="ChevronRight" className="nav-arrow" /></NavLink>)}</>;
  return <div className="studio"><a className="skip-link" href="#main">Skip to content</a><aside className="studio-sidebar"><Brand /><p className="eyebrow nav-heading">YOUR STUDIO</p><nav aria-label="Main navigation">{links}{user.role === 'ADMIN' && <NavLink to="/admin">Admin studio</NavLink>}</nav><div className="sidebar-note"><Glyph name="ScanLine" /><strong>A little closer to your next look.</strong><p>Virtual try-on is being prepared. Your style starts here.</p></div><div className="studio-account"><span className="avatar">{user.name[0]}</span><div>{user.name}<small>Local demo · {user.role.toLowerCase()}</small></div><button className="icon-button" aria-label="Sign out" onClick={signOut}><Glyph name="CircleHelp" /></button></div></aside><div className="studio-content"><header className="studio-topbar"><button ref={trigger} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(true)}><Glyph name="Menu" /></button><div className="breadcrumb">Your studio <span>/</span> {page?.label || 'Page not found'}</div><span className="preview-badge"><span /> Local demo</span></header><main id="main" tabIndex={-1}>{page ? location.pathname === '/dashboard' ? <Overview /> : location.pathname === '/onboarding' ? <Onboarding /> : location.pathname === '/profile' ? <Profile /> : location.pathname === '/photos' ? <Photos /> : location.pathname === '/wardrobe' ? <Wardrobe /> : <FoundationPage page={page} /> : <section className="page-heading"><p className="eyebrow">404</p><h1>A little off the runway.</h1><p>This page doesn’t exist.</p><Link to="/dashboard" className="studio-button">Back to your studio</Link></section>}</main><footer className="studio-footer">Made for your individual style.<span>Drape & Drop / Studio 01</span></footer></div>{menu && <div className="drawer-backdrop" onClick={() => setMenu(false)}><div ref={drawer} className="studio-drawer" role="dialog" aria-modal="true" aria-label="Navigation" onClick={e => e.stopPropagation()}><button className="icon-button drawer-close" aria-label="Close navigation" onClick={() => setMenu(false)}><Glyph name="X" /></button><Brand /><nav aria-label="Mobile navigation">{links}</nav></div></div>}</div>;
}
function Overview() {
  return <><section className="page-heading"><p className="eyebrow">A SPACE THAT’S ENTIRELY YOURS</p><div className="heading-row"><div><h1>Welcome to your studio.</h1><p>Good style starts with a little exploration.</p></div><Link to="/try-on" className="studio-button">Explore try-on <Glyph name="ArrowUpRight" /></Link></div></section><section className="editorial-hero"><div className="hero-copy"><span className="eyebrow">YOUR WARDROBE, REIMAGINED</span><h2>See the possibilities.<br /><em>Find your perspective.</em></h2><p>Bring your favorite pieces together in one thoughtful space. A new way to explore how you dress.</p><Link className="studio-button light" to="/wardrobe">Explore my wardrobe <Glyph name="ArrowRight" /></Link><span className="hero-caption">CURATED BY YOU. MADE FOR YOU.</span></div><img src="/images/hero_fashion_1.png" alt="Fashion editorial exploring personal style" /></section><section className="getting-started"><div className="section-title"><h2>Make yourself at home</h2><span>YOUR FIRST THREE STEPS</span></div><div className="steps">{[{number:'01',icon:'Image',title:'Start with you',text:'A well-lit photo is the starting point for your future try-ons.',to:'/photos',action:'Explore photos'},{number:'02',icon:'Shirt',title:'Collect your pieces',text:'Give your everyday favorites a place in your personal wardrobe.',to:'/wardrobe',action:'Explore wardrobe'},{number:'03',icon:'Compass',title:'Find something new',text:'Discover a considered collection of pieces to inspire your next look.',to:'/catalog',action:'Explore catalog'}].map(step=><article key={step.number}><div className="step-top"><Glyph name={step.icon} /><span>{step.number}</span></div><h3>{step.title}</h3><p>{step.text}</p><Link to={step.to}>{step.action}<Glyph name="ArrowUpRight" /></Link></article>)}</div></section><section className="integration-note"><Glyph name="Info" /><div><strong>A note on virtual try-on</strong><p>This studio stores demo records and images in your browser. The CV model is not connected, and no generated results are shown.</p></div><Link to="/try-on" aria-label="Read about virtual try-on"><Glyph name="ArrowRight" /></Link></section></>;
}
function FoundationPage({ page }) {
  return <><section className="page-heading"><p className="eyebrow">YOUR PERSONAL STYLE STUDIO</p><h1>{page.label}</h1><p>{page.description}</p></section><section className="foundation-state"><span className="foundation-icon"><Glyph name={page.icon} size={30} /></span><p className="eyebrow">UP NEXT IN YOUR STUDIO</p><h2>{page.path === '/try-on' ? 'A new perspective is on its way.' : 'A thoughtful space, taking shape.'}</h2><p>{page.path === '/try-on' ? 'CV integration is unavailable. This workspace will let you choose your photo and one garment, submit a session, and follow its status. No image generation is performed.' : 'This page is part of the approved sitemap. Its interactive workflow will be implemented and verified in a separate milestone.'}</p><Link className="studio-button outline" to="/dashboard">Back to overview <Glyph name="ArrowRight" /></Link></section></>;
}
