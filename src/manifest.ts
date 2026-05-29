import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'hipass-receipts',
  version: '0.1.0',
  description: 'hipass.co.kr 통행료 영수증을 여러 날짜 한 번에 PDF/PNG로 일괄 다운로드합니다.',
  permissions: ['downloads', 'sidePanel', 'offscreen', 'debugger'],
  host_permissions: ['https://www.hipass.co.kr/*'],
  icons: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/sw.ts',
    type: 'module',
  },
  action: {
    default_title: '하이패스 영수증 일괄 다운로드',
    default_icon: {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
