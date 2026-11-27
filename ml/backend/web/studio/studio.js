let phase2 = "http://127.0.0.1:8000";
const byId = (id) => document.getElementById(id);
const uploadForm = byId("upload-form");
const fileInput = byId("garment");
const messages = byId("messages");
const composer = byId("message");
const prompts = [...document.querySelectorAll("[data-prompt]")];
const greeting = messages.firstElementChild.cloneNode(true);

let userId;
let selectedFile;
let conversationId = null;
let uploading = false;
let chatting = false;
let wardrobeRequest = 0;

function element(tag, className, value) {
    const node = document.createElement(tag);
    node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
}

function notice(id, message = "", kind = "") {
    const node = byId(id);
    node.textContent = message;
    node.dataset.kind = kind;
    node.hidden = !message;
}

async function request(url, options, service) {
    let response;
    try {
        response = await fetch(url, options);
    } catch {
        throw new Error(`Could not reach ${service}. Check that its local server is running.`);
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || data === null) {
        const detail = data?.detail;
        const message = typeof detail === "string" ? detail : detail?.message;
        throw new Error(message || `${service} returned HTTP ${response.status}.`);
    }
    return data;
}

function garmentCard(item, origin, outfit = null) {
    const card = element("li", "garment-card");
    const photo = element("div", "garment-photo");
    const image = element("img", "");
    image.alt = item.category;
    image.loading = "lazy";
    image.addEventListener("error", () => {
        photo.replaceChildren(element("span", "", "Photo unavailable"));
    }, { once: true });
    const path = item.thumb_url || item.image_url;
    if (path?.startsWith("/") && !path.startsWith("//")) {
        image.src = origin + path.replaceAll("\\", "/");
        photo.append(image);
    }
    const caption = element("div", "garment-caption");
    caption.append(element("strong", "", item.category));
    const colors = item.colors.map((color) => color.name).join(", ");
    caption.append(element("small", "", [item.slot, colors].filter(Boolean).join(" · ")));
    card.append(photo, caption);
    if (["top", "outer", "bottom", "full"].includes(item.slot)) {
        const preview = element("button", "quiet", "Try on");
        preview.type = "button";
        preview.addEventListener("click", () => window.dispatchEvent(new CustomEvent("preview-garment", { detail: item.id })));
        card.append(preview);
    }
    const select = element("button", "quiet", "Select for outfit");
    select.type = "button";
    select.addEventListener("click", () => window.dispatchEvent(new CustomEvent("toggle-preview-garment", { detail: item.id })));
    card.append(select);
    if (!outfit) {
        const remove = element('button', 'quiet delete-garment', 'Delete');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Delete ${item.category} from wardrobe`);
        const confirmation = element('div', 'delete-confirmation');
        confirmation.hidden = true;
        confirmation.append(element('p', '', `Remove this ${item.category} from your wardrobe and future recommendations?`));
        const errorMessage = element('p', 'notice'); errorMessage.hidden = true; errorMessage.setAttribute('role','alert');
        const confirm = element('button', 'quiet delete-garment', 'Confirm delete');
        const cancel = element('button', 'quiet', 'Cancel');
        confirm.type = cancel.type = 'button';
        remove.onclick = () => { remove.hidden = true; confirmation.hidden = false; confirm.focus(); };
        cancel.onclick = () => { confirmation.hidden = true; remove.hidden = false; remove.focus(); };
        confirm.onclick = async () => {
            confirm.disabled = cancel.disabled = true;
            errorMessage.hidden = true;
            try {
                await request(`/phase3/items/${encodeURIComponent(item.id)}`, {method:'DELETE'}, 'Wardrobe');
                card.remove();
                await loadWardrobe();
            } catch (error) {
                const message = error.message === 'Not Found' || error.message === 'Method Not Allowed'
                    ? 'This backend has not loaded the delete endpoint. Restart the backend and refresh this page.' : error.message;
                errorMessage.textContent = message; errorMessage.hidden = false;
                notice('wardrobe-status', message, 'error');
                confirm.disabled = cancel.disabled = false;
            }
        };
        confirmation.append(confirm, cancel, errorMessage); card.append(remove, confirmation);
    }
    if (outfit) {
        const replace = element("button", "quiet", "Replace this piece");
        replace.type = "button";
        replace.addEventListener("click", () => {
            const others = outfit.items.filter(other => other.id !== item.id);
            const instruction = `Replace ${item.category} (${item.id}) in this outfit. Exclude ${item.id}. Keep these exact other pieces: ${others.map(other => `${other.category} (${other.id})`).join(", ")}.`;
            sendMessage(`Replace the ${item.category} in this outfit.`, instruction);
        });
        card.append(replace);
    }
    return card;
}

async function loadWardrobe() {
    const requestId = ++wardrobeRequest;
    byId("refresh").disabled = true;
    notice("wardrobe-status", "Loading wardrobe…");
    try {
        const items = await request(`${phase2}/items?${new URLSearchParams({ user_id: userId })}`, {}, "Phase 2");
        if (requestId !== wardrobeRequest) return;
        byId("items").replaceChildren(...items.map((item) => garmentCard(item, phase2)));
        byId("item-count").textContent = items.length;
        window.dispatchEvent(new CustomEvent("wardrobe-updated", { detail: items }));
        notice("wardrobe-status", items.length ? "" : "Your wardrobe is empty. Add your first garment above.");
    } catch (error) {
        if (requestId === wardrobeRequest) notice("wardrobe-status", error.message, "error");
    } finally {
        if (requestId === wardrobeRequest) byId("refresh").disabled = false;
    }
}

function chooseFile(file) {
    selectedFile = file;
    byId("file-label").textContent = file ? file.name : "Choose or drop one garment photo";
    byId("upload-button").disabled = !userId || !file || uploading;
}

fileInput.addEventListener("change", () => chooseFile(fileInput.files[0]));
const dropZone = byId("drop-zone");
dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!uploading) dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
    if (uploading) return;
    if (event.dataTransfer.files.length !== 1) {
        notice("upload-status", "Drop one garment photo at a time.", "error");
        return;
    }
    fileInput.value = "";
    chooseFile(event.dataTransfer.files[0]);
});

uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!userId || !selectedFile || uploading) return;
    uploading = true;
    fileInput.disabled = true;
    byId("upload-button").disabled = true;
    notice("upload-status", "Tagging your garment…");
    try {
        const body = new FormData();
        body.set("file", selectedFile);
        body.set("user_id", userId);
        const { item, route, warnings, duplicate_of: duplicate } = await request(`${phase2}/items`, { method: "POST", body }, "Phase 2");
        const details = [...(warnings || [])];
        if (route !== "auto") details.unshift("The category prediction may need review.");
        if (duplicate) details.push("Another copy was saved. Review the possible duplicate before keeping both items.");
        notice("upload-status", [`Saved as ${item.category}.`, ...details].join(" "), "success");
        fileInput.value = "";
        chooseFile(undefined);
        await loadWardrobe();
    } catch (error) {
        notice("upload-status", error.message, "error");
    } finally {
        uploading = false;
        fileInput.disabled = false;
        byId("upload-button").disabled = !selectedFile;
    }
});

function updateChatControls() {
    const disabled = !userId || chatting;
    composer.disabled = disabled;
    byId("send").disabled = disabled;
    byId("new-chat").disabled = disabled;
    for (const prompt of prompts) {
        prompt.disabled = disabled || (prompt.id === "another" && !conversationId);
    }
}

function addMessage(kind, text) {
    const message = element("div", `message ${kind}`);
    message.append(element("p", "", text));
    messages.append(message);
    return message;
}

function renderReply(result) {
    const reply = addMessage("assistant", result.message);
    reply.dataset.status = result.status;
    for (const outfit of result.outfits) {
        const card = element("div", "outfit");
        const garments = element("ul", "outfit-grid");
        garments.append(...outfit.items.map((item) => garmentCard(item, "", outfit)));
        card.append(garments, element("p", "explanation", outfit.explanation));
        for (const note of outfit.fit_notes || []) card.append(element("p", "notice", note));
        for (const liked of [true, false]) {
            const button = element("button", "quiet", liked ? "Like this outfit" : "Dislike");
            button.type = "button";
            button.addEventListener("click", async () => {
                button.disabled = true;
                try {
                    await request("/phase3/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_ids: outfit.items.map(item => item.id), liked }) }, "Phase 3");
                    button.textContent = "Feedback saved";
                } catch (error) {
                    button.textContent = error.message;
                    button.disabled = false;
                }
            });
            card.append(button);
        }
        const preview = element("button", "primary", "Preview this outfit");
        preview.type = "button";
        preview.addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("preview-outfit", { detail: outfit.items.map(item => item.id) }));
            byId("tryon-form").scrollIntoView({ behavior: "smooth", block: "center" });
        });
        card.append(preview);
        reply.append(card);
    }
}

function startOutfitWait() {
    const started = performance.now();
    const panel = byId("chat-wait");
    const copy = byId("chat-wait-copy");
    panel.hidden = false;
    messages.setAttribute("aria-busy", "true");
    const update = () => {
        const seconds = Math.floor((performance.now() - started) / 1000);
        byId("chat-wait-time").textContent = `${seconds}s`;
        const text = seconds >= 60 ? "This is taking longer than usual. Your request is still pending."
            : seconds >= 20 ? "Still working on your outfit. Some requests take a little longer."
            : "Reading your request and checking your wardrobe.";
        if (copy.textContent !== text) copy.textContent = text;
    };
    update();
    const timer = setInterval(update, 1000);
    return () => {
        clearInterval(timer);
        panel.hidden = true;
        messages.setAttribute("aria-busy", "false");
    };
}

async function sendMessage(text, requestText = text) {
    if (!userId || chatting || !text) return;
    chatting = true;
    updateChatControls();
    composer.value = "";
    addMessage("user", text);
    messages.scrollTop = messages.scrollHeight;
    notice("chat-status");
    const stopWaiting = startOutfitWait();
    try {
        const result = await request("/phase3/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: requestText, conversation_id: conversationId, count: byId("outfit-count").value ? Number(byId("outfit-count").value) : undefined }),
        }, "Phase 3");
        conversationId = result.conversation_id;
        renderReply(result);
        if (result.status === "unavailable") composer.value = text;
    } catch (error) {
        addMessage("assistant error", error.message);
        composer.value = text;
    } finally {
        stopWaiting();
        chatting = false;
        updateChatControls();
        notice("chat-status");
        messages.scrollTop = messages.scrollHeight;
    }
}

byId("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(composer.value.trim());
});
for (const prompt of prompts) prompt.addEventListener("click", () => sendMessage(prompt.dataset.prompt));
byId("new-chat").addEventListener("click", () => {
    conversationId = null;
    composer.value = "";
    messages.replaceChildren(greeting.cloneNode(true));
    updateChatControls();
    composer.focus();
});
byId("refresh").addEventListener("click", loadWardrobe);

async function initialize() {
    try {
        const session = await request("/studio/session", {}, "Phase 3");
        userId = session.user_id;
        phase2 = session.phase2_api ?? phase2;
        byId("session").textContent = `Local wardrobe · ${userId}`;
        chooseFile(selectedFile);
        updateChatControls();
        loadWardrobe();
        const profile = await request("/phase3/profile", {}, "Phase 3");
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: profile }));
        for (const [name, value] of Object.entries(profile)) {
            const input = byId("profile-form").elements.namedItem(name);
            if (input) input.value = Array.isArray(value) ? value.join(", ") : value ?? "";
        }
    } catch (error) {
        byId("session").textContent = "Local workspace unavailable";
        notice("wardrobe-status", error.message, "error");
        notice("chat-status", error.message, "error");
    }
    try {
        const health = await request("/phase3/health", {}, "Phase 3");
        byId("model").textContent = `${health.language_model_provider} · ${health.language_model}`;
    } catch {
        byId("model").textContent = "Stylist status unavailable";
    }
}

initialize();

byId("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target));
    for (const key of ["styles", "liked_colors", "avoided_colors"]) {
        body[key] = body[key].split(",").map(value => value.trim()).filter(Boolean);
    }
    for (const key of ["height_cm", "chest_cm", "waist_cm", "hips_cm"]) {
        body[key] = body[key] ? Number(body[key]) : null;
    }
    body.fit = body.fit || null;
    byId("save-profile").disabled = true;
    try {
        await request("/phase3/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, "Phase 3");
        notice("profile-status", "Saved. Your next outfit request will use these preferences.", "success");
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: body }));
    } catch (error) {
        notice("profile-status", error.message, "error");
    } finally {
        byId("save-profile").disabled = false;
    }
});
