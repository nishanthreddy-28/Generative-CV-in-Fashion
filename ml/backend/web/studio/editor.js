const el = id => document.getElementById(id);
let items = [], categories = {};
async function request(path, options) {
    const response = await fetch(path, options);
    const data = await response.json();
    if (!response.ok) throw Error(typeof data.detail === "string" ? data.detail : data.detail?.message || "Could not save garment");
    return data;
}
async function load() {
    const item = items.find(item => item.id === el("edit-item").value);
    if (!item) {
        el('save-garment').disabled = true;
        el('editor-preview').hidden = true;
        el('editor-preview').removeAttribute('src');
        return;
    }
    el("save-garment").disabled = true;
    try {
        if (!Object.keys(categories).length) {
            categories = (await request("/phase3/taxonomy")).categories;
            el("edit-category").replaceChildren(...Object.keys(categories).map(category => new Option(category, category)));
        }
        el("edit-category").value = item.category;
        el("edit-formality").value = item.attributes.formality;
        el("edit-fit").value = item.attributes.fit;
        const measures = await request(`/phase3/items/${item.id}/measurements`);
        if (el("edit-item").value !== item.id) return;
        for (const key of ["chest", "waist", "hips", "length"]) el(`edit-${key}`).value = measures[`${key}_cm`] ?? "";
        el("edit-rotation").value = String(measures.preview_rotation || 0);
        el("editor-preview").src = `/phase3/items/${item.id}/image`;
        el("editor-preview").hidden = false;
        el("editor-preview").style.transform = `rotate(${el("edit-rotation").value}deg)`;
    } catch (error) { el("editor-status").textContent = error.message; }
    finally { el("save-garment").disabled = false; }
}
window.addEventListener("wardrobe-updated", event => {
    items = event.detail;
    const previous = el("edit-item").value;
    el("edit-item").replaceChildren(...items.map(item => new Option(`${item.category} · ${item.id.slice(0, 6)}`, item.id)));
    if (items.some(item => item.id === previous)) el("edit-item").value = previous;
    load();
});
el("edit-item").onchange = load;
el("edit-rotation").onchange = () => { el("editor-preview").style.transform = `rotate(${el("edit-rotation").value}deg)`; };
el("garment-editor").onsubmit = async event => {
    event.preventDefault();
    const item = items.find(item => item.id === el("edit-item").value);
    if (!item) return;
    el("save-garment").disabled = true;
    try {
        const category = el("edit-category").value;
        const details = { category, slot: categories[category], formality: el("edit-formality").value, fit: el("edit-fit").value };
        await request(`/items/${item.id}?${new URLSearchParams({ user_id: item.user_id })}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) });
        const measures = Object.fromEntries(["chest", "waist", "hips", "length"].map(key => [`${key}_cm`, el(`edit-${key}`).value ? Number(el(`edit-${key}`).value) : null]));
        measures.preview_rotation = Number(el("edit-rotation").value);
        await request(`/phase3/items/${item.id}/measurements`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(measures) });
        el("refresh").click();
        el("editor-status").textContent = "Saved garment tags and measurements.";
    } catch (error) { el("editor-status").textContent = error.message; }
    finally { el("save-garment").disabled = false; }
};
