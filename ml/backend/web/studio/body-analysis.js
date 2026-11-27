const el = id => document.getElementById(id);
let pending, pendingFile;
const status = message => { el('body-status').textContent = message; };
const fields = [
    ['shoulder_landmark_span_cm', 'Shoulder landmark span (cm)', 5.1, 109.9, .1],
    ['clothed_waist_front_width_cm', 'Clothed waist FRONT width (cm, not circumference)', 5.1, 149.9, .1],
    ['torso_landmark_length_cm', 'Torso landmark length (cm)', 5.1, 119.9, .1],
    ['shoulder_hip_ratio', 'Shoulder/hip landmark-span ratio', .31, 3.99, .01],
];
function review(value) {
    el('body-use-photo').disabled = !pendingFile;
    el('body-attributes').replaceChildren();
    const legend = document.createElement('legend'); legend.textContent = 'Review estimated attributes (editable)'; el('body-attributes').append(legend);
    for (const [name, title, min, max, step] of fields) {
        const label = document.createElement('label'), input = document.createElement('input'), original = document.createElement('small');
        input.id = `body-value-${name}`; input.type = 'number'; input.min = min; input.max = max; input.step = step; input.required = true; input.value = value[name];
        original.textContent = ` Original photo estimate: ${value.original_estimates[name]}`;
        input.oninput = () => { el('body-accept').checked = false; status('Values changed. Review and confirm before saving.'); };
        label.append(title + ' ', input, original); el('body-attributes').append(label);
    }
    el('body-metadata').textContent = `Calibrated to your entered height: ${value.reference_height_cm} cm. Analyzed image: ${value.image_width} × ${value.image_height}. These dimensions are approximate and unvalidated.`;
    el('body-accept').checked = false; el('body-confirm').hidden = false;
}
function invalidate(message) {
    pending = null; pendingFile = null; el('body-confirm').hidden = true; el('body-accept').checked = false; status(message);
    el('body-use-photo').disabled = true;
}
function maybeAnalyze() {
    const height = Number(el('body-height').value);
    if (el('body-photo').files[0] && height >= 80 && height <= 250) el('body-analyze').click();
}
el('body-photo').onchange = () => { invalidate('Photo selected. Enter your known height to see estimated attributes.'); maybeAnalyze(); };
el('body-height').oninput = () => invalidate('Height changed. Analyze the photo again to update its scale.');
el('body-height').onchange = maybeAnalyze;
el('body-use-photo').onclick = () => {
    if (!pendingFile) return;
    const files = new DataTransfer(); files.items.add(pendingFile); el('person-photo').files = files.files;
    status('Photo selected for try-on. Choose your clothing and generate the preview in Try it on.');
};
el('body-analyze').onclick = async () => {
    invalidate('Checking the photo and estimating attributes…'); el('body-analyze').disabled = true;
    el('body-photo').disabled = true; el('body-height').disabled = true;
    try {
        const file = el('body-photo').files[0];
        if (!file || !file.type.startsWith('image/')) throw Error('Select a full-body image first.');
        if (file.size > 15 * 1024 * 1024) throw Error('Use an image smaller than 15 MB.');
        if (!(Number(el('body-height').value) >= 80 && Number(el('body-height').value) <= 250)) throw Error('Enter your known height (80–250 cm) to calibrate photo estimates.');
        status('Checking that the photo shows one person standing straight…');
        const upload = new FormData(); upload.set('file', file);
        upload.set('reference_height_cm', el('body-height').value);
        const validation = await fetch('/phase3/body-analysis/estimate', {method:'POST',body:upload});
        if (!validation.ok) { const error = await validation.json(); throw Error(typeof error.detail === 'string' ? error.detail : 'The person photo could not be validated.'); }
        pending = await validation.json();
        pendingFile = file;
        review(pending);
        status('Attributes estimated. Review or edit the values below, then confirm to use them.');
    } catch (error) { status(error.message || 'Pose analysis could not complete.'); }
    finally { el('body-analyze').disabled = false; el('body-photo').disabled = false; el('body-height').disabled = false; }
};
el('body-save').onclick = async () => {
    if (!pending || !el('body-accept').checked) { status('Review the estimates and confirm their limited use first.'); return; }
    el('body-save').disabled = true;
    for (const id of ['body-photo','body-height','body-analyze','body-reset','body-clear','body-use-photo']) el(id).disabled = true;
    try {
        const reviewed = {...pending, confirmed: true};
        for (const [name] of fields) {
            const input = el(`body-value-${name}`);
            if (!input.reportValidity()) throw Error('Correct the highlighted attribute before saving.');
            reviewed[name] = Number(input.value);
        }
        el('body-attributes').disabled = true;
        const response = await fetch('/phase3/body-analysis', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(reviewed)});
        if (!response.ok) throw Error('Could not save pose estimates. Check the values and your session.');
        const profile = await response.json();
        document.getElementById('profile-form').elements.height_cm.value = profile.height_cm;
        pending = profile.body_analysis; review(pending);
        window.dispatchEvent(new CustomEvent('profile-updated', {detail: profile}));
        status('Saved reviewed attributes for outfit recommendations. Try-on keeps its own photo selection. Use “Use this photo for try-on” if you want to reuse the analyzed photo. Generation uses the photo, not numeric fit measurements.');
    } catch (error) { status(error.message); }
    finally {
        el('body-save').disabled = false; el('body-attributes').disabled = false;
        for (const id of ['body-photo','body-height','body-analyze','body-reset','body-clear']) el(id).disabled = false;
        el('body-use-photo').disabled = !pendingFile;
    }
};
el('body-clear').onclick = async () => {
    const response = await fetch('/phase3/body-analysis', {method: 'DELETE'});
    if (!response.ok) { status('Could not remove saved pose context.'); return; }
    invalidate('Saved pose context removed.');
};
el('body-reset').onclick = () => { if (pending) { review({...pending,...pending.original_estimates}); status('Original estimates restored. Confirm and save to apply.'); } };
window.addEventListener('profile-updated', event => {
    if (pending && event.detail.height_cm !== pending.reference_height_cm) {
        invalidate('Saved height changed. Analyze the photo again before saving attributes.');
        el('body-height').value = event.detail.height_cm || ''; return;
    }
    if (!el('body-height').value && event.detail.height_cm) el('body-height').value = event.detail.height_cm;
    if (!pending && event.detail.body_analysis && !el('body-photo').files[0]) {
        pending = event.detail.body_analysis;
        pending.original_estimates ||= Object.fromEntries(fields.map(([name]) => [name,pending[name]]));
        review(pending); status('Saved attributes loaded. You can edit and confirm them again. Upload a photo to generate a try-on.');
    }
});
