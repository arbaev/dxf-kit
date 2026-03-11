<script setup lang="ts">
import { ref } from "vue";
import { DXFViewer, FileUploader, parseDxf } from "dxf-vuer";
import type { DxfData } from "dxf-vuer";
import "dxf-vuer/style.css";

const dxfData = ref<DxfData | null>(null);
const fileName = ref("");

async function handleFile(file: File) {
  fileName.value = file.name;
  const text = await file.text();
  dxfData.value = parseDxf(text);
}
</script>

<template>
  <div style="font-family: system-ui, sans-serif">
    <div style="padding: 16px; display: flex; gap: 12px; align-items: center">
      <FileUploader @file-selected="handleFile" />
      <span v-if="fileName" style="font-size: 14px; color: #666">{{ fileName }}</span>
    </div>

    <DXFViewer
      v-if="dxfData"
      :dxf-data="dxfData"
      :file-name="fileName"
      :show-reset-button="true"
      :show-coordinates="true"
      style="height: calc(100vh - 60px)"
    />

    <div
      v-else
      style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: calc(100vh - 60px);
        color: #999;
        font-size: 18px;
      "
    >
      Select a .dxf file to render
    </div>
  </div>
</template>
