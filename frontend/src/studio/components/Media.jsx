import { useEffect, useRef, useState } from 'react';
import { readAsset } from '../services/database';
export function AssetImage({ assetId, src, alt, ...props }) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let live = true, url;
    if (assetId) readAsset(assetId).then(blob => { if (live && blob) { url = URL.createObjectURL(blob); setLoaded({id:assetId,url}); } }).catch(() => {});
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [assetId]);
  const image = assetId ? loaded?.id === assetId ? loaded.url : null : src;
  return image ? <img src={image} alt={alt} {...props} /> : <div className="image-missing" role="img" aria-label={alt}>Image unavailable</div>;
}
export function Dialog({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const previous = document.activeElement; const dialog = ref.current; dialog.showModal(); return () => { dialog.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className="studio studio-modal" aria-labelledby="dialog-title" onCancel={onClose} onClick={e => { if(e.target === ref.current) onClose(); }}><header><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></header>{children}</dialog>;
}
export function FileField({ onFile, personal = false }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [preview, setPreview] = useState(null);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => { if(!preview) return; return () => URL.revokeObjectURL(preview); }, [preview]);
  async function select(e) {
    const file = e.target.files?.[0], current = ++request.current;
    setError(''); setPreview(null); onFile(null); if(!file) return;
    setBusy(true);
    try {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
      if(file.size > 10 * 1024 * 1024 || file.size === 0) throw new Error('Choose a nonempty image smaller than 10 MB.');
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width, height = bitmap.height; bitmap.close();
      if(width < (personal?512:128) || height < (personal?512:128)) throw new Error(personal?'Personal photos must be at least 512 × 512 pixels.':'Garment images must be at least 128 × 128 pixels.');
      if(width * height > 40000000) throw new Error('Choose an image smaller than 40 megapixels.');
      if(current !== request.current) return;
      setPreview(URL.createObjectURL(file)); onFile({file,width,height});
    } catch(e) { if(current === request.current) setError(e.message || 'This image could not be read.'); }
    finally { if(current === request.current) setBusy(false); }
  }
  async function sample() { try { const response = await fetch(personal ? '/images/hero_fashion_1.png' : '/images/knit_sweater_card.png'); if(!response.ok) throw new Error('Sample image unavailable.'); const blob = await response.blob(); await select({target:{files:[new File([blob],'sample.png',{type:'image/png'})]}}); } catch(e){setError(e.message);} }
  return <div className="upload-area"><button type="button" className="text-button" disabled={busy} onClick={sample}>Use a labeled sample {personal?'photo':'garment'}</button><p>Sample imagery is for exploring the demo, never a generated result.</p><label>Choose image<input aria-label="Choose image" type="file" accept="image/jpeg,image/png,image/webp" onChange={select} /></label><p>JPEG, PNG or WebP · Up to 10 MB · {personal?'512':'128'} px minimum per side</p>{personal && <p>Use one person, good lighting, and an unobstructed pose. No automatic pose analysis is performed.</p>}{busy && <p role="status">Checking image…</p>}{error && <p className="form-error" role="alert">{error}</p>}{preview && <img className="upload-preview" src={preview} alt="Selected image preview" />}</div>;
}
export function Empty({ title, children, action }) { return <section className="empty-state"><span className="empty-symbol">d.</span><h2>{title}</h2><p>{children}</p>{action}</section>; }
