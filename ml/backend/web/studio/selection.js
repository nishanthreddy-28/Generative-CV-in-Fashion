const el = id => document.getElementById(id);

let wardrobe = [];

export function selectedItems() {

    const ids = [el("tryon-item").value].filter(Boolean);

    return [...new Set(ids)].map(id => wardrobe.find(item => item.id === id)).filter(Boolean);

}

function update() {

    const items = selectedItems();

    el("selection-status").textContent = items.length ? items[0].category + " — one garment per preview" : "Choose one garment. Include the legs for bottoms and dresses.";

}

function set(ids) {

    const choices = ids.map(id => wardrobe.find(item => item.id === id)).filter(Boolean);

    const top = choices.find(i => i.slot === "top") || choices.find(i => i.slot === "outer");

    const bottom = choices.filter(i => i.slot === "bottom").at(-1);

    const full = choices.find(i => i.slot === "full");

    const selected = full ? [full] : [top || bottom].filter(Boolean);

    el("tryon-item").value = selected[0]?.id || "";


    el("clothing-source").value = "wardrobe";

    el("clothing-source").dispatchEvent(new Event("change"));

    update();

}

window.addEventListener("wardrobe-updated", event => {

    const previous = selectedItems().map(i => i.id);

    wardrobe = event.detail.filter(i => ["top", "outer", "bottom", "full"].includes(i.slot));

    for (const id of ["tryon-item"]) {

        el(id).replaceChildren(new Option("None", ""), ...wardrobe.map(i => new Option(i.category + " - " + i.id.slice(0,6), i.id)));

    }

    set(previous);

});

window.addEventListener("preview-garment", event => set([event.detail]));

window.addEventListener("preview-outfit", event => set(event.detail));

window.addEventListener("toggle-preview-garment", event => {

    const ids = selectedItems().map(i => i.id);

    set(ids.includes(event.detail) ? [] : [event.detail]);

});

el("tryon-item").onchange = update;


el("clear-preview").onclick = () => set([]);

