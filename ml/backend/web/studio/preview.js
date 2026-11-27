import { selectedItems } from "./selection.js?v=single-hosted-3";
const el = id => document.getElementById(id);
let lastJob, lastEngine;
const engine = el("tryon-engine");
function showEngine() {
    const weshop = engine.value === "weshop";
    el("photo-type-label").hidden = !weshop;
    el("tryon-engine-note").textContent = weshop
        ? "Choose one garment. WeShopAI generates the preview; IDM-VTON is the backup for one top. CPU garment preparation runs on our backend. Hosted queues and limits apply."
        : "IDM-VTON supports one top. Photos are sent to its hosted noncommercial research demo. No local GPU is required.";
}
engine.onchange = showEngine;
showEngine();
fetch("/phase3/health").then(r => r.json()).then(health => {
    engine.value = "weshop";
    if ([...engine.options].some(option => option.value === health.tryon_provider && !option.disabled)) engine.value = health.tryon_provider;
    showEngine();
}).catch(() => {});
window.addEventListener("preview-garment", () => el("tryon-form").scrollIntoView({ behavior: "smooth", block: "center" }));
const source = el("clothing-source");
source.onchange = () => {
    el("wardrobe-clothing").hidden = source.value !== "wardrobe";
    el("upload-clothing").hidden = source.value !== "upload";
};

function showReferences(job) {
    if (job.references?.length && el("prepared-images").dataset.job !== job.id) {
        el("prepared-images").replaceChildren();
        for (const ref of job.references) {
            const image = document.createElement("img");
            image.src = `/phase3/tryon/${job.id}/references/${ref.index}`;
            image.alt = `Cleaned ${ref.category} reference ${ref.index}`;
            image.style.cssText = "max-width:180px;max-height:240px;object-fit:contain";
            el("prepared-images").append(image);
        }
        el("prepared-images").dataset.job = job.id;
        el("prepared-references").hidden = false;
    }
    if (job.references?.length || !["queued", "processing"].includes(job.status)) {
        el("external-tryon").hidden = false;
        el("export-tryon").href = `/phase3/tryon/${job.id}/export`;
    }
}

el("tryon-form").addEventListener("submit", async event => {
    event.preventDefault();
    el("tryon-submit").disabled = true;
    el("tryon-result").hidden = true;
    el("prepared-references").hidden = true;
    el("external-tryon").hidden = true;
    el("prepared-images").dataset.job = "";
    el("download-tryon").hidden = true;
    el("delete-tryon").hidden = true;
    try {
        const body = new FormData();
        body.set("engine", engine.value);
        body.set("photo_type", "auto");
        let endpoint = "/phase3/tryon/outfit";
        if (source.value === "upload") {
            endpoint = "/phase3/tryon/uploads";
            const first = el("clothing-photo-1").files[0];
            if (!first) throw Error("Upload the first clothing photo.");
            for (const n of [1]) {
                const file = el(`clothing-photo-${n}`).files[0];
                if (file) { body.append("garments", file); body.append("categories", el(`clothing-category-${n}`).value); }
            }
        } else {
            const selected = selectedItems();
            if (!selected.length) throw Error("Choose a clothing item first.");
            for (const item of selected) body.append("item_ids", item.id);
        }
        if (!el("person-photo").files[0]) throw Error("Upload a clear person photo showing the area where the clothing will be applied.");
        body.set("file", el("person-photo").files[0]);
        el("tryon-status").textContent = "Checking your person photo before generation…";
        if (["idm", "weshop"].includes(engine.value) && (body.getAll("garments").length > 1 || body.getAll("item_ids").length > 1)) throw Error(engine.value === 'idm' ? "IDM-VTON supports one top. Clear the second selection first." : "WeShopAI supports one garment. Clear the second selection first.");
        const response = await fetch(endpoint, { method: "POST", body });
        const job = await response.json();
        if (!response.ok) throw Error(typeof job.detail === "string" ? job.detail : "Could not start preview");
        lastJob = job.id;
        lastEngine = job.engine || engine.value;
        el("delete-tryon").hidden = true;
        el("download-tryon").hidden = true;
        let status = job;
        while (["queued", "processing"].includes(status.status)) {
            showReferences(status);
            el("tryon-status").textContent = [status.message, ...(status.warnings || [])].join(" ");
            await new Promise(resolve => setTimeout(resolve, 2500));
            const update = await fetch(`/phase3/tryon/${job.id}`);
            if (!update.ok) throw Error("Could not read preview status");
            status = await update.json();
        }
        el("tryon-status").textContent = [status.message, ...(status.warnings || [])].join(" ");
        lastEngine = status.engine || lastEngine;
        showReferences(status);
        el("delete-tryon").hidden = false;
        if (status.status === "completed") {
            el("tryon-result").src = `/phase3/tryon/${job.id}/image`;
            el("tryon-result").hidden = false;
            el("download-tryon").href = el("tryon-result").src;
            el("download-tryon").hidden = false;
        }
    } catch (error) {
        el("tryon-status").textContent = error.message;
    } finally {
        el("tryon-submit").disabled = false;
    }
});
el("delete-tryon").onclick = async () => {
    if (!lastJob) return;
    try {
        const response = await fetch(`/phase3/tryon/${lastJob}`, { method: "DELETE" });
        if (!response.ok) throw Error("Could not delete preview");
        el("tryon-result").hidden = true;
        el("tryon-result").removeAttribute("src");
        el("download-tryon").hidden = true;
        el("delete-tryon").hidden = true;
        el("prepared-references").hidden = true;
        el("external-tryon").hidden = true;
        el("tryon-status").textContent = "Saved person photo and previews deleted from Drape&Drop." + " This does not request deletion from the external inference service.";
        lastJob = null;
    } catch (error) { el("tryon-status").textContent = error.message; }
};
