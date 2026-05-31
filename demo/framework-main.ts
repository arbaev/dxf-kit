import { createApp } from "vue";
import "./style.css";
import FrameworkLanding from "./FrameworkLanding.vue";
import type { FrameworkId } from "./frameworks";

// Shared entry for every per-framework landing page. Each page's HTML sets
// `<div id="app" data-framework="react">` (etc.); we read it and render the
// matching landing. One bundle, one component, four routes.
const el = document.getElementById("app");
const framework = (el?.dataset.framework ?? "vue") as FrameworkId;

createApp(FrameworkLanding, { framework }).mount("#app");
